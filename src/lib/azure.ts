import ct from 'city-timezones';
import { Azeret_Mono } from 'next/font/google';

interface AzureUser {
  id: string
  displayName: string
  userPrincipalName?: string
  jobTitle?: string
  department?: string
  companyName?: string
  city?: string
  state?: string
  accountEnabled?: boolean
  createdDateTime?: string
}

interface AzureLocation {
  name: string
  state: string
  timezone: string
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
  const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
  
  if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    throw new Error('Missing Azure environment variables');
  }
  
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token request failed:', response.status, errorText);
    throw new Error(`Token request failed: ${response.status} - ${errorText}`);
  }

  const data: TokenResponse = JSON.parse(await response.text());
  return data.access_token;
}

export async function fetchAzureUsers(): Promise<AzureUser[]> {
  const token = await getAccessToken();
  
  const selectFields = 'id,displayName,userPrincipalName,jobTitle,department,companyName,city,state,accountEnabled,createdDateTime';
  let url = `https://graph.microsoft.com/v1.0/users?$select=${selectFields}`;
  
  const allUsers: AzureUser[] = [];
  let pageCount = 0;
  
  while (url && pageCount < 50) { // Safety limit
    pageCount++;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Graph API error:', response.status, errorText);
      throw new Error(`Graph API error: ${response.status} - ${errorText}`);
    }
    
    const data: AzureUsersResponse = await response.json();
    
    allUsers.push(...data.value);
    url = data['@odata.nextLink'] || '';
  }
  
  console.log(`Total users before filtering: ${allUsers.length}`);
  
  // Filter out none company and disabled users
  const filteredUsers = allUsers.filter(user => {
    const hasCompany = user.companyName && user.companyName !== 'None';
    const isEnabled = user.accountEnabled === true;
    return hasCompany && isEnabled;
  });
  
  console.log(`Filtered users: ${filteredUsers.length}`);
  
  return filteredUsers;
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
  };
}

function getLocationInfo(cityState: string): { state: string, timezone: string } {
  const locationData = ct.findFromCityStateProvince(cityState)

  if (locationData && locationData.length > 0) {
    const location = locationData[0];
    return {
      state: location.state_ansi || location.province || '',
      timezone: location.timezone || 'America/Denver'
    };
  }
  
  // fallback to your hardcoded mappings for edge cases
  return getLocationInfoFallback(cityState);
}

function getLocationInfoFallback(cityState: string): { state: string; timezone: string } {
  const cityMappings: Record<string, { state: string, timezone: string }> = {
    'Greenwood Village CO': { state: 'CO', timezone: 'America/Denver' },
    'Abilene TX': { state: 'TX', timezone: 'America/Chicago' },
    'Tyler TX': { state: 'TX', timezone: 'America/Chicago' },
    'Rock Springs WY': { state: 'WY', timezone: 'America/Denver' }
  };
  
  return cityMappings[cityState] || { state: '', timezone: 'America/Denver' };
}

export function createLocationsFromUsers(users: AzureUser[]): AzureLocation[] {
  const uniqueLocations = new Map<string, AzureLocation>();

  users.forEach((user: AzureUser) => {
    if (!user.city) return;

    const city = user.city.trim()
    if (uniqueLocations.has(city)) return;

    // build city + state string
    let cityState = city
    if (user.state && user.state.length === 2) {
      const cityState = `${user.city} ${user.state.trim().toUpperCase()}`;
      if (!cityState || cityState === 'None' || uniqueLocations.has(cityState)) return;
    }

    const locationInfo = getLocationInfo(cityState);
    
    if (locationInfo.timezone) {
      uniqueLocations.set(city, {
        name: city,
        state: locationInfo.state,
        timezone: locationInfo.timezone
      });
    } else {
      console.warn(`Could not find location for ${user.displayName}: ${city}`);
    }
  });

  return Array.from(uniqueLocations.values());
}

export function mapAzureLocationToDb(azureLocation: AzureLocation) {
  return {
    name: azureLocation.name,
    state: azureLocation.state,
    timezone: azureLocation.timezone
  }
}

// TODO: Store place data in Azure/Microsoft 365
export async function fetchAzureLocations() {
  try {
    const token = await getAccessToken();
    const url = 'https://graph.microsoft.com/v1.0/places/microsoft.graph.roomList';

    const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Success data:', data);
    return data;

  } catch (error) {
    console.error('Full error details:', error);
    throw error;
  }
}