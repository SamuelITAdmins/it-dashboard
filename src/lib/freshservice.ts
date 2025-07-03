interface FSTicket {
  subject: string,
  status: number,
  priority: number,
  createdAt: Date,
  resolvedAt?: Date
}

interface FSTicketsResponse {
  value: FSTicket[],
  '@odata.nextLink'?: string
}

export async function fetchFSTickets(Promise<FSTicket[]>) {
  console.log("Starting Fresh Service ticket fetch...")

  // check environment variables
  if (!process.env.FRESH_SERVICE_API_KEY || !process.env.FRESH_SERVICE_DOMAIN) {
    throw new Error('Missing Fresh Service environment variables')
  }

  const url = `https://${process.env.FRESH_SERVICE_DOMAIN}/api/v2/tickets`

  // setup headers
  const auth_token = Buffer.from(`${process.env.FRESH_SERVICE_API_KEY}`).toString('base64')
  const headers = new Headers({
    'Authorization': `Basic ${auth_token}`,
    'Content-Type': 'application/json',
  })

  try {
    // make fetch request
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Authorization': `Basic ${auth_token}`,
        'Content-Type': 'application/json',
      }
    })

    const responseText = await response.text()

    if (!response.ok) {
      throw new Error(`Tickets request failed: ${response.status} - ${responseText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}