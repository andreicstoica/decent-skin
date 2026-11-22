import { useMemo, useState } from "react";
import {
  useBeans,
  useSelectBean,
  useUpdateBatch,
  type Bean,
  type BeanBatchRecord,
  type BeanWithBatches,
} from "../api/useBeans";
import { useShots, type ShotSummary } from "../api/useShots";
import { useWorkflow } from "../api/useWorkflow";
import { BagModal } from "../components/BagModal";
import { QrModal } from "../components/QrModal";

function daysSince(iso?: string | null) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  return days === 0 ? "roasted today" : `${days}d off roast`;
}

function shownBatch(batches: BeanBatchRecord[], activeBatchId?: string) {
  return batches.find((b) => b.id === activeBatchId) ?? batches[0];
}

type Order = "recent" | "roaster";

const ORDERS: { id: Order; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "roaster", label: "By roaster" },
];

const time = (iso?: string | null) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : 0;
};

const fold = (text?: string | null) => (text ?? "").trim().toLocaleLowerCase();

const shotBatchId = (shot: ShotSummary) =>
  shot.workflow?.context?.beanBatchId;

function lastShotByBean(items: BeanWithBatches[], shots: ShotSummary[]) {
  const beanOfBatch = new Map<string, string>();
  const beanOfName = new Map<string, string>();
  for (const { bean, batches } of items) {
    for (const batch of batches) beanOfBatch.set(batch.id, bean.id);
    beanOfName.set(`${fold(bean.roaster)}|${fold(bean.name)}`, bean.id);
    if (!beanOfName.has(`|${fold(bean.name)}`)) beanOfName.set(`|${fold(bean.name)}`, bean.id);
  }
  const last = new Map<string, number>();
  for (const shot of shots) {
    const ctx = shot.workflow?.context;
    const batchId = shotBatchId(shot);
    const beanId =
      (batchId && beanOfBatch.get(batchId)) ||
      beanOfName.get(`${fold(ctx?.coffeeRoaster)}|${fold(ctx?.coffeeName)}`) ||
      beanOfName.get(`|${fold(ctx?.coffeeName)}`);
    if (!beanId) continue;
    const at = time(shot.timestamp);
    if (at > (last.get(beanId) ?? 0)) last.set(beanId, at);
  }
  return last;
}

const newestRoast = (batches: BeanBatchRecord[]) => Math.max(0, ...batches.map((b) => time(b.roastDate)));
const touched = (bean: Bean) => Math.max(time(bean.updatedAt), time(bean.createdAt));

function matches({ bean }: BeanWithBatches, query: string) {
  if (!query) return true;
  const hay = [bean.name, bean.roaster, bean.notes, bean.country, bean.region, bean.processing]
    .map(fold)
    .join(" ");
  return query.split(/\s+/).every((word) => hay.includes(word));
}

function isLoaded({ bean, batches }: BeanWithBatches, activeBatchId?: string, activeName?: string) {
  if (activeBatchId) return batches.some((b) => b.id === activeBatchId);
  return !!activeName && bean.name === activeName;
}

