/**
 * O world-atlas identifica país por ISO 3166-1 numérico ("076"), enquanto o
 * conteúdo do atlas usa alpha-3 ("BRA"). Este é o único lugar que sabe
 * traduzir entre os dois.
 */
export const ISO_NUMERICO = {
  BRA: "076",
  CHN: "156",
  DEU: "276",
  FRA: "250",
  GBR: "826",
  IND: "356",
  JPN: "392",
  RUS: "643",
  USA: "840",
} as const;

export type Alpha3 = keyof typeof ISO_NUMERICO;

export const PAISES_DO_ATLAS = Object.keys(ISO_NUMERICO) as Alpha3[];

const REVERSO: Record<string, Alpha3> = Object.fromEntries(
  Object.entries(ISO_NUMERICO).map(([a3, num]) => [num, a3 as Alpha3])
);

/** Aceita "076", "76" ou 76 — o topojson não é consistente quanto ao zero. */
export function alpha3De(numerico: string | number): Alpha3 | undefined {
  return REVERSO[String(numerico).padStart(3, "0")];
}
