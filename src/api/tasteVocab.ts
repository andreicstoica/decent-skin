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

export const ENJOYMENT = [1, 2, 3, 4, 5];