export function BeansView({ initialAdd = false }: { initialAdd?: boolean }) {
  const [qr, setQr] = useState(false);
  const { data: items, isLoading, isError, refetch } = useBeans(qr);
  const { data: workflow, refetch: refreshWorkflow } = useWorkflow(qr ? 5_000 : undefined);
  const { data: shots } = useShots(100);
  const selectBean = useSelectBean();
  const updateBatch = useUpdateBatch();

  const [modal, setModal] = useState<
    null | { mode: "add" } | { mode: "edit"; bean: Bean; batch?: BeanBatchRecord; loaded: boolean }
  >(initialAdd ? { mode: "add" } : null);
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<Order>("recent");

  const closeQr = () => {
    setQr(false);
    void refetch();
    void refreshWorkflow();
  };

  const activeBatchId = workflow?.context?.beanBatchId;
  const activeName = workflow?.context?.coffeeName;

  const lastShot = useMemo(() => lastShotByBean(items ?? [], shots ?? []), [items, shots]);
  const q = fold(query);
  const shown = useMemo(() => (items ?? []).filter((item) => matches(item, q)), [items, q]);

  const recent = useMemo(() => {
    const rank = (item: BeanWithBatches) => [
      isLoaded(item, activeBatchId, activeName) ? 1 : 0,
      lastShot.get(item.bean.id) ?? 0,
      touched(item.bean),
    ];
    return [...shown].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return rb[i] - ra[i];
      return 0;
    });
  }, [shown, lastShot, activeBatchId, activeName]);

  const byRoaster = useMemo(() => {
    const groups = new Map<string, { roaster: string; items: BeanWithBatches[] }>();
    for (const item of shown) {
      const key = fold(item.bean.roaster) || "—";
      const group = groups.get(key) ?? {
        roaster: (item.bean.roaster ?? "").trim() || "No roaster",
        items: [],
      };
      group.items.push(item);
      groups.set(key, group);
    }
    const newest = (item: BeanWithBatches) => newestRoast(item.batches) || touched(item.bean);
    return [...groups.values()]
      .sort((a, b) => a.roaster.localeCompare(b.roaster, undefined, { sensitivity: "base" }))
      .map((group) => ({ ...group, items: group.items.sort((a, b) => newest(b) - newest(a)) }));
  }, [shown]);

  if (isLoading) return <div className="panel" />;
  if (isError && !items) {
    return (
      <div className="panel">
        <div className="empty">
          <h2 className="empty__h">Could not load bags</h2>
          <button type="button" className="btn btn--quiet" onClick={() => void refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  const renderRow = (item: BeanWithBatches, showRoaster: boolean) => {
    const { bean, batches } = item;
    const latest = shownBatch(batches, activeBatchId);
    const active = isLoaded(item, activeBatchId, activeName);
    const loading = selectBean.isPending && selectBean.variables?.bean.id === bean.id;
    const age = daysSince(latest?.roastDate);
    const left = latest?.weightRemaining ?? latest?.weight;
    const sub = [
      showRoaster ? bean.roaster : null,
      bean.country,
      bean.processing,
      age,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <div className={`bag ${active ? "bag--on" : ""}`} key={bean.id}>
        <button
          type="button"
          className="bag__pick"
          onClick={() => !active && selectBean.mutate({ bean, batch: latest })}
          disabled={selectBean.isPending || item.batchesUnavailable}
          aria-current={active ? "true" : undefined}
        >
          <span className="bag__main">
            <span className="bag__title">
              <span className="bag__name truncate">{bean.name}</span>
              {active ? (
                <span className="tag tag--on">Loaded</span>
              ) : loading ? (
                <span className="tag tag--quiet">Loading…</span>
              ) : null}
              {latest?.frozen && <span className="tag tag--quiet">Frozen</span>}
              {bean.decaf && <span className="tag tag--quiet">Decaf</span>}
              {item.batchesUnavailable && <span className="tag tag--quiet">Roasts unavailable</span>}
            </span>
            {sub && <span className="row__sub truncate">{sub}</span>}
            {bean.notes && (
              <span className="row__sub truncate" title={bean.notes}>
                {bean.notes}
              </span>
            )}
          </span>
          <span className="bag__left num">
            {left ? (
              <>
                {Math.round(left)}
                <small>g</small>
              </>
            ) : (
              "—"
            )}
          </span>
        </button>
        {latest && (
          <button
            type="button"
            className={`btn btn--compact ${latest.frozen ? "" : "btn--quiet"}`}
            aria-pressed={Boolean(latest.frozen)}
            disabled={updateBatch.isPending}
            onClick={() => updateBatch.mutate({ id: latest.id, patch: { frozen: !latest.frozen } })}
          >
            {latest.frozen ? "Frozen" : "Freeze"}
          </button>
        )}
        <button
          type="button"
          className="btn btn--quiet btn--compact"
          onClick={() => setModal({ mode: "edit", bean, batch: latest, loaded: active })}
        >
          Edit
        </button>
      </div>
    );
  };

  if (!items?.length && !modal) {
    return (
      <div className="panel">
        <div className="empty">
          <h2 className="empty__h">No bags yet</h2>
          <p className="empty__p">Add a bag here, or scan the QR from your phone.</p>
          <div className="actions">
            <button type="button" className="btn btn--quiet" onClick={() => setQr(true)}>
              Add from phone
            </button>
            <button type="button" className="btn" onClick={() => setModal({ mode: "add" })}>
              Add first bag
            </button>
          </div>
        </div>
        {qr && <QrModal onClose={closeQr} />}
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="sheet">
        {selectBean.isError && <p className="err" role="alert">Could not load the bag. Try again.</p>}
        <div className="beans__bar">
          <input
            className="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coffee, roaster, origin, notes"
            aria-label="Search bags"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          <div className="seg" role="group" aria-label="Sort bags">
            {ORDERS.map((o) => (
              <button
                type="button"
                key={o.id}
                className={`seg__b ${order === o.id ? "seg__b--on" : ""}`}
                aria-pressed={order === o.id}
                onClick={() => setOrder(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--quiet" onClick={() => setQr(true)}>
            Phone QR
          </button>
          <button type="button" className="btn" onClick={() => setModal({ mode: "add" })}>
            Add bag
          </button>
        </div>

        {shown.length === 0 ? (
          <div className="empty empty--inline">
            <h2 className="empty__h">Nothing matches “{query}”</h2>
            <p className="empty__p">Clear the search to see all {items?.length ?? 0} bags.</p>
          </div>
        ) : order === "recent" ? (
          <div className="rows">{recent.map((item) => renderRow(item, true))}</div>
        ) : (
          byRoaster.map((group) => (
            <section className="roaster" key={group.roaster}>
              <div className="groupbar groupbar--plain">
                <span className="lbl">{group.roaster}</span>
                <span className="lbl groupbar__n num">{group.items.length}</span>
              </div>
              <div className="rows">{group.items.map((item) => renderRow(item, false))}</div>
            </section>
          ))
        )}
      </div>

      {modal && (
        <BagModal
          key={modal.mode === "edit" ? `${modal.bean.id}:${modal.batch?.id ?? ""}` : "new"}
          bean={modal.mode === "edit" ? modal.bean : undefined}
          batch={modal.mode === "edit" ? modal.batch : undefined}
          loaded={modal.mode === "edit" ? modal.loaded : false}
          onClose={() => setModal(null)}
        />
      )}
      {qr && <QrModal onClose={closeQr} />}
    </div>
  );
}
