import { describe, it, expect } from "vitest";
import { Alegacao, StatusAlegacao } from "./alegacao";

const valida = {
  id: "lula-triplex",
  enunciado: "Recebeu o triplex do Guarujá como propina da OAS",
  status: "anulado",
  fontes: ["stf-hc-193726"],
};

describe("Alegacao", () => {
  it("aceita uma alegação com fonte", () => {
    expect(Alegacao.safeParse(valida).success).toBe(true);
  });

  it("REJEITA alegação sem nenhuma fonte", () => {
    const r = Alegacao.safeParse({ ...valida, fontes: [] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/fonte/i);
    }
  });

  it("REJEITA alegação com o campo fontes ausente", () => {
    const { fontes: _fontes, ...semFontes } = valida;
    expect(Alegacao.safeParse(semFontes).success).toBe(false);
  });

  it("REJEITA enunciado vazio — afirmação em branco não é alegação", () => {
    expect(Alegacao.safeParse({ ...valida, enunciado: "" }).success).toBe(false);
  });

  it("rejeita status fora do enum", () => {
    expect(Alegacao.safeParse({ ...valida, status: "culpado" }).success).toBe(false);
  });

  it.each([
    "transito-julgado",
    "em-julgamento",
    "investigacao",
    "investigacao-arquivada",
    "anulado",
    "prescrito",
    "alegacao-sem-processo",
    "desmentido",
  ])("aceita o status %s", (status) => {
    expect(Alegacao.safeParse({ ...valida, status }).success).toBe(true);
  });

  it("expõe exatamente os 8 status previstos no spec", () => {
    expect(StatusAlegacao.options).toHaveLength(8);
  });

  it("aceita nota explicando por que o status é esse", () => {
    const r = Alegacao.safeParse({
      ...valida,
      nota: "Anulação por incompetência do juízo — não equivale a absolvição de mérito.",
    });
    expect(r.success).toBe(true);
  });
});
