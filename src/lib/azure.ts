interface AzureUser {
  id: string,
  displayName: string,
  userPrincipalName: string,
  jobTitle?: string,
  department?: string,
  companyName?: string,
  city?: string,
  accountEnabled?: boolean,
  createdDateTime?: string
}

interface AzureUsersResponse {
  value: AzureUser[]
}

export async function fetchAzureUsers(): Promise<AzureUser[]> {
  const response = await fetch('https://graph.microsoft.com/v1.0/users', {
    headers: {
      'Authorization': `Bearer ${process.env.AZURE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Azure API status: ${response.status}`)
  }

  const data: AzureUsersResponse = await response.json()
  return data.value
}

export function mapAzureUserToDb(azureUser: AzureUser) {
  return {
    azureId: azureUser.id,
    name: azureUser.displayName,
    email: azureUser.userPrincipalName,
    jobTitle: azureUser.jobTitle || null,
    department: azureUser.department || null,
    companyName: azureUser.companyName || null,
    city: azureUser.city || null,
    isActive: azureUser.accountEnabled ?? true,
    azureCreatedAt: azureUser.createdDateTime ? new Date(azureUser.createdDateTime) : null
  }
}