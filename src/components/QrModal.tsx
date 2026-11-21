import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import qrcode from "qrcode-generator";
import { restUrl } from "../api/gateway";

const LAN_KEY = "decent-skin:lan-origin";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const QUIET = 4;

function storedLan() {
  try {
    return localStorage.getItem(LAN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Returns a clean http(s) origin, or null while the field is half typed. */
function parseOrigin(raw: string) {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `http://${text}`);
    if (!url.hostname || LOOPBACK.has(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * One path of unit squares in module space. The SVG scales it, and crispEdges
 * keeps module boundaries sharp at any size so phones read it at a glance.
 */
function QrSvg({ text }: { text: string }) {
  const { size, d } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let path = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) path += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
      }
    }
    return { size: count + QUIET * 2, d: path };
  }, [text]);

  return (
    <svg
      className="qr__svg"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code for the add bag form"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

export function QrModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const lanId = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Focus moves in on open and back to the button that opened it on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, []);

  // Auto-detect the device's LAN IP from Decaid's /api/v1/info so the QR works
  // out of the box without typing an IP address.
  const loopback = LOOPBACK.has(window.location.hostname);
  const { data: info } = useQuery({
    queryKey: ["decaid-info"],
    queryFn: async (): Promise<{ localIp?: string } | null> => {
      const res = await fetch(restUrl("/info"));
      return res.ok ? ((await res.json()) as { localIp?: string }) : null;
    },
    enabled: loopback,
    staleTime: 60_000,
  });

  const [lan, setLan] = useState(storedLan);
  const editLan = (value: string) => {
    setLan(value);
    try {
      localStorage.setItem(LAN_KEY, value.trim());
    } catch {
      // Private mode: the address still works for this session.
    }
  };

  const port = window.location.port;
  const detectedOrigin = info?.localIp
    ? `http://${info.localIp}${port ? `:${port}` : ""}`
    : null;
  const origin = loopback ? (parseOrigin(lan) ?? detectedOrigin) : window.location.origin;
  const url = origin ? `${origin}${window.location.pathname}?tab=beans&add=1` : null;

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        className="modal modal--qr"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal__body">
          <header className="modal__head modal__head--close">
            <div className="modal__titles">
              <h2 className="modal__h" id={titleId}>Add a bag from your phone</h2>
              <p className="modal__notes">
                Scan with the phone camera on the same Wi-Fi as this tablet.
              </p>
            </div>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          {loopback && !detectedOrigin && (
            <div className="qr__lan">
              <label className="lbl" htmlFor={lanId}>Tablet address on your network</label>
              <input
                id={lanId}
                className="search num"
                value={lan}
                onChange={(e) => editLan(e.target.value)}
                placeholder={`http://192.168.1.42:${window.location.port || "3000"}`}
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          )}

          <div className="qr">
            {url ? (
              <>
                <QrSvg text={url} />
                <span className="qr__url num">{url}</span>
              </>
            ) : (
              <p className="qr__empty">
                Enter the tablet's LAN address, such as http://192.168.1.42:{window.location.port || "80"}. Find
                it in the tablet's Wi-Fi details.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
