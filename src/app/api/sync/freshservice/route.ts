// src/app/api/sync/freshservice/route.ts
import { prisma } from "@/lib/prisma"
import { fetchFSTickets, fetchFSAgents, createAgentEmailMap, mapFSTicketToDb, resolveUserIds } from "@/lib/freshservice"

export async function POST() {
  try {
    // Fetch agents first for email lookup
    console.log('Fetching Freshservice agents...')
    const fsAgents = await fetchFSAgents()
    const agentEmailMap = createAgentEmailMap(fsAgents)
    console.log(`Created email map for ${fsAgents.length} agents`)

    // Fetch tickets
    console.log('Fetching Freshservice tickets...')
    const fsTickets = await fetchFSTickets()

    for (const fsTicket of fsTickets) {
      // Map ticket data
      const ticketData = mapFSTicketToDb(fsTicket, agentEmailMap)
      
      // Resolve user relationships
      const ticketWithUserIds = await resolveUserIds(ticketData, agentEmailMap)

      // Upsert to database
      await prisma.tickets.upsert({
        where: { fsTicketId: ticketWithUserIds.fsTicketId },
        update: ticketWithUserIds,
        create: ticketWithUserIds
      })
    }

    return Response.json({
      success: true,
      message: `Synced ${fsTickets.length} tickets with ${fsAgents.length} agents`
    })
    
  } catch (error) {
    console.error(`Freshservice sync error:`, error)
    return Response.json(
      { error: 'Sync failed' },
      { status: 500 }
    )
  }
}