import ct from 'city-timezones';

interface AzureConfig {
  tenantId: string
  clientId: string
  clientSecret: string
}

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
  '@odata.nextLink'?: string
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

// Access Token
export async function getAccessToken(companyPrefix: string): Promise<string> {
  const config = getAzureConfig(companyPrefix);
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
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
    throw new Error(`Token request failed for ${companyPrefix}: ${response.status} - ${errorText}`);
  }

  const data: TokenResponse = JSON.parse(await response.text());
  return data.access_token;
}

function getAzureConfig(companyPrefix: string): AzureConfig {
  const tenantId = process.env[`${companyPrefix}_AZURE_TENANT_ID`];
  const clientId = process.env[`${companyPrefix}_AZURE_CLIENT_ID`];
  const clientSecret = process.env[`${companyPrefix}_AZURE_CLIENT_SECRET`];

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(`Missing ${companyPrefix} Azure environment variables.`)
  }

  return { tenantId, clientId, clientSecret }
}

// User fetching
export async function fetchAzureUsers(token: string, companyName: string): Promise<AzureUser[]> {
  const selectFields = 'id,displayName,userPrincipalName,jobTitle,department,companyName,city,state,accountEnabled,createdDateTime';
  let url = `https://graph.microsoft.com/v1.0/users?$select=${selectFields}`;
  
  const allUsers: AzureUser[] = [];
  let pageCount = 0;
  
  while (url && pageCount < 50) {
    pageCount++;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure User API error: ${response.status} - ${errorText}`);
    }
    
    const data: AzureUsersResponse = await response.json();
    allUsers.push(...data.value);
    url = data['@odata.nextLink'] || '';
  }
  
  console.log(`Total users before filtering: ${allUsers.length}`);
  
  const filteredUsers = allUsers.filter(user => {
    const hasCompany = user.companyName && user.companyName === companyName;
    const isEnabled = user.accountEnabled === true;
    return hasCompany && isEnabled;
  });
  
  console.log(`Filtered users: ${filteredUsers.length}`);
  return filteredUsers;
}

export function mapAzureUserToDb(azureUser: AzureUser, locationId: number) {
  try {
    return {
      azureId: azureUser.id,
      name: azureUser.displayName,
      email: azureUser.userPrincipalName || '',
      jobTitle: azureUser.jobTitle || null,
      department: azureUser.department || null,
      companyName: azureUser.companyName || null,
      azureCreatedAt: azureUser.createdDateTime && azureUser.createdDateTime !== 'None' 
        ? new Date(azureUser.createdDateTime) 
        : null,
      locationId: locationId
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`User mapping failed for ${azureUser.displayName}: ${errorMessage}`);
  }
}

export function createLocationsFromUsers(users: AzureUser[]): AzureLocation[] {
  const uniqueLocations = new Map<string, AzureLocation>();

  users.forEach((user: AzureUser) => {
    try {
      if (!user.city) return;
      
      const city = user.city.trim();
      if (uniqueLocations.has(city)) return;

      let cityState = city;
      if (user.state && user.state.length === 2) {
        cityState = `${city} ${user.state.trim().toUpperCase()}`;
      }

      const locationInfo = getLocationInfo(cityState);
      
      if (locationInfo.timezone) {
        uniqueLocations.set(city, {
          name: city,
          state: locationInfo.state,
          timezone: locationInfo.timezone
        });
      } else {
        throw new Error(`Could not find location info for: ${city}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to process location for user ${user.displayName}: ${errorMessage}`);
    }
  });

  return Array.from(uniqueLocations.values())
}

function getLocationInfo(cityState: string): { state: string, timezone: string } {
  const locationData = ct.findFromCityStateProvince(cityState);

  if (locationData && locationData.length > 0) {
    const location = locationData[0];
    return {
      state: location.state_ansi || location.province || '',
      timezone: location.timezone || 'America/Denver'
    };
  }
  
  return getLocationInfoFallback(cityState);
}

function getLocationInfoFallback(cityState: string): { state: string; timezone: string } {
  const cityMappings: Record<string, { state: string; timezone: string }> = {
    'Greenwood Village CO': { state: 'CO', timezone: 'America/Denver' }, // city-timezones does not contain Greenwood Village
    'Abilene TX': { state: 'TX', timezone: 'America/Chicago' },
    'Tyler TX': { state: 'TX', timezone: 'America/Chicago' },
    'Rock Springs WY': { state: 'WY', timezone: 'America/Denver' }, // city-timezones does not contain Rock Springs
    'Denver Tech Center CO': { state: 'CO', timezone: 'America/Denver' } // city-timezones does not contain Denver Tech Center
  };
  
  return cityMappings[cityState] || { state: '', timezone: 'America/Denver' };
}

export function mapAzureLocationToDb(location: AzureLocation) {
  try {
    return {
      name: location.name,
      state: location.state,
      timezone: location.timezone
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Error'
    throw new Error(`Location mapping failed for ${location.name}: ${errorMessage}`)
  }
}

export function resolveUserLocationId(
  user: AzureUser, 
  locationMap: Map<string, number>
): number {
  // get location id that matches user's city
  const locationId = user.city? locationMap.get(user.city) : null;

  if (!locationId) {
    throw new Error(`Location ID of ${user.city} could not be retrieved for ${user.displayName}`);
  }
  
  return locationId;
}