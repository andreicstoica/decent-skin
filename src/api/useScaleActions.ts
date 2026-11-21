import { useMutation } from "@tanstack/react-query";
import { restUrl } from "./gateway";

export type TareScaleResult =
  | { ok: true; blocked: false }
  | { ok: false; blocked: true; message: "Tare blocked during shot" }
  | { ok: false; blocked: false; message: "No scale connected" };

export function useConnectScale() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(
        restUrl("/devices/scan?connect=true&connectPreferredScaleEarly=true"),
      );
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    },
  });
}

export function useTareScale() {
  return useMutation({
    mutationFn: async (): Promise<TareScaleResult> => {
      const res = await fetch(restUrl("/scale/tare"), { method: "PUT" });
      if (res.ok) return { ok: true, blocked: false };
      if (res.status === 404) return { ok: false, blocked: false, message: "No scale connected" };
      if (res.status === 400) {
        const body = (await res.json().catch(() => null)) as { type?: string } | null;
        if (body?.type === "block_tare_during_shot") {
          return { ok: false, blocked: true, message: "Tare blocked during shot" };
        }
      }
      throw new Error(`Gateway returned ${res.status}`);
    },
  });
}
