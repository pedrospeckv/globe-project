import { describe, it, expect } from "vitest";
import { Pais, Periodo } from "./pais";

const periodo = {
  id: "br-nova-republica",
  inicio: "1985",
  fim: "1989",
  rotulo: "Nova República",
  regime: "democracia presidencialista",
};

describe("Periodo", () => {
  it("aceita um período fechado", () => {
    expect(Periodo.safeParse(periodo).success).toBe(true);
  });

  it("aceita período aberto — o atual não tem fim", () => {
    const { fim: _fim, ...aberto } = periodo;
    expect(Periodo.safeParse(aberto).success).toBe(true);
  });

  it("REJEITA período que termina antes de começar", () => {
    const r = Periodo.safeParse({ ...periodo, inicio: "1989", fim: "1985" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/antes/i);
  });

  it("aceita período que começa e termina no mesmo ano", () => {
    expect(Periodo.safeParse({ ...periodo, inicio: "1985", fim: "1985" }).success).toBe(
      true
    );
  });

  it("aceita ano de três dígitos", () => {
    expect(Periodo.safeParse({ ...periodo, inicio: "843", fim: "987" }).success).toBe(
      true
    );
  });

  it("exige rotulo — é onde vive o nome da entidade política da época", () => {
    expect(Periodo.safeParse({ ...periodo, rotulo: "" }).success).toBe(false);
  });
});

describe("Pais", () => {
  const brasil = { iso: "BRA", nome: "Brasil", periodos: [periodo] };

  it("aceita país com períodos", () => {
    expect(Pais.safeParse(brasil).success).toBe(true);
  });

  it.each(["br", "BR", "brasil", "BRAS"])("rejeita iso %s", (iso) => {
    expect(Pais.safeParse({ ...brasil, iso }).success).toBe(false);
  });

  it("REJEITA país sem nenhum período — país sem retrato não existe no atlas", () => {
    expect(Pais.safeParse({ ...brasil, periodos: [] }).success).toBe(false);
  });
});
