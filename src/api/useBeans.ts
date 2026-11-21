import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { restUrl } from "./gateway";

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
}

export function useBeans() {
  return useQuery({
    queryKey: ["beans"],
    queryFn: async (): Promise<BeanWithBatches[]> => {
      const res = await fetch(restUrl("/beans?includeArchived=false"));
      if (!res.ok) return [];
      const beans = (await res.json()) as Bean[];
      const withBatches = await Promise.all(
        beans.map(async (bean) => {
          try {
            const bRes = await fetch(restUrl(`/beans/${bean.id}/batches?includeArchived=false`));
            const batches = bRes.ok ? ((await bRes.json()) as BeanBatchRecord[]) : [];
            return { bean, batches };
          } catch {
            return { bean, batches: [] };
          }
        }),
      );
      return withBatches;
    },
    staleTime: 30_000,
  });
}

export interface NewBagInput {
  roaster: string;
  name: string;
  country?: string;
  region?: string;
  producer?: string;
  processing?: string;
  variety?: string[];
  decaf?: boolean;
  frozen?: boolean;
  roastDate?: string;
  roastLevel?: string;
  weight?: number;
  notes?: string;
  selectNow?: boolean;
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

/**
 * Creates a Bean + initial BeanBatch in Decaid, and optionally loads it into
 * the current workflow so the next shot is tagged automatically.
 */
export function useAddBag() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewBagInput) => {
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
      const bean = (await beanRes.json()) as Bean;

      const batchBody: BatchPatch = {};
      if (input.roastDate) {
        batchBody.roastDate = new Date(`${input.roastDate}T00:00:00Z`).toISOString();
      }
      if (input.roastLevel?.trim()) {
        batchBody.roastLevel = input.roastLevel.trim();
      }
      if (input.weight && Number.isFinite(input.weight)) {
        batchBody.weight = input.weight;
      }
      if (input.frozen) {
        batchBody.frozen = true;
      }

      const batch = await createBatch(bean.id, batchBody);

      if (input.selectNow !== false) {
        await fetch(restUrl("/workflow"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: {
              beanBatchId: batch.id,
              coffeeName: bean.name,
              coffeeRoaster: bean.roaster,
            },
          }),
        });
      }

      return { bean, batch };
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["beans"] });
      client.invalidateQueries({ queryKey: ["workflow"] });
    },
  });
}

export function useSelectBean() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ bean, batch }: { bean: Bean; batch?: BeanBatchRecord }) => {
      let activeBatch = batch;
      if (!activeBatch) {
        const res = await fetch(restUrl(`/beans/${bean.id}/batches`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.ok) activeBatch = (await res.json()) as BeanBatchRecord;
      }

      const res = await fetch(restUrl("/workflow"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            beanBatchId: activeBatch?.id,
            coffeeName: bean.name,
            coffeeRoaster: bean.roaster,
          },
        }),
      });
      if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["workflow"] });
      client.invalidateQueries({ queryKey: ["beans"] });
    },
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
