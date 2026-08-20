import { describe, it, expect } from "vitest";
import {
  dataDeAnoFracionario,
  anoFracionarioDe,
  periodoVigente,
  intervaloDoAcervo,
  intervaloDaViagem,
  rotuloDeAno,
  rotuloDeData,
  interpretarData,
} from "./tempo";
import type { Pais } from "./pais";
import type { Viagem } from "./viagem";

const brasil: Pais = {
  iso: "BRA",
  isoNumerico: "076",
  nome: "Brasil",
  periodos: [
    { id: "br-colonia", inicio: "1500", fim: "1822", rotulo: "Colônia", regime: "x", entidades: [], fontes: [] },
    { id: "br-imperio", inicio: "1822", fim: "1889", rotulo: "Império", regime: "x", entidades: [], fontes: [] },
    { id: "br-nova", inicio: "1985", rotulo: "Nova República", regime: "x", entidades: [], fontes: [] },
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

describe("datas antes de Cristo na linha do tempo", () => {
  it("1 a.C. cai em zero na linha numérica, e 1 d.C. em um", () => {
    // Não existe ano zero: 1 a.C. ocupa [0,1) e 1 d.C. começa em 1.
    expect(anoFracionarioDe("-1")).toBeCloseTo(0, 3);
    expect(anoFracionarioDe("1")).toBeCloseTo(1, 3);
  });

  it("221 a.C. cai em -220", () => {
    expect(anoFracionarioDe("-221")).toBeCloseTo(-220, 3);
  });

  it("a linha é monotônica atravessando a virada da era", () => {
    const seq = ["-221", "-44", "-1", "1", "618"].map(anoFracionarioDe);
    expect(seq.every((v, i) => i === 0 || v > seq[i - 1])).toBe(true);
  });

  it("faz o caminho de volta preservando o ano a.C.", () => {
    expect(dataDeAnoFracionario(anoFracionarioDe("-221"))).toBe("-221-01-01");
    expect(dataDeAnoFracionario(anoFracionarioDe("-1"))).toBe("-1-01-01");
  });

  it("nunca produz ano zero na volta", () => {
    for (let n = -3; n <= 3; n += 0.25) {
      expect(dataDeAnoFracionario(n)).not.toMatch(/^-?0(-|$)/);
    }
  });

  it("rotuloDeData nunca deixa o sinal chegar à tela", () => {
    expect(rotuloDeData("-300")).toBe("300 a.C.");
    expect(rotuloDeData("-221")).toBe("221 a.C.");
    expect(rotuloDeData("-44-03-15")).toBe("44 a.C. (03-15)");
  });

  it("rotuloDeData deixa data d.C. intacta", () => {
    expect(rotuloDeData("1500")).toBe("1500");
    expect(rotuloDeData("1500-04-22")).toBe("1500-04-22");
    expect(rotuloDeData("843")).toBe("843");
  });

  it("o rótulo mostra a.C. em vez do sinal", () => {
    expect(rotuloDeAno(-220, 900)).toBe("221 a.C.");
    expect(rotuloDeAno(618, 900)).toBe("618");
  });

  it("o rótulo de escala curta também marca a.C.", () => {
    expect(rotuloDeAno(-220 + 68 / 365, 1)).toMatch(/mar.*221 a\.C\./);
  });

  it("periodoVigente funciona com período a.C.", () => {
    const china: Pais = {
      iso: "CHN",
      isoNumerico: "156",
      nome: "China",
      periodos: [
        { id: "cn-qin", inicio: "-221", fim: "-202", rotulo: "Qin", regime: "x", entidades: [], fontes: [] },
        { id: "cn-han", inicio: "-202", fim: "220", rotulo: "Han", regime: "x", entidades: [], fontes: [] },
      ],
    };
    expect(periodoVigente(china, anoFracionarioDe("-210"))?.id).toBe("cn-qin");
    expect(periodoVigente(china, anoFracionarioDe("100"))?.id).toBe("cn-han");
    expect(periodoVigente(china, anoFracionarioDe("-300"))).toBeNull();
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

describe("interpretarData", () => {
  it("lê o que uma pessoa digita", () => {
    expect(interpretarData("2014")).toBe("2014");
    expect(interpretarData("1500-04-22")).toBe("1500-04-22");
    expect(interpretarData(" 1206 ")).toBe("1206");
  });

  it("lê as formas de antes de Cristo", () => {
    expect(interpretarData("221 a.C.")).toBe("-221");
    expect(interpretarData("221 aC")).toBe("-221");
    expect(interpretarData("221 A.C.")).toBe("-221");
    expect(interpretarData("-221")).toBe("-221");
  });

  it("aceita d.C. explícito", () => {
    expect(interpretarData("44 d.C.")).toBe("44");
  });

  it("é a volta do rotuloDeData — o que a tela mostra pode ser redigitado", () => {
    for (const data of ["-300", "-221", "1500", "843", "2014"]) {
      expect(interpretarData(rotuloDeData(data))).toBe(data);
    }
  });

  it("recusa o que não é data em vez de chutar", () => {
    for (const lixo of ["", "  ", "ontem", "0", "0 a.C.", "12345", "1500-13", "abc"]) {
      expect(interpretarData(lixo)).toBeNull();
    }
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
