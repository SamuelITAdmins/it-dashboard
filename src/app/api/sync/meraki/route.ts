import { prisma } from "@/lib/prisma";
import { fetchDevices } from "@/lib/meraki"

export async function POST() {
  try {
    console.log('Fetching Meraki organization...')
    const devices = await fetchDevices()

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