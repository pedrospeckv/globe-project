import { describe, it, expect } from "vitest";
import { Pais, Periodo, estaDividido } from "./pais";

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

  it("REJEITA inversão dentro do mesmo ano, não só entre anos", () => {
    const r = Periodo.safeParse({
      ...periodo,
      inicio: "1985-06-01",
      fim: "1985-02-01",
    });
    expect(r.success).toBe(false);
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

describe("Periodo com entidades", () => {
  const dividido = {
    id: "de-divisao",
    inicio: "1949",
    fim: "1990",
    rotulo: "Alemanha dividida",
    regime: "território dividido entre dois Estados soberanos",
    entidades: [
      { nome: "República Federal da Alemanha", regime: "parlamentarista federal" },
      { nome: "República Democrática Alemã", regime: "socialista de partido único" },
    ],
  };

  it("aceita período com duas entidades", () => {
    expect(Periodo.safeParse(dividido).success).toBe(true);
  });

  it("assume lista vazia quando entidades é omitido", () => {
    const r = Periodo.safeParse(periodo);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.entidades).toEqual([]);
  });

  it("REJEITA entidade única — uma só é o próprio período", () => {
    const r = Periodo.safeParse({ ...dividido, entidades: [dividido.entidades[0]] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/duas/i);
  });

  it("exige nome e regime de cada entidade", () => {
    expect(
      Periodo.safeParse({
        ...dividido,
        entidades: [{ nome: "", regime: "x" }, dividido.entidades[1]],
      }).success
    ).toBe(false);
  });

  it("aceita mais de duas entidades", () => {
    const r = Periodo.safeParse({
      ...dividido,
      entidades: [...dividido.entidades, { nome: "Sarre", regime: "protetorado" }],
    });
    expect(r.success).toBe(true);
  });
});

describe("estaDividido", () => {
  it("é verdadeiro com duas ou mais entidades", () => {
    const p = Periodo.parse({
      id: "x",
      inicio: "1949",
      rotulo: "r",
      regime: "g",
      entidades: [
        { nome: "A", regime: "a" },
        { nome: "B", regime: "b" },
      ],
    });
    expect(estaDividido(p)).toBe(true);
  });

  it("é falso sem entidades", () => {
    expect(estaDividido(Periodo.parse(periodo))).toBe(false);
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
