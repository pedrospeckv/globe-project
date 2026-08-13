import { describe, it, expect } from "vitest";
import {
  dataDeAnoFracionario,
  anoFracionarioDe,
  periodoVigente,
  intervaloDoAcervo,
  intervaloDaViagem,
  rotuloDeAno,
} from "./tempo";
import type { Pais } from "./pais";
import type { Viagem } from "./viagem";

const brasil: Pais = {
  iso: "BRA",
  nome: "Brasil",
  periodos: [
    { id: "br-colonia", inicio: "1500", fim: "1822", rotulo: "Colônia", regime: "x" },
    { id: "br-imperio", inicio: "1822", fim: "1889", rotulo: "Império", regime: "x" },
    { id: "br-nova", inicio: "1985", rotulo: "Nova República", regime: "x" },
  ],
};

const cabral: Viagem = {
  id: "cabral-1500",
  titulo: "Frota de Cabral",
  fontes: [],
  paradas: [
    { local: "Lisboa", data: "1500-03-09", coords: [-9.14, 38.72] },
    { local: "Porto Seguro", data: "1500-04-24", coords: [-39.06, -16.45] },
  ],
};

describe("dataDeAnoFracionario", () => {
  it("ano inteiro vira 1º de janeiro", () => {
    expect(dataDeAnoFracionario(1500)).toBe("1500-01-01");
  });

  it("meio do ano cai por volta de julho", () => {
    expect(dataDeAnoFracionario(1500.5).startsWith("1500-07")).toBe(true);
  });

  it("cobre março e abril de forma distinta — o caso do Cabral", () => {
    const marco = dataDeAnoFracionario(1500 + 68 / 365);
    const abril = dataDeAnoFracionario(1500 + 114 / 365);
    expect(marco.slice(0, 7)).toBe("1500-03");
    expect(abril.slice(0, 7)).toBe("1500-04");
  });

  it("preserva ano de três dígitos", () => {
    expect(dataDeAnoFracionario(843)).toBe("843-01-01");
  });

  it("nunca estoura para o ano seguinte", () => {
    expect(dataDeAnoFracionario(1500.9999).startsWith("1500-12")).toBe(true);
  });

  it("faz o caminho de volta aproximadamente", () => {
    expect(anoFracionarioDe("1500-01-01")).toBeCloseTo(1500, 2);
    expect(anoFracionarioDe("1500")).toBeCloseTo(1500, 2);
  });

  it("ida e volta preserva o mês", () => {
    const d = "1500-04-24";
    expect(dataDeAnoFracionario(anoFracionarioDe(d)).slice(0, 7)).toBe("1500-04");
  });
});

describe("periodoVigente", () => {
  it("acha o período que cobre a data", () => {
    expect(periodoVigente(brasil, 1600)?.id).toBe("br-colonia");
    expect(periodoVigente(brasil, 1850)?.id).toBe("br-imperio");
  });

  it("período aberto cobre tudo dali em diante", () => {
    expect(periodoVigente(brasil, 2026)?.id).toBe("br-nova");
  });

  it("devolve null ANTES de o país existir", () => {
    // Em 843 o Brasil não existe — e o globo precisa dizer isso.
    expect(periodoVigente(brasil, 843)).toBeNull();
  });

  it("devolve null em lacuna entre períodos", () => {
    expect(periodoVigente(brasil, 1950)).toBeNull();
  });

  it("na virada, o período que começa vence o que termina", () => {
    expect(periodoVigente(brasil, 1822)?.id).toBe("br-imperio");
  });
});

describe("intervaloDoAcervo", () => {
  it("vai do período mais antigo até hoje", () => {
    const [ini, fim] = intervaloDoAcervo([brasil]);
    expect(ini).toBe(1500);
    expect(fim).toBeGreaterThanOrEqual(2026);
  });

  it("devolve intervalo utilizável para acervo vazio", () => {
    const [ini, fim] = intervaloDoAcervo([]);
    expect(fim).toBeGreaterThan(ini);
  });
});

describe("intervaloDaViagem", () => {
  it("cobre a viagem com folga nos dois lados", () => {
    const [ini, fim] = intervaloDaViagem(cabral);
    expect(ini).toBeLessThan(anoFracionarioDe("1500-03-09"));
    expect(fim).toBeGreaterThan(anoFracionarioDe("1500-04-24"));
  });

  it("é MUITO mais estreito que o acervo — senão a rota é invisível", () => {
    const [vi, vf] = intervaloDaViagem(cabral);
    const [ai, af] = intervaloDoAcervo([brasil]);
    expect(vf - vi).toBeLessThan((af - ai) / 10);
  });
});

describe("rotuloDeAno", () => {
  it("mostra só o ano em escala longa", () => {
    expect(rotuloDeAno(1500.4, 900)).toBe("1500");
  });

  it("mostra mês e ano em escala curta", () => {
    expect(rotuloDeAno(1500 + 68 / 365, 1)).toMatch(/mar.*1500/i);
  });
});
