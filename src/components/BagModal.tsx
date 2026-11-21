import { useEffect, useId, useRef, useState } from "react";
import {
  useAddBag,
  useAddBatch,
  useArchiveBean,
  useSelectBean,
  useUpdateBatch,
  useUpdateBean,
  type Bean,
  type BeanBatchRecord,
} from "../api/useBeans";
import { useUpdateWorkflow } from "../api/useWorkflow";

const today = () => new Date().toISOString().slice(0, 10);

interface BagModalProps {
  /** Omit to create a new bag; pass to edit an existing bean & its active batch. */
  bean?: Bean;
  batch?: BeanBatchRecord;
  loaded?: boolean;
  onClose: () => void;
}

export function BagModal({ bean, batch, loaded = false, onClose }: BagModalProps) {
  const isEdit = !!bean;
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

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

  const addBag = useAddBag();
  const updateBean = useUpdateBean();
  const updateBatch = useUpdateBatch();
  const addBatch = useAddBatch();
  const selectBean = useSelectBean();
  const archiveBean = useArchiveBean();
  const updateWorkflow = useUpdateWorkflow();

  const [roaster, setRoaster] = useState(bean?.roaster ?? "");
  const [name, setName] = useState(bean?.name ?? "");
  const [country, setCountry] = useState(bean?.country ?? "");
  const [region, setRegion] = useState(bean?.region ?? "");
  const [processing, setProcessing] = useState(bean?.processing ?? "");
  const [variety, setVariety] = useState(bean?.variety?.join(", ") ?? "");
  const [roastLevel, setRoastLevel] = useState(batch?.roastLevel ?? "");
  const [roastDate, setRoastDate] = useState(
    batch?.roastDate ? batch.roastDate.slice(0, 10) : today(),
  );
  const [weight, setWeight] = useState(
    String(batch?.weightRemaining ?? batch?.weight ?? 250),
  );
  const [notes, setNotes] = useState(bean?.notes ?? "");
  const [decaf, setDecaf] = useState(Boolean(bean?.decaf));
  const [frozen, setFrozen] = useState(Boolean(batch?.frozen));
  const [armedArchive, setArmedArchive] = useState(false);

  useEffect(() => {
    if (!armedArchive) return;
    const t = setTimeout(() => setArmedArchive(false), 4000);
    return () => clearTimeout(t);
  }, [armedArchive]);

  const ready = !!roaster.trim() && !!name.trim();
  const pending =
    addBag.isPending ||
    updateBean.isPending ||
    updateBatch.isPending ||
    addBatch.isPending ||
    archiveBean.isPending;
  const failed =
    addBag.isError ||
    updateBean.isError ||
    updateBatch.isError ||
    addBatch.isError ||
    archiveBean.isError;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || pending) return;
    const parsedWeight = Number.parseFloat(weight);
    const validWeight = Number.isFinite(parsedWeight) && parsedWeight >= 0 ? parsedWeight : undefined;
    const varieties = variety
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (!isEdit) {
        await addBag.mutateAsync({
          roaster: roaster.trim(),
          name: name.trim(),
          country: country.trim() || undefined,
          region: region.trim() || undefined,
          processing: processing.trim() || undefined,
          variety: varieties.length ? varieties : undefined,
          roastLevel: roastLevel.trim() || undefined,
          decaf: decaf || undefined,
          frozen: frozen || undefined,
          roastDate: roastDate || undefined,
          weight: validWeight && validWeight > 0 ? validWeight : undefined,
          notes: notes.trim() || undefined,
          selectNow: true,
        });
      } else {
        await updateBean.mutateAsync({
          id: bean.id,
          patch: {
            roaster: roaster.trim(),
            name: name.trim(),
            country: country.trim() || null,
            region: region.trim() || null,
            processing: processing.trim() || null,
            variety: varieties.length ? varieties : null,
            decaf,
            notes: notes.trim() || null,
          },
        });
        if (batch) {
          await updateBatch.mutateAsync({
            id: batch.id,
            patch: {
              roastDate: roastDate || null,
              roastLevel: roastLevel.trim() || null,
              weightRemaining: validWeight,
              frozen,
            },
          });
        }
        if (loaded) {
          await updateWorkflow.mutateAsync({
            context: {
              coffeeName: name.trim(),
              coffeeRoaster: roaster.trim(),
            },
          });
        }
      }
      onClose();
    } catch {
      // Mutation error state surfaces below.
    }
  };

  const addNewRoast = async () => {
    if (!bean || pending) return;
    const parsedWeight = Number.parseFloat(weight);
    const validWeight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : undefined;
    try {
      const created = await addBatch.mutateAsync({
        beanId: bean.id,
        batch: {
          roastDate: today(),
          roastLevel: roastLevel.trim() || undefined,
          weight: validWeight,
          frozen,
        },
      });
      if (loaded) {
        selectBean.mutate({ bean, batch: created });
      }
      onClose();
    } catch {
      // Mutation error state surfaces below.
    }
  };

  const archive = async () => {
    if (!bean || pending) return;
    if (!armedArchive) return setArmedArchive(true);
    try {
      await archiveBean.mutateAsync(bean.id);
      onClose();
    } catch {
      // Mutation error state surfaces below.
    }
  };

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={box as unknown as React.RefObject<HTMLFormElement>}
        className="modal modal--bag"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onSubmit={submit}
      >
        <div className="modal__body">
          <header className="modal__head modal__head--close">
            <div className="modal__titles">
              <h2 className="modal__h" id={titleId}>
                {isEdit ? bean.name : "Add bag"}
              </h2>
            </div>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          <div className="bagform__grid">
            <div className="bagform__cell">
              <label className="lbl" htmlFor="bag-roaster">Roaster</label>
              <input
                id="bag-roaster"
                className="field__in field__in--full"
                value={roaster}
                onChange={(e) => setRoaster(e.target.value)}
                placeholder="Sey, La Cabra…"
                autoCapitalize="words"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="next"
                autoFocus={!isEdit}
                required
              />
            </div>
            <div className="bagform__cell">
              <label className="lbl" htmlFor="bag-name">Coffee</label>
              <input
                id="bag-name"
                className="field__in field__in--full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pink Bourbon"
                autoCapitalize="words"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="next"
                required
              />
            </div>
            <div className="bagform__cell">
              <label className="lbl" htmlFor="bag-country">Country</label>
              <input
                id="bag-country"
                className="field__in field__in--full"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Colombia, Ethiopia…"
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
              />
            </div>
            <div className="bagform__cell">
              <label className="lbl" htmlFor="bag-region">Region / Farm</label>
              <input
                id="bag-region"
                className="field__in field__in--full"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Huila, Yirgacheffe…"
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
              />
            </div>
            <div className="bagform__cell">
              <label className="lbl" htmlFor="bag-process">Process</label>
              <input
                id="bag-process"
                className="field__in field__in--full"
                value={processing}
                onChange={(e) => setProcessing(e.target.value)}
                placeholder="Washed, Natural, Honey…"
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
              />
            </div>
            <div className="bagform__cell">
              <label className="lbl" htmlFor="bag-variety">Variety</label>
              <input
                id="bag-variety"
                className="field__in field__in--full"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder="Gesha, SL28"
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
              />
            </div>
            <div className="bagform__cell">
              <label className="lbl" htmlFor="bag-roast-level">Roast level</label>
              <input
                id="bag-roast-level"
                className="field__in field__in--full"
                value={roastLevel}
                onChange={(e) => setRoastLevel(e.target.value)}
                placeholder="Light, Medium-light…"
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
              />
            </div>
            <div className="bagform__cell">
              <label className="lbl" htmlFor="bag-roast">Roast date</label>
              <input
                id="bag-roast"
                className="field__in field__in--full num"
                type="date"
                max={today()}
                value={roastDate}
                onChange={(e) => setRoastDate(e.target.value)}
              />
            </div>
            <div className="bagform__cell">
              <label className="lbl" htmlFor="bag-weight">
                {isEdit ? "Remaining (g)" : "Bag weight (g)"}
              </label>
              <input
                id="bag-weight"
                className="field__in field__in--full num"
                type="number"
                inputMode="numeric"
                min="0"
                step="5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="bagform__cell">
              <label className="lbl" htmlFor="bag-notes">Tasting notes</label>
              <input
                id="bag-notes"
                className="field__in field__in--full"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Strawberry, cacao…"
                autoComplete="off"
                enterKeyHint="done"
              />
            </div>
          </div>

          <div className="bagform__flags">
            <button
              type="button"
              className={`btn btn--compact ${frozen ? "" : "btn--quiet"}`}
              aria-pressed={frozen}
              onClick={() => setFrozen((v) => !v)}
            >
              {frozen ? "Frozen" : "Freeze bag"}
            </button>
            <button
              type="button"
              className={`btn btn--compact ${decaf ? "" : "btn--quiet"}`}
              aria-pressed={decaf}
              onClick={() => setDecaf((v) => !v)}
            >
              {decaf ? "Decaf" : "Decaf"}
            </button>
          </div>

          {failed && (
            <p className="err" role="alert">Could not save changes. Check that Decaid is reachable.</p>
          )}
        </div>

        <footer className="modal__foot">
          {isEdit && (
            <>
              <button
                type="button"
                className={`btn btn--compact ${armedArchive ? "btn--danger" : "btn--quiet"}`}
                onClick={archive}
                disabled={pending}
              >
                {armedArchive ? "Confirm archive" : "Archive"}
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--compact"
                onClick={addNewRoast}
                disabled={pending}
              >
                + New roast
              </button>
            </>
          )}
          <span className="actions__end" />
          <button type="submit" className="btn" disabled={!ready || pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Save & load bag"}
          </button>
        </footer>
      </form>
    </div>
  );
}
