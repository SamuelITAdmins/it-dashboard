import { apiRequest } from "@cisco-meraki/dashboard-api-tools";

interface Device {
  name: string
  productType: string
  serial: string
  status: string
}

interface DevicesResponse {
  devices: Device[]
}

// const ORGANIZATION_URL = `/organizations/${organizationId}`
// const NETWORK_URL = `/networks/${networkId}`
// const DEVICE_STATUSES_URL = `/organizations/${organizationId}/devices/statuses/overview`
// const DEVICE_HISTORY_URL = `/organizations/${organizationId}/devices/availabilities/changeHistory`

async function getReqVars() {
  const organization_url = `https://api.meraki.com/api/v1/organizations`
  const organization = await apiRequest(
    "GET",
    organization_url,
    {
      auth: {
        api_key: process.env.MERAKI_API_KEY
      }
    }
  )
  console.log(organization)
}

export async function fetchDevices() {
  const organizationId = getReqVars()

  const allDevices: Device[] = []

  const device_statuses_url = `api/v1/organizations/${organizationId}/devices/availabilities?productTypes=['switch','wireless']`
  try {
    const devices = await apiRequest (
      "GET",
      device_statuses_url,
      {
        auth: {
          api_key: process.env.MERAKI_API_KEY
        }
      }
    );

    return devices
  } catch (badResponse) {
    throw new Error("Bad Meraki Response")
  }
}