import { prisma } from '@/lib/prisma';

interface FSTicket {
  subject: string
  department_id: string
  category?: string
  requester_id: string
  responder_id?: string
  priority: number
  status: number
  source: number
  created_at: Date
  workspace_id: number
  description_text: string
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
  id: string
  email: string
}

interface FSTicketsResponse {
  tickets: FSTicket[]
}

interface FSAgentsResponse {
  agents: FSAgent[]
}

const STATUS_MESSAGES: Record<number, string> = {
  2: 'Open',
  3: 'Pending',
  4: 'Resolved',
  5: 'Closed'
} as const;

const PRIORITY_MESSAGES: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Urgent'
} as const;

const SOURCE_MESSAGES: Record<number, string> = {
  1: 'Email',
  2: 'Portal',
  3: 'Phone',
  4: 'Chat',
  5: 'Feedback widget',
  6: 'Yammer',
  7: 'AWS Cloudwatch',
  8: 'Pagerduty',
  9: 'Walkup',
  10: 'Slack',
  11: 'Chatbot',
  12: 'Workplace',
  13: 'Employee Onboarding',
  14: 'Alerts',
  15: 'MS Teams',
  18: 'Employee Offboarding'
} as const;

// Utility functions for converting API responses
function convertPriority(priority: number): string {
  return PRIORITY_MESSAGES[priority] || 'Unknown';
}

function convertStatus(status: number): string {
  return STATUS_MESSAGES[status] || 'Unknown';
}

function convertSource(source: number): string {
  return SOURCE_MESSAGES[source] || 'Unknown';
}

function getReqVars(): { headers: Headers, domain: string } {
  // check environment variables
  if (!process.env.FRESH_SERVICE_API_KEY || !process.env.FRESH_SERVICE_DOMAIN) {
    throw new Error('Missing Fresh Service environment variables');
  }

  // setup headers
  const authToken = Buffer.from(`${process.env.FRESH_SERVICE_API_KEY}:`).toString('base64');
  const headers = new Headers({
    'Authorization': `Basic ${authToken}`,
    'Content-Type': 'application/json',
  });

  return {
    headers,
    domain: process.env.FRESH_SERVICE_DOMAIN
  };
}

export async function fetchFSTickets(): Promise<FSTicket[]> {
  console.log("Starting Fresh Service ticket fetch...");

  const { headers, domain } = getReqVars();

  const allTickets: FSTicket[] = [];
  let page = 1;

  // calculate date 7 days ago
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const updatedSince = sevenDaysAgo.toISOString();
  
  console.log(`Fetching tickets updated since: ${updatedSince}`);

  while (true) {
    const url = `https://${domain}/api/v2/tickets?per_page=100&page=${page}&include=requester,stats&updated_since=${updatedSince}`;

    try {
      console.log(`Fetching page ${page}...`);

      // make fetch request
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Graph API error:', response.status, errorText);
        throw new Error(`Graph API error: ${response.status} - ${errorText}`);
      }

      const data: FSTicketsResponse = await response.json();

      if (!data?.tickets || data.tickets.length === 0) {
        console.log("No more tickets found, ending pagination");
        break;
      }

      allTickets.push(...data.tickets);
      console.log(`Added ${data.tickets.length} tickets from page ${page}`);

      page++;

    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  console.log(`Fetch complete. Total tickets retrieved: ${allTickets.length}`);
  return allTickets;
}

export async function fetchFSAgents(): Promise<FSAgent[]> {
  console.log("Starting Fresh Service agent fetch...");

  const { headers, domain } = getReqVars();

  const allAgents: FSAgent[] = [];
  let page = 1;

  while (true) {
    const url = `https://${domain}/api/v2/agents?per_page=100&page=${page}&active=true`;

    try {
      console.log(`Fetching page ${page}...`);

      // make fetch request
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Graph API error:', response.status, errorText);
        throw new Error(`Graph API error: ${response.status} - ${errorText}`);
      }

      const data: FSAgentsResponse = await response.json();

      if (!data?.agents || data.agents.length === 0) {
        console.log("No more agents found, ending pagination");
        break;
      }

      allAgents.push(...data.agents);
      console.log(`Added ${data.agents.length} agents from page ${page}`);

      page++;

    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  console.log(`Fetch complete. Total agents retrieved: ${allAgents.length}`);
  return allAgents;
}

export function createAgentEmailMap(fsAgents: FSAgent[]): Map<string, string> {
  const agentEmailMap = new Map<string, string>();

  fsAgents.forEach(agent => {
    agentEmailMap.set(agent.id, agent.email);
  });

  return agentEmailMap;
}

export async function resolveTicketUserIds(
  fsTicket: FSTicket, 
  agentEmailMap: Map<string, string>
): Promise<{ requesterId: number, responderId: number | null }> {
  // get azure requester that matches ticket's requester email
  const requester = await prisma.users.findUnique({
    where: { email: fsTicket.requester.email }
  });
  if (!requester) {
    throw new Error(`Requester not found in the database: ${fsTicket.requester.email} (Ticket: ${fsTicket.subject})`);
  }

  // get azure responder that matches ticket's responder id
  let responder = null;
  const responderEmail = fsTicket.responder_id ? agentEmailMap.get(fsTicket.responder_id) : null;

  if (responderEmail) {
    responder = await prisma.users.findUnique({
      where: { email: responderEmail }
    });
    if (!responder) {
      throw new Error(`Responder not found in the database: ${responderEmail} (Ticket: ${fsTicket.subject})`);
    }
  }
  
  return {
    requesterId: requester.id,
    responderId: responder?.id || null
  };
}

export function mapFSTicketToDb(fsTicket: FSTicket, userIds: { requesterId: number, responderId: number | null }) {
  return {
    fsTicketId: fsTicket.stats.ticket_id.toString(),
    subject: fsTicket.subject,
    category: fsTicket.category || null,
    description: fsTicket.description_text || null,
    status: convertStatus(fsTicket.status),
    priority: convertPriority(fsTicket.priority),
    source: convertSource(fsTicket.source),
    departmentId: fsTicket.department_id.toString(),
    workspaceId: fsTicket.workspace_id,
    createdAt: new Date(fsTicket.created_at),
    assignedAt: fsTicket.stats.first_assigned_at ? new Date(fsTicket.stats.first_assigned_at) : null,
    resolvedAt: fsTicket.stats.resolved_at ? new Date(fsTicket.stats.resolved_at) : null,
    firstResponseTime: fsTicket.stats.first_resp_time_in_secs || null,
    resolutionTime: fsTicket.stats.resolution_time_in_secs || null, 
    requesterId: userIds.requesterId,
    assigneeId: userIds.responderId
  };
}