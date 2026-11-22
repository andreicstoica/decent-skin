/** Only the three bean fields are patched: never replace the recorded workflow,
 * profile, grinder, measurements, ratings or unknown annotations.
 * Verified against decentespresso/decaid 18469d2,
 * lib/src/services/webserver/shots_handler.dart::_updateShot.
 * That handler deep-merges this patch. Older gateways may ignore
 * workflow updates, so a successful HTTP status alone is NOT success.
 */
export interface ShotBeanSelection {
  beanBatchId: string | null;
  coffeeName: string;
  coffeeRoaster: string;
}

export async function saveShotBean(url: string, id: string, selection: ShotBeanSelection) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflow: { context: selection } }),
  });
  if (!response.ok) throw new Error(`Could not save bean (gateway ${response.status}). Try again when Decaid is reachable.`);
  const saved = await response.json();
  const context = saved?.workflow?.context;
  if (saved?.id !== id || !context ||
      (context.beanBatchId ?? null) !== selection.beanBatchId ||
      context.coffeeName !== selection.coffeeName || context.coffeeRoaster !== selection.coffeeRoaster) {
    throw new Error("Decaid did not confirm the bean change. Reload the shot to check it; this gateway may need an update.");
  }
  return saved;
}
