import { describe, it, expect } from "vitest";
import { Figura } from "./figura";

const valida = {
  id: "lula",
  nome: "Luiz Inácio Lula da Silva",
  paisIso: "BRA",
  cargos: [{ titulo: "Presidente", inicio: "2003", fim: "2010" }],
  alegacoes: [
    {
      id: "lula-triplex",
      enunciado: "Recebeu o triplex do Guarujá como propina da OAS",
      status: "anulado",
      fontes: ["stf-hc-193726"],
    },
  ],
};

describe("Figura", () => {
  it("aceita figura completa", () => {
    expect(Figura.safeParse(valida).success).toBe(true);
  });

  it("aceita figura sem alegações", () => {
    expect(Figura.safeParse({ ...valida, alegacoes: [] }).success).toBe(true);
  });

  it("assume listas vazias quando cargos e alegações são omitidos", () => {
    const { cargos: _c, alegacoes: _a, ...minima } = valida;
    const r = Figura.safeParse(minima);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.cargos).toEqual([]);
      expect(r.data.alegacoes).toEqual([]);
    }
  });

  it("PROPAGA a exigência de fonte para as alegações aninhadas", () => {
    const r = Figura.safeParse({
      ...valida,
      alegacoes: [{ ...valida.alegacoes[0], fontes: [] }],
    });
    expect(r.success).toBe(false);
  });

  it("aceita cargo em curso, sem fim", () => {
    const r = Figura.safeParse({
      ...valida,
      cargos: [{ titulo: "Presidente", inicio: "2023" }],
    });
    expect(r.success).toBe(true);
  });

  it("rejeita paisIso fora do formato", () => {
    expect(Figura.safeParse({ ...valida, paisIso: "br" }).success).toBe(false);
  });
});
