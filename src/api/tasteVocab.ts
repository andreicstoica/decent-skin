/**
 * Fixed vocabulary, tap-only. The learner consumes these; free text is for
 * reading, not for learning from. Values are stored verbatim in
 * annotations.extras so they stay comparable across shots forever.
 */
export interface TasteGroup {
  key: string;
  label: string;
  options: string[];
}

export const TASTE: TasteGroup[] = [
  { key: "acidity", label: "Acidity", options: ["Low", "Right", "High"] },
  { key: "bitterness", label: "Bitterness", options: ["Low", "Right", "High"] },
  { key: "body", label: "Body", options: ["Thin", "Right", "Heavy"] },
  { key: "clarity", label: "Clarity", options: ["Muddy", "Mixed", "Clear"] },
  { key: "flowLooked", label: "Flow looked", options: ["Even", "Spritzy", "Gushed", "Choked"] },
];

/**
 * Native 0–10 enjoyment scale, matching Decaid's canonical `annotations.enjoyment`.
 */
export const ENJOYMENT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const toDecaidEnjoyment = (score: number) => Math.max(0, Math.min(10, Math.round(score)));
export const fromDecaidEnjoyment = (score?: number | null) =>
  score === undefined || score === null ? undefined : Math.max(0, Math.min(10, Math.round(score)));
