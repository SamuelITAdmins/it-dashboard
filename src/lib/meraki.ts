import { apiRequest, isApiError } from "@cisco-meraki/dashboard-api-tools";

interface Device {
  name: string
  network: {
    id: string
  }
  productType: string
  serial: string
  status: string
  updateHistory?: ChangeHistory[]
  uptimePercentage?: number
  tempReading?: number
  humidityReading?: number
}

interface Organization {
  name: string
  id: string
}

interface DeviceStatuses {
  counts: {
    byStatus: {
      online: number
      alerting: number
      offline: number
      dormant: number
    }
  }
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

interface SensorReading {
  serial: string
  readings: Array<{
    metric: string  // "temperature", "humidity", etc.
    ts: string
    temperature?: {
      fahrenheit: number
      celsius: number
    };
    humidity?: {
      relativePercentage: number
    };
  }>;
}

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
  } catch (badResponse) {
    if (isApiError(badResponse)) {
      throw new Error(`Failed to get organization ID. ${badResponse.statusCode}: ${badResponse.statusText}`)
    } else {
      console.log(badResponse)
      throw new Error('An unexpected error occurred while fetching organization ID.')
    }
  }
}

export async function fetchDeviceStatuses(orgId: string, networkIds?: string[]): Promise<DeviceStatuses> {
  const deviceTypes = ['switch', 'wireless', 'sensor'];
  const productTypesQuery = deviceTypes.map(type => `productTypes[]=${type}`).join('&');
  console.log(productTypesQuery)
  const fullQuery = networkIds ? productTypesQuery.concat(networkIds.map(id => `networkIds[]=${id}`).join('&')) : productTypesQuery;

  try {
    const response = await apiRequest<DeviceStatuses> (
      "GET",
      `https://api.meraki.com/api/v1/organizations/${orgId}/devices/statuses/overview?${fullQuery}`,
      undefined,
      {
        auth: {
          apiKey: process.env.MERAKI_API_KEY
        }
      }
    );

    if (response.ok && response.data) {
      return response.data
    } else {
      throw new Error('No device statuses found.')
    }
  } catch (badResponse) {
    if (isApiError(badResponse)) {
      throw new Error(`Failed to get device statuses. ${badResponse.statusCode}: ${badResponse.statusText}`)
    } else {
      console.log(badResponse)
      throw new Error('An unexpected error occurred while fetching device statuses.')
    }
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
  } catch (badResponse) {
    if (isApiError(badResponse)) {
      throw new Error(`Failed to get devices. ${badResponse.statusCode}: ${badResponse.statusText}`)
    } else {
      console.log(badResponse)
      throw new Error('An unexpected error occurred while fetching devices.')
    }
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
      
      // Create a Map for efficient lookups
      const historyBySerial = new Map<string, ChangeHistory[]>();
      
      fullHistory.forEach(record => {
        const serial = record.device.serial;
        if (!historyBySerial.has(serial)) {
          historyBySerial.set(serial, []);
        }
        historyBySerial.get(serial)!.push(record);
      });

      // Return new array with updateHistory added
      return devices.map(device => ({
        ...device,
        updateHistory: historyBySerial.get(device.serial) || []
      }));
    } else {
      throw new Error(`Unknown device history error.`);
    }
  } catch (badResponse) {
    if (isApiError(badResponse)) {
      throw new Error(`Failed to get device histories. ${badResponse.statusCode}: ${badResponse.statusText}`)
    } else {
      console.log(badResponse)
      throw new Error('An unexpected error occurred while fetching device histories.')
    }
  }
}

export async function fetchLatestSensorReadings(orgId: string, devices: Device[]): Promise<Device[]> {
  try {
    const response = await apiRequest<SensorReading[]> (
      "GET",
      `https://api.meraki.com/api/v1/organizations/${orgId}/sensor/readings/latest`,
      undefined,
      {
        auth: {
          apiKey: process.env.MERAKI_API_KEY
        }
      }
    );

    if (response.ok) {
      // create a Map for O(1) lookups
      const sensorDataMap = new Map(
        response.data.map(reading => {
          const tempReading = reading.readings.find(r => r.metric === 'temperature');
          const humidityReading = reading.readings.find(r => r.metric === 'humidity');
          return [
            reading.serial, 
            {
              temperature: tempReading?.temperature?.fahrenheit, 
              humidity: humidityReading?.humidity?.relativePercentage
            }
          ];
        })
      );

      // Return new array instead of mutating input
      return devices.map(device => ({
        ...device,
        tempReading: sensorDataMap.get(device.serial)?.temperature ?? device.tempReading,
        humidityReading: sensorDataMap.get(device.serial)?.humidity ?? device.humidityReading
      }));
    } else {
      throw new Error('Unknown latest sensor readings error.')
    }
  } catch (badResponse) {
    if (isApiError(badResponse)) {
      throw new Error(`Failed to get sensor readings. ${badResponse.statusCode}: ${badResponse.statusText}`);
    } else {
      console.log(badResponse);
      throw new Error('An unexpected error occured while fetching sensor readings.');
    }
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

      // update start time and status
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

export function mapMerakiDeviceToDb(device: Device) {
  try {
    return {
      merakiDeviceId: device.serial,
      name: device.name,
      productType: device.productType,
      status: device.status,
      uptimePercentage: device.uptimePercentage ?? 0,
      sensorTemperature: device.tempReading,
      sensorHumidity: device.humidityReading
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Error'
    throw new Error(`Device mapping failed for ${device.name}: ${errorMessage}`)
  }
}