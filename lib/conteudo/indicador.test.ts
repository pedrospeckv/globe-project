import { describe, it, expect } from "vitest";
import { Indicador, parseSerieCsv, valorEm } from "./indicador";

const CSV = `ano,valor
2012,25.4
2013,24.1
2014,23.8
`;

describe("parseSerieCsv", () => {
  it("lê ano e valor", () => {
    const s = parseSerieCsv(CSV);
    expect(s).toHaveLength(3);
    expect(s[0]).toEqual({ ano: 2012, valor: 25.4 });
  });

  it("ignora linhas em branco no fim", () => {
    expect(parseSerieCsv(CSV + "\n\n")).toHaveLength(3);
  });

  it("aceita cabeçalho com espaços e maiúsculas", () => {
    expect(parseSerieCsv(" Ano , Valor \n2012,1\n")).toHaveLength(1);
  });

  it("LANÇA se faltar a coluna valor", () => {
    expect(() => parseSerieCsv("ano\n2012\n")).toThrow(/valor/);
  });

  it("LANÇA se faltar a coluna ano", () => {
    expect(() => parseSerieCsv("valor\n25\n")).toThrow(/ano/);
  });

  it("LANÇA em número inválido em vez de virar NaN", () => {
    expect(() => parseSerieCsv("ano,valor\n2012,abc\n")).toThrow(/2012/);
  });

  it("ordena por ano", () => {
    const s = parseSerieCsv("ano,valor\n2014,1\n2012,2\n");
    expect(s.map((p) => p.ano)).toEqual([2012, 2014]);
  });
});

describe("Indicador", () => {
  const base = {
    id: "br-pobreza",
    paisIso: "BRA",
    nome: "Pobreza",
    unidade: "% da população",
    fonte: "ibge-pnad",
    serie: [{ ano: 2012, valor: 25.4 }],
  };

  it("aceita indicador completo", () => {
    expect(Indicador.safeParse(base).success).toBe(true);
  });

  it("EXIGE fonte — gráfico sem atribuição é opinião com eixo", () => {
    const { fonte: _f, ...semFonte } = base;
    expect(Indicador.safeParse(semFonte).success).toBe(false);
  });

  it("exige série não vazia", () => {
    expect(Indicador.safeParse({ ...base, serie: [] }).success).toBe(false);
  });

  it("exige unidade", () => {
    expect(Indicador.safeParse({ ...base, unidade: "" }).success).toBe(false);
  });

  it("rejeita paisIso fora do formato", () => {
    expect(Indicador.safeParse({ ...base, paisIso: "br" }).success).toBe(false);
  });
});

describe("valorEm", () => {
  const serie = [
    { ano: 2012, valor: 25.4 },
    { ano: 2014, valor: 23.8 },
  ];

  it("devolve o valor exato do ano", () => {
    expect(valorEm(serie, 2012)).toBe(25.4);
  });

  it("devolve null fora da série — não extrapola", () => {
    expect(valorEm(serie, 2020)).toBeNull();
    expect(valorEm(serie, 2000)).toBeNull();
  });

  it("devolve null em ano faltante no meio — não interpola", () => {
    // Inventar um ponto que não foi medido é mentir com aparência de dado.
    expect(valorEm(serie, 2013)).toBeNull();
  });
});
