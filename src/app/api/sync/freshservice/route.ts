import { prisma } from "@/lib/prisma";
import { fetchFSTickets } from "@/lib/freshservice";

export async function GET() {
  try {
    const fsTickets = await fetchFSTickets()

    return Response.json({
      success: true,
      count: fsTickets.length,
      message: fsTickets
    })
  } catch (error) {
    console.error(`Fresh Service sync error:`, error)
    return Response.json(
      { error: 'Sync failed' },
      { status: 500 }
    )
  }
}