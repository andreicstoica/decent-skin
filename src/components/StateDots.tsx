import { WORKING, type MachineSnapshot } from "../api/types";

const CELLS = 12;

/**
 * A gauge, not an ornament: while the machine warms the cells track mix
 * temperature against its target, so the fill means something. Only the leading
 * cell animates, and only while there is something to wait for.
 */
export function StateDots({ snapshot }: { snapshot: MachineSnapshot }) {
  const state = snapshot.state.state;
  const asleep = state === "sleeping" || state === "schedIdle";
  const warming = WORKING.has(state);

  const target = snapshot.targetMixTemperature || 0;
  const fraction = warming && target > 0 ? Math.min(1, snapshot.mixTemperature / target) : 1;
  const lit = asleep ? 0 : Math.max(1, Math.round(fraction * CELLS));

  return (
    <span
      className="dots"
      role="img"
      aria-label={
        warming
          ? `Heating, ${snapshot.mixTemperature.toFixed(0)} of ${target.toFixed(0)} degrees`
          : asleep
            ? "Asleep"
            : "Up to temperature"
      }
    >
      {Array.from({ length: CELLS }, (_, i) => (
        <i
          key={i}
          className={[
            "dots__c",
            i < lit ? "dots__c--on" : "",
            warming && i === lit - 1 ? "dots__c--edge" : "",
            warming ? "dots__c--warm" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </span>
  );
}
