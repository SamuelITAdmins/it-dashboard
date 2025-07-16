import { apiRequest } from "@cisco-meraki/dashboard-api-tools";

interface Device {
  name: string
  productType: string
  serial: string
  status: string
  updateHistory?: ChangeHistory[]
}

interface Organization {
  name: string
  id: string
}

interface ChangeHistory {
  ts: Date
  device: {
    serial: string
  }
  details: {
    old: {
      name: string
      value: string
    }
    new: {
      name: string
      value: string
    }
  }
  network: {
    name: string
  }
}

// const ORGANIZATION_URL = `/organizations/${organizationId}`
// const NETWORK_URL = `/networks/${networkId}`
// const DEVICE_STATUSES_URL = `/organizations/${organizationId}/devices/statuses/overview`
// const DEVICE_HISTORY_URL = `/organizations/${organizationId}/devices/availabilities/changeHistory`

export async function getOrgId(): Promise<string> {
  try {
    const response = await apiRequest<Organization[]> (
      "GET",
      "https://api.meraki.com/api/v1/organizations",
      undefined, // No data body for GET requests
      {
        auth: {
          apiKey: process.env.MERAKI_API_KEY!
        }
      }
    );
    
    if (response.ok && response.data.length > 0) {
      return response.data[0].id;
    } else {
      throw new Error("No organizations found");
    }
  } catch (error) {
    throw new Error(`Failed to get organization ID: ${error}`);
  }
}

export async function fetchDevices(orgId: string): Promise<Device[]> {
  try {
    const response = await apiRequest<Device[]> (
      "GET",
      `https://api.meraki.com/api/v1/organizations/${orgId}/devices/availabilities`,
      undefined,
      {
        auth: {
          apiKey: process.env.MERAKI_API_KEY
        }
      }
    );

    if (response.ok && response.data.length > 0) {
      console.log(response.data.length)
      return response.data
    } else {
      throw new Error("No devices found");
    }
  } catch (error) {
    throw new Error(`Failed to get devices availabilities: ${error}`)
  }
}

export async function fetchDeviceHistories(orgId: string, devices: Device[], reportLength?: number): Promise<Device[]> {
  try {
    const response = await apiRequest<ChangeHistory[]> (
      "GET",
      `https://api.meraki.com/api/v1/organizations/${orgId}/devices/availabilities/changeHistory`,
      undefined,
      {
        auth: {
          apiKey: process.env.MERAKI_API_KEY
        }
      }
    );

    if (response.ok) {
      const fullHistory = response.data

      devices.forEach((device: Device) => {
        device.updateHistory = fullHistory.filter(record => record.device.serial === device.serial)
      });

      return devices
    } else {
      throw new Error(`Unknown device history error.`)
    }
  } catch (error) {
    throw new Error(`Failed to get device histories: ${error}`)
  }
}

// export async function calculateUptimes(devices: Device[])