interface FSTicket {
  subject: string
  category?: string
  requester_id: string
  responder_id?: string
  priority: number
  status: number
  created_at: Date
  requester: {
    email: string
  }
  stats: {
    ticket_id: number
    resolved_at?: Date
    first_assigned_at?: Date
    first_resp_time_in_secs?: number
    resolution_time_in_secs?: number
  }
}

interface FSAgent {
  id: number
  email: string
}

interface FSTicketsResponse {
  tickets: FSTicket[]
}

interface FSAgentsResponse {
  agents: FSAgent[]
}

const STATUS_MESSAGES: Record<number, string> = {
  0: 'Open',
  1: 'Pending',
  2: 'Resolved',
  3: 'Closed'
} as const

const PRIORITY_MESSAGES: Record<number, string> = {
  0: 'Low',
  1: 'Medium',
  2: 'High',
  3: 'Urgent'
} as const

function getReqVars() {
  // check environment variables
  if (!process.env.FRESH_SERVICE_API_KEY || !process.env.FRESH_SERVICE_DOMAIN) {
    throw new Error('Missing Fresh Service environment variables')
  }

  // setup headers
  const authToken = Buffer.from(`${process.env.FRESH_SERVICE_API_KEY}:`).toString('base64')
  const headers = new Headers({
    'Authorization': `Basic ${authToken}`,
    'Content-Type': 'application/json',
  })

  return {
    headers,
    domain: process.env.FRESH_SERVICE_DOMAIN
  }
}

// Utility functions for converting API responses
function convertPriority(priority: number): string {
  return PRIORITY_MESSAGES[priority] || 'Unknown'
}

function convertStatus(status: number): string {
  return STATUS_MESSAGES[status] || 'Unknown'
}

export async function fetchFSTickets(): Promise<FSTicket[]> {
  console.log("Starting Fresh Service ticket fetch...")

  const { headers, domain } = getReqVars()

  const allTickets: FSTicket[] = []
  let page = 1

  // calculate date 7 days ago
  const today = new Date()
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const updatedSince = sevenDaysAgo.toISOString()
  
  console.log(`Fetching tickets updated since: ${updatedSince}`)

  while (true) {
    const url = `https://${domain}/api/v2/tickets?per_page=100&page=${page}&include=requester,stats&updated_since=${updatedSince}`

    try {
      console.log(`Fetching page ${page}...`)

      // make fetch request
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Graph API error:', response.status, errorText)
        throw new Error(`Graph API error: ${response.status} - ${errorText}`)
      }

      const data: FSTicketsResponse = await response.json()

      if (!data?.tickets || data.tickets.length === 0) {
        console.log("No more tickets found, ending pagination")
        break
      }

      allTickets.push(...data.tickets)
      console.log(`Added ${data.tickets.length} tickets from page ${page}`)

      page++

    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  console.log(`Fetch complete. Total tickets retrieved: ${allTickets.length}`)
  return allTickets
}

export async function fetchFSAgents(): Promise<FSAgent[]> {
  console.log("Starting Fresh Service agent fetch...")

  const { headers, domain } = getReqVars()

  const allAgents: FSAgent[] = []
  let page = 1

  while (true) {
    const url = `https://${domain}/api/v2/agents?per_page=100&page=${page}`

    try {
      console.log(`Fetching page ${page}...`)

      // make fetch request
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Graph API error:', response.status, errorText)
        throw new Error(`Graph API error: ${response.status} - ${errorText}`)
      }

      const data: FSAgentsResponse = await response.json()

      if (!data?.agents || data.agents.length === 0) {
        console.log("No more agents found, ending pagination")
        break
      }

      allAgents.push(...data.agents)
      console.log(`Added ${data.agents.length} agents from page ${page}`)

      page++

    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  console.log(`Fetch complete. Total agents retrieved: ${allAgents.length}`)
  return allAgents
}

export function createAgentEmailMap(fsAgents: FSAgent[]): Map<string, string> {
  const agentEmailMap = new Map<string, string>()

  fsAgents.forEach(agent => {
    agentEmailMap.set(agent.id.toString(), agent.email)
  })

  return agentEmailMap
}

function mapFSTicketToDb(fsTicket: FSTicket, agentEmailMap: Map<string, string>) {
  const assigneeEmail = fsTicket.responder_id ? agentEmailMap.get(fsTicket.responder_id) : null

  return {
    freshServiceId: fsTicket.stats.ticket_id.toString(),
    subject: fsTicket.subject,
    category: fsTicket.category || null,
    status: convertStatus(fsTicket.status),
    priority: convertPriority(fsTicket.priority),
    createdAt: new Date(fsTicket.created_at),
    assignedAt: fsTicket.stats.first_assigned_at ? new Date(fsTicket.stats.first_assigned_at) : null,
    resolvedAt: fsTicket.stats.resolved_at ? new Date(fsTicket.stats.resolved_at) : null,
    firstResponseTime: fsTicket.stats.first_resp_time_in_secs || null,
    resolutionTime: fsTicket.stats.resolution_time_in_secs || null, 
    requesterId: fsTicket.requester_id?.toString(),
    requesterEmail: fsTicket.requester.email,
    assigneeId: fsTicket.responder_id?.toString(),
    assigneeEmail: assigneeEmail
  }
}