import { prisma } from "@/lib/prisma";
import { fetchDeviceHistories, fetchDevices, getOrgId } from "@/lib/meraki"

export async function POST() {
  try {
    console.log('Fetching Meraki organization...')
    const orgId = await getOrgId()

    console.log('Fetching devices...')
    let devices = await fetchDevices(orgId)

    console.log('Fetching device hisories...')
    devices = await fetchDeviceHistories(orgId, devices)

    console.log('Calculating device uptime...')
    // devices = 

    return Response.json({
      success: true,
      message: devices
    })
  } catch (error) {
    console.error(`Azure sync error:`, error)
    return Response.json(
      { error: 'Sync failed' },
      { status: 500 }
    )
  }
}