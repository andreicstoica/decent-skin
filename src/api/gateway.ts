/**
 * Decaid serves each skin from its own port on the gateway host, but the REST
 * and WebSocket API always live on 8080 of that same host. Deriving the base
 * from location.hostname means the built skin needs no configuration whether it
 * runs on the tablet, a desktop Decaid, or a phone browser on the LAN.
 */
const override = import.meta.env.VITE_GATEWAY_URL as string | undefined;

export const gatewayHttp =
  override?.replace(/\/$/, "") ?? `${window.location.protocol}//${window.location.hostname}:8080`;

export const gatewayWs = gatewayHttp.replace(/^http/, "ws");

export const restUrl = (path: string) => `${gatewayHttp}/api/v1${path}`;
export const wsUrl = (path: string) => `${gatewayWs}/ws/v1${path}`;
