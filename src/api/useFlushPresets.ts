import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";
import { useWorkflow, writeWorkflow } from "./useWorkflow";
import { activeFlushId, editFlushPreset, isFlushValues, parseFlushPresets, type FlushPresetId, type FlushValues } from "./flushPresets";

const key = ["flush-presets"] as const;
const url = restUrl("/store/decent-skin/flush-presets");
async function read() {
  const res = await fetch(url);
  if (res.status === 404) return parseFlushPresets(null);
  if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
  return parseFlushPresets(await res.json());
}
type Action = { id: FlushPresetId; patch?: Partial<FlushValues> };
export function useFlushPresets() {
  const client = useQueryClient();
  const { data: workflow } = useWorkflow();
  const query = useQuery({ queryKey: key, queryFn: read });
  const applied = workflow?.rinseData;
  const presets = query.data;
  const activeId = presets ? activeFlushId(presets, applied) : "custom";
  const mutation = useMutation({
    mutationKey: key,
    scope: { id: "flush-presets" },
    mutationFn: async ({ id, patch }: Action) => {
      const saved = await read();
      // Read the applied workflow at execution time, not a stale render snapshot.
      const response = await fetch(restUrl("/workflow"));
      if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
      const current: unknown = (await response.json()).rinseData;
      if (!isFlushValues(current)) throw new Error("Flush settings are unavailable");
      const next = patch
        ? editFlushPreset(saved, id, current, patch)
        : { ...saved, activeId: id, [id]: saved[id] ?? current };
      await writeWorkflow({ rinseData: next[id]! });
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ["workflow"] }),
      ]);
    },
  });
  return { presets, applied, activeId, mutation, failed: query.isError || mutation.isError };
}
