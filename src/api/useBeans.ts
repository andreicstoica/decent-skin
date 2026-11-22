import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";
import { writeWorkflow } from "./useWorkflow";

export interface Bean {
  id: string;
  roaster: string;
  name: string;
  country?: string | null;
  region?: string | null;
  processing?: string | null;
  variety?: string[] | null;
  notes?: string | null;
  decaf?: boolean;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BeanBatchRecord {
  id: string;
  beanId: string;
  roastDate?: string | null;
  roastLevel?: string | null;
  weight?: number | null;
  weightRemaining?: number | null;
  price?: number | null;
  currency?: string | null;
  frozen?: boolean;
  archived?: boolean;
}

export interface BeanWithBatches {
  bean: Bean;
  batches: BeanBatchRecord[];
  batchesUnavailable?: true;
}

export function useBeans(live = false) {
  return useQuery({
    queryKey: ["beans"],
    queryFn: async ({ signal }): Promise<BeanWithBatches[]> => {
      // Let the browser revalidate Decaid's ETags without custom CORS headers.
      const revalidate = { signal, cache: "no-cache" } as const;
      const [res, batchesResponse] = await Promise.all([
        fetch(restUrl("/beans?includeArchived=false"), revalidate),
        fetch(restUrl("/bean-batches?includeArchived=false"), revalidate),
      ]);
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
      const beans = (await res.json()) as Bean[];
      if (batchesResponse.ok) {
        const byBean = new Map<string, BeanBatchRecord[]>();
        for (const batch of (await batchesResponse.json()) as BeanBatchRecord[]) {
          const batches = byBean.get(batch.beanId);
          if (batches) batches.push(batch);
          else byBean.set(batch.beanId, [batch]);
        }
        return beans.map((bean) => ({ bean, batches: byBean.get(bean.id) ?? [] }));
      }
      if (batchesResponse.status !== 404 && batchesResponse.status !== 405) {
        return beans.map((bean) => ({ bean, batches: [], batchesUnavailable: true }));
      }
      // Older Decaid releases only expose per-bean batch lists.
      const withBatches = await Promise.all(
        beans.map(async (bean) => {
          const batches = await fetch(restUrl(`/beans/${bean.id}/batches?includeArchived=false`), revalidate)
            .then(async (response): Promise<BeanBatchRecord[]> => {
              if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
              return response.json();
            })
            .catch(() => null);
          return batches ? { bean, batches } : { bean, batches: [], batchesUnavailable: true as const };
        }),
      );
      return withBatches;
    },
    staleTime: 30_000,
    refetchInterval: live ? 5_000 : false,
  });
}

interface NewBeanInput {
  roaster: string;
  name: string;
  country?: string;
  region?: string;
  producer?: string;
  processing?: string;
  variety?: string[];
  decaf?: boolean;
  notes?: string;
}

export type BeanPatch = Partial<Omit<Bean, "id" | "createdAt" | "updatedAt">>;
export type BatchPatch = Partial<Omit<BeanBatchRecord, "id" | "beanId">>;

function batchPayload(batch: BatchPatch): BatchPatch {
  if (batch.roastDate && /^\d{4}-\d{2}-\d{2}$/.test(batch.roastDate)) {
    return { ...batch, roastDate: new Date(`${batch.roastDate}T00:00:00Z`).toISOString() };
  }
  return batch;
}

async function createBatch(beanId: string, batch: BatchPatch): Promise<BeanBatchRecord> {
  const res = await fetch(restUrl(`/beans/${beanId}/batches`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batchPayload(batch)),
  });
  if (!res.ok) throw new Error(`Create batch failed (${res.status})`);
  return (await res.json()) as BeanBatchRecord;
}

export function useAddBean() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewBeanInput) => {
      const beanRes = await fetch(restUrl("/beans"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roaster: input.roaster.trim(),
          name: input.name.trim(),
          ...(input.country?.trim() ? { country: input.country.trim() } : {}),
          ...(input.region?.trim() ? { region: input.region.trim() } : {}),
          ...(input.producer?.trim() ? { producer: input.producer.trim() } : {}),
          ...(input.processing?.trim() ? { processing: input.processing.trim() } : {}),
          ...(input.variety?.length ? { variety: input.variety } : {}),
          ...(input.decaf ? { decaf: true } : {}),
          ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        }),
      });
      if (!beanRes.ok) throw new Error(`Create bean failed (${beanRes.status})`);
      return (await beanRes.json()) as Bean;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["beans"] }),
  });
}

export function useSelectBean() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ bean, batch }: { bean: Bean; batch?: BeanBatchRecord }) => {
      const activeBatch = batch ?? await createBatch(bean.id, {});
      try {
        await writeWorkflow({
          context: {
            beanBatchId: activeBatch.id,
            coffeeName: bean.name,
            coffeeRoaster: bean.roaster,
          },
        });
      } finally {
        if (!batch) await client.invalidateQueries({ queryKey: ["beans"] });
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["workflow"] }),
  });
}

async function updateBean(id: string, patch: BeanPatch) {
  const res = await fetch(restUrl(`/beans/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
}

export function useArchiveBean() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (beanId: string) => updateBean(beanId, { archived: true }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["beans"] }),
  });
}

export function useUpdateBean() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BeanPatch }) => updateBean(id, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: ["beans"] }),
  });
}

export function useAddBatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ beanId, batch }: { beanId: string; batch: BatchPatch }) => createBatch(beanId, batch),
    onSuccess: (batch) => Promise.all([
      client.invalidateQueries({ queryKey: ["beans"] }),
      client.invalidateQueries({ queryKey: ["bean-batch", batch.id] }),
    ]),
  });
}

export function useUpdateBatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: BatchPatch }) => {
      const res = await fetch(restUrl(`/bean-batches/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchPayload(patch)),
      });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    },
    onSuccess: (_data, { id }) => Promise.all([
      client.invalidateQueries({ queryKey: ["beans"] }),
      client.invalidateQueries({ queryKey: ["bean-batch", id] }),
    ]),
  });
}
