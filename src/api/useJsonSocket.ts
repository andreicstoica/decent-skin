import { useEffect, useRef, useState } from "react";
import { wsUrl } from "./gateway";

type SocketState = "connecting" | "open" | "closed";

/**
 * Reconnects on socket closure only. Decaid keeps telemetry sockets open across
 * machine power cycles and emits no status frame, so a gap in frames is not
 * evidence the socket died and must not trigger a reconnect.
 */
export function useJsonSocket<T>(path: string, onFrame: (frame: T) => void) {
  const [state, setState] = useState<SocketState>("connecting");
  const handler = useRef(onFrame);
  handler.current = onFrame;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      setState("connecting");
      socket = new WebSocket(wsUrl(path));

      socket.onopen = () => {
        attempt = 0;
        setState("open");
      };

      socket.onmessage = (event) => {
        try {
          handler.current(JSON.parse(event.data) as T);
        } catch {
          // A malformed frame must not tear down a working stream.
        }
      };

      socket.onclose = () => {
        setState("closed");
        if (disposed) return;
        const backoff = Math.min(1000 * 2 ** attempt++, 15000);
        retryTimer = window.setTimeout(connect, backoff);
      };

      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [path]);

  return state;
}
