// src/app/api/sync/freshservice/route.ts
import { prisma } from "@/lib/prisma";
import { fetchFSTickets, fetchFSAgents, createAgentEmailMap, resolveTicketUserIds, mapFSTicketToDb, fetchFSAssets, mapFSAssetToDb } from "@/lib/freshservice";

export async function POST() {
  try {
    // Fetch agents first for email lookup
    console.log('Fetching Freshservice agents...');
    const fsAgents = await fetchFSAgents();
    const agentEmailMap = createAgentEmailMap(fsAgents);
    console.log(`Created email map for ${fsAgents.length} agents`);

    // Fetch tickets
    console.log('Fetching Freshservice tickets...');
    const fsTickets = await fetchFSTickets();

    for (const fsTicket of fsTickets) {
      try {
        // Match requester and responder ids
        const userIds = await resolveTicketUserIds(fsTicket, agentEmailMap);

        // Map ticket data
        const ticketData = mapFSTicketToDb(fsTicket, userIds);

        await prisma.tickets.upsert({
          where: { fsTicketId: ticketData.fsTicketId },
          update: ticketData,
          create: ticketData
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Skipping ticket ${fsTicket.stats.ticket_id}:`, errorMessage);
      }
    }

    // Fetch assets
    console.log('Fetching Freshservice assets...');
    const fsAssets = await fetchFSAssets();

    for (const fsAsset of fsAssets) {
      // Map asset data
      const assetData = mapFSAssetToDb(fsAsset);

      try {
        await prisma.assets.upsert({
          where: { fsAssetId: assetData.fsAssetId },
          update: assetData,
          create: assetData
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Skipping ticket ${fsAsset.name}:`, errorMessage);
      }
    }
    

    return Response.json({
      success: true,
      message: `Synced ${fsTickets.length} tickets and ${fsAssets.length} assets with ${fsAgents.length} agents`
    });
    
  } catch (error) {
    console.error(`Freshservice sync error:`, error);
    return Response.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}