import { prisma } from "@/lib/prisma";
import { 
  fetchAzureUsers, 
  getAccessToken, 
  mapAzureUserToDb,
  type AzureUser 
} from "@/lib/azure";

export async function POST() {
  try {
    console.log('Starting Azure user sync...');
    
    const [seToken, epcToken] = await Promise.all([
      getAccessToken('SE'),
      getAccessToken('EPC')
    ]);

    const [seAzureUsers, epcAzureUsers] = await Promise.all([
      fetchAzureUsers(seToken, 'Samuel Engineering'),
      fetchAzureUsers(epcToken, 'Samuel EPC')
    ]);

    const allAzureUsers = [...seAzureUsers, ...epcAzureUsers];
    const locationMap = await createLocationIdMap();
    
    console.log(`Syncing ${allAzureUsers.length} users...`);
    
    const results = await Promise.allSettled(
      allAzureUsers.map(async (azureUser) => {
        const userData = mapAzureUserToDb(azureUser);
        const locationId = azureUser.city ? locationMap.get(azureUser.city) : null;
        
        // Skip users without location since locationId is required
        if (!locationId) {
          throw new Error(`Required location not found for user ${userData.name}, city: ${azureUser.city}`);
        }
        
        return prisma.users.upsert({  // Use plural 'users' per your schema
          where: { azureId: userData.azureId },
          update: {
            ...userData,
            locationId  // Required field per your schema
          },
          create: {
            ...userData,
            locationId  // Required field per your schema
          }
        });
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason.message);

    console.log(`✅ User sync completed: ${successful} successful, ${failed} failed`);

    return Response.json({
      success: failed === 0,
      message: `User sync completed: ${successful} successful, ${failed} failed`,
      details: {
        total: allAzureUsers.length,
        successful,
        failed,
        errors
      }
    });

  } catch (error) {
    console.error('Azure user sync error:', error);
    return Response.json(
      { error: 'User sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function createLocationIdMap(): Promise<Map<string, number>> {
  try {
    const locations = await prisma.locations.findMany({  // Use plural 'locations'
      select: { id: true, name: true }
    });
    return new Map(locations.map(loc => [loc.name, loc.id]));
  } catch (error) {
    console.warn('Failed to load location mapping:', error);
    return new Map();
  }
}