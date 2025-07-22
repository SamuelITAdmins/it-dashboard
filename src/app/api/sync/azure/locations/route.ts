import { prisma } from "@/lib/prisma";
import { 
  fetchAzureUsers, 
  getAccessToken, 
  createLocationsFromUsers
} from "@/lib/azure";

export async function POST() {
  try {
    console.log('Starting Azure location sync...');
    
    // Fetch users to extract locations
    const [seToken, epcToken] = await Promise.all([
      getAccessToken('SE'),
      getAccessToken('EPC')
    ]);

    const [seAzureUsers, epcAzureUsers] = await Promise.all([
      fetchAzureUsers(seToken, 'Samuel Engineering'),
      fetchAzureUsers(epcToken, 'Samuel EPC')
    ]);

    const allAzureUsers = [...seAzureUsers, ...epcAzureUsers];
    const { locations, errors } = createLocationsFromUsers(allAzureUsers);
    
    console.log(`Syncing ${locations.length} locations...`);
    
    const results = await Promise.allSettled(
      locations.map(location =>
        prisma.locations.upsert({
          where: { name: location.name },
          update: {
            state: location.state,
            timezone: location.timezone
          },
          create: location
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const dbErrors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason.message);

    console.log(`✅ Location sync completed: ${successful} successful, ${failed} failed`);

    return Response.json({
      success: failed === 0,
      message: `Location sync completed: ${successful} successful, ${failed} failed`,
      details: {
        total: locations.length,
        successful,
        failed,
        processingErrors: errors,
        databaseErrors: dbErrors
      }
    });

  } catch (error) {
    console.error('Azure location sync error:', error);
    return Response.json(
      { error: 'Location sync failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}