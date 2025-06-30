import { prisma } from "@/lib/prisma";
import { fetchAzureUsers, mapAzureUserToDb } from "@/lib/azure";

export async function POST() {
  try {
    const azureUsers = await fetchAzureUsers()

    for (const azureUser of azureUsers) {
      const userData = mapAzureUserToDb(azureUser)

      await prisma.users.upsert({
        where: { azureId: userData.azureId },
        update: userData,
        create: userData
      })
    }

    return Response.json({
      success: true,
      message: `Synced ${azureUsers.length} users`
    })
  } catch (error) {
    console.error(`Azure sync error:`, error)
    return Response.json(
      { error: 'Sync failed' },
      { status: 500 }
    )
  }
}