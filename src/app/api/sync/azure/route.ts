import { prisma } from "@/lib/prisma";
import { 
  createLocationsFromUsers,
  fetchAzureUsers, 
  getAccessToken, 
  mapAzureLocationToDb, 
  mapAzureUserToDb,
  resolveUserLocationId
} from "@/lib/azure";

export async function POST() {
  try {
    console.log('Starting Azure user and location sync...');
    
    // get access tokens for both SE and EPC tenants
    const [seToken, epcToken] = await Promise.all([
      getAccessToken('SE'),
      getAccessToken('EPC')
    ]);

    // get user data from azure
    const [seAzureUsers, epcAzureUsers] = await Promise.all([
      fetchAzureUsers(seToken, 'Samuel Engineering'),
      fetchAzureUsers(epcToken, 'Samuel EPC')
    ]);

    const allAzureUsers = [...seAzureUsers, ...epcAzureUsers];

    // grab location data from user.city
    const azureLocations = createLocationsFromUsers(allAzureUsers);

    // add locations to the db
    for (const location of azureLocations) {
      try {
        const locationData = mapAzureLocationToDb(location);

        await prisma.locations.upsert({
          where: { name: locationData.name },
          update: locationData,
          create: locationData
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Skipping Azure location ${location.name}:`, errorMessage);
      }
    }

    // map location ids and names to be added to user data
    const locations = await prisma.locations.findMany({
      select: { id: true, name: true }
    });
    const locationMap = new Map(locations.map(loc => [loc.name, loc.id]));

    // add users to the db
    for (const user of allAzureUsers) {
      try {
        const locationId = await resolveUserLocationId(user, locationMap);

        const userData = mapAzureUserToDb(user, locationId)

        await prisma.users.upsert({
          where: { azureId: userData.azureId },
          update: userData,
          create: userData
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Skipping Azure user ${user.displayName}:`, errorMessage);
      }
    }

    return Response.json({
      success: true,
      message: `Synced ${allAzureUsers.length} users and ${azureLocations.length} locations.`
    });

  } catch (error) {
    console.error('Azure user sync error:', error);
    return Response.json(
      { error: 'User sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}