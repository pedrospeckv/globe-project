import { describe, it, expect } from "vitest";
import { ISO_NUMERICO, alpha3De, PAISES_DO_ATLAS } from "./iso";

describe("ISO_NUMERICO", () => {
  it("cobre os 9 países do atlas", () => {
    expect(PAISES_DO_ATLAS).toHaveLength(9);
    for (const alpha3 of PAISES_DO_ATLAS) {
      expect(ISO_NUMERICO[alpha3]).toMatch(/^\d{3}$/);
    }
  });

  it("faz o caminho de volta", () => {
    expect(alpha3De("076")).toBe("BRA");
    expect(alpha3De("250")).toBe("FRA");
    expect(alpha3De("826")).toBe("GBR");
  });

  it("devolve undefined para código fora do atlas", () => {
    expect(alpha3De("032")).toBeUndefined();
  });

  it("normaliza código sem zero à esquerda", () => {
    expect(alpha3De("76")).toBe("BRA");
    expect(alpha3De(76)).toBe("BRA");
  });

  it("não tem código numérico duplicado", () => {
    const numeros = Object.values(ISO_NUMERICO);
    expect(new Set(numeros).size).toBe(numeros.length);
  });
});
