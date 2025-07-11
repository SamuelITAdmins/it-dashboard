interface AzureUser {
  id: string
  displayName: string
  userPrincipalName?: string
  jobTitle?: string
  department?: string
  companyName?: string
  city?: string
  accountEnabled?: boolean
  createdDateTime?: string
}

interface AzureUsersResponse {
  value: AzureUser[]
  // pagination setup
  '@odata.nextLink'?: string
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`
  
  console.log('Getting access token...')
  
  if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    throw new Error('Missing Azure environment variables')
  }
  
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: body.toString()
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Token request failed:', response.status, errorText)
    throw new Error(`Token request failed: ${response.status} - ${errorText}`)
  }

  const data: TokenResponse = JSON.parse(await response.text())
  console.log('Got access token')
  return data.access_token
}

export async function fetchAzureUsers(): Promise<AzureUser[]> {
  console.log('Starting Azure user fetch...')
  
  const token = await getAccessToken()
  
  const selectFields = 'id,displayName,userPrincipalName,jobTitle,department,companyName,city,accountEnabled,createdDateTime'
  let url = `https://graph.microsoft.com/v1.0/users?$select=${selectFields}`
  
  console.log('Graph API URL:', url)
  
  const allUsers: AzureUser[] = []
  let pageCount = 0
  
  while (url && pageCount < 50) { // Safety limit
    pageCount++
    console.log(`Fetching page ${pageCount}...`)
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Graph API error:', response.status, errorText)
      throw new Error(`Graph API error: ${response.status} - ${errorText}`)
    }
    
    const data: AzureUsersResponse = await response.json()
    console.log(`Found ${data.value.length} users on page ${pageCount}`)
    
    allUsers.push(...data.value)
    url = data['@odata.nextLink'] || ''
  }
  
  console.log(`Total users before filtering: ${allUsers.length}`)
  
  // Filter out none company and disabled users
  const filteredUsers = allUsers.filter(user => {
    const hasCompany = user.companyName && user.companyName !== 'None'
    const isEnabled = user.accountEnabled === true
    return hasCompany && isEnabled
  })
  
  console.log(`Filtered users: ${filteredUsers.length}`)
  
  return filteredUsers
}

export function mapAzureUserToDb(azureUser: AzureUser) {
  return {
    azureId: azureUser.id,
    name: azureUser.displayName,
    email: azureUser.userPrincipalName || '',
    jobTitle: azureUser.jobTitle || null,
    department: azureUser.department || null,
    companyName: azureUser.companyName || null,
    city: azureUser.city || null,
    azureCreatedAt: azureUser.createdDateTime && azureUser.createdDateTime !== 'None' 
      ? new Date(azureUser.createdDateTime) 
      : null,
  }
}