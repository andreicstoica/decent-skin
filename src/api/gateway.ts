// Decaid assigns each skin its own port, but the REST and WebSocket API is
// always on 8080 of the same host.
const override = import.meta.env.VITE_GATEWAY_URL as string | undefined;

export const gatewayHttp =
  override?.replace(/\/$/, "") ?? `${window.location.protocol}//${window.location.hostname}:8080`;

export const gatewayWs = gatewayHttp.replace(/^http/, "ws");

export const restUrl = (path: string) => `${gatewayHttp}/api/v1${path}`;
export const wsUrl = (path: string) => `${gatewayWs}/ws/v1${path}`;
