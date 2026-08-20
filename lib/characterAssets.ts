import type { CharacterExpression, CategoryKey, Intensity } from "./types";

export const CATEGORIES: CategoryKey[] = ["bloating", "gas", "cramping", "stool"];
export const INTENSITIES: Intensity[] = ["light", "mid", "dark"];

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  bloating: "더부룩함",
  gas: "가스",
  cramping: "복통",
  stool: "배변 상태",
};

/**
 * Screen copy for each intensity, per category — the art itself came
 * labeled this way (e.g. stool: Comfortable/Normal/Hard, everything else:
 * None/Mild/Severe), so we keep that on-screen wording while the internal
 * Intensity type stays a uniform light/mid/dark for scoring/type purposes.
 */
export const INTENSITY_LABEL: Record<CategoryKey, Record<Intensity, string>> = {
  bloating: { light: "None", mid: "Mild", dark: "Severe" },
  gas: { light: "None", mid: "Mild", dark: "Severe" },
  cramping: { light: "None", mid: "Mild", dark: "Severe" },
  stool: { light: "Comfortable", mid: "Normal", dark: "Hard" },
};

/**
 * Every illustration the character can show, mapped to its SVG path.
 * The 12 result-report combinations (category-intensity) are real art;
 * the mood expressions (other than idle) are still placeholders until
 * dedicated art lands for those states. CharacterImage falls back to a
 * gray circle when a file 404s, so it's safe to reference paths that
 * don't exist yet.
 */
export const CHARACTER_ASSET_MAP: Record<CharacterExpression, string> = {
  "bloating-light": "/assets/illust/bloating-light.svg",
  "bloating-mid": "/assets/illust/bloating-mid.svg",
  "bloating-dark": "/assets/illust/bloating-dark.svg",
  "gas-light": "/assets/illust/gas-light.svg",
  "gas-mid": "/assets/illust/gas-mid.svg",
  "gas-dark": "/assets/illust/gas-dark.svg",
  "cramping-light": "/assets/illust/cramping-light.svg",
  "cramping-mid": "/assets/illust/cramping-mid.svg",
  "cramping-dark": "/assets/illust/cramping-dark.svg",
  "stool-light": "/assets/illust/stool-light.svg",
  "stool-mid": "/assets/illust/stool-mid.svg",
  "stool-dark": "/assets/illust/stool-dark.svg",
  idle: "/assets/illust/idle.svg",
  // No dedicated art yet for these moods — reuse existing assets that read
  // close enough (surprised ~ the most "alarmed" face we have) rather than
  // showing an empty placeholder circle.
  surprised: "/assets/illust/bloating-dark.svg",
  happy: "/assets/illust/idle.svg",
  neutral: "/assets/illust/neutral.svg",
  nod: "/assets/illust/nod.svg",
};

export function assetFor(expression: CharacterExpression): string {
  return CHARACTER_ASSET_MAP[expression];
}

/** Map a 0..maxScore value to a light/mid/dark intensity bucket. */
export function scoreToIntensity(score: number, maxScore: number): Intensity {
  const ratio = maxScore <= 0 ? 0 : score / maxScore;
  if (ratio < 1 / 3) return "light";
  if (ratio < 2 / 3) return "mid";
  return "dark";
}
