import { prisma } from "@/lib/prisma";
import { calculateUptimes, fetchDeviceHistories, fetchDevices, fetchDeviceStatuses, getOrgId, mapMerakiDeviceToDb } from "@/lib/meraki";

export async function POST() {
  try {
    console.log('Fetching Meraki organization...');
    const orgId = await getOrgId();

    console.log('Fetching devices...');
    let merakiDevices = await fetchDevices(orgId);

    console.log('Fetching device histories...');
    merakiDevices = await fetchDeviceHistories(orgId, merakiDevices);

    console.log('Calculating device uptime...');
    calculateUptimes(merakiDevices);

    for (const merakiDevice of merakiDevices) {
      const networkDeviceData = mapMerakiDeviceToDb(merakiDevice)

      await prisma.networkDevices.upsert({
        where: { merakiDeviceId: networkDeviceData.merakiDeviceId },
        update: networkDeviceData,
        create: networkDeviceData
      });
    }

    return Response.json({
      success: true,
      message: `Synced ${merakiDevices.length} devices`
    });
  } catch (error) {
    console.error(`Meraki sync error:`, error);
    return Response.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}