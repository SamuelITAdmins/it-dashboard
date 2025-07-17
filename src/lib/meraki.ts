import { apiRequest } from "@cisco-meraki/dashboard-api-tools";

interface Device {
  name: string
  productType: string
  serial: string
  status: string
  updateHistory?: ChangeHistory[]
  uptimePercentage?: number
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
    old: [{
      value: string
    }]
    new: [{
      value: string
    }]
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
      console.log(response.data[0].id);
      return response.data[0].id;
    } else {
      throw new Error("No organizations found");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get organization ID: ${errorMessage}`);
  }
}

export async function fetchDevices(orgId: string): Promise<Device[]> {
  const deviceTypes = ['switch','wireless','sensor'];
  const productTypesQuery = deviceTypes.map(type => `productTypes[]=${type}`).join('&');

  try {
    const response = await apiRequest<Device[]> (
      "GET",
      `https://api.meraki.com/api/v1/organizations/${orgId}/devices/availabilities?${productTypesQuery}`,
      undefined,
      {
        auth: {
          apiKey: process.env.MERAKI_API_KEY
        }
      }
    );

    if (response.ok && response.data.length > 0) {
      return response.data;
    } else {
      throw new Error("No devices found");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get devices availabilities: ${errorMessage}`);
  }
}

export async function fetchDeviceHistories(orgId: string, devices: Device[], reportLength?: number): Promise<Device[]> {
  const reportTimeSecs = reportLength ? reportLength*24*60*60 : 7*24*60*60;
  const deviceTypes = ['switch','wireless','sensor'];
  const productTypesQuery = deviceTypes.map(type => `productTypes[]=${type}`).join('&');

  try {
    const response = await apiRequest<ChangeHistory[]> (
      "GET",
      `https://api.meraki.com/api/v1/organizations/${orgId}/devices/availabilities/changeHistory?timespan=${reportTimeSecs}&${productTypesQuery}`,
      undefined,
      {
        auth: {
          apiKey: process.env.MERAKI_API_KEY
        }
      }
    );

    if (response.ok) {
      const fullHistory = response.data.reverse(); // put in chronological order

      devices.forEach((device: Device) => {
        device.updateHistory = fullHistory.filter(record => record.device.serial === device.serial);
      });

      return devices;
    } else {
      throw new Error(`Unknown device history error.`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get devices histories: ${errorMessage}`);
  }
}

// TODO: Calculate uptimes only during core work hours for APs
export function calculateUptimes(devices: Device[], reportLength?: number) {
  if (!devices) {
    throw new Error("No devices found for calculating uptimes.");
  }

  devices.forEach((device: Device) => {
    let uptimeMS = 0;

    // initialize time and status
    const present = new Date();
    const daysBack = reportLength || 7;
    const reportStartTime = new Date(present);
    reportStartTime.setDate(reportStartTime.getDate() - daysBack);

    let startTime = reportStartTime;
    let startStatus = device.updateHistory?.[0]?.details.old[0].value || device.status;

    device.updateHistory?.forEach((entry: ChangeHistory) => {
      const changeTime = new Date(entry.ts);

      // calculate uptime
      if (startStatus === 'online') {
        uptimeMS += changeTime.getTime() - startTime.getTime();
      }

      // update times and statuses
      startTime = changeTime;
      startStatus = entry.details.new[0].value;
    });

    // add uptime from last status change to present
    if (startStatus === 'online') {
      uptimeMS += present.getTime() - startTime.getTime();
    }

    const totalReportTime = present.getTime() - reportStartTime.getTime();
    device.uptimePercentage = (uptimeMS / totalReportTime) * 100;
  });
}