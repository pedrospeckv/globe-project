import { describe, it, expect } from "vitest";
import {
  verificarIntegridade,
  coberturaDeFontes,
  type Acervo,
} from "./integridade";

function acervoBase(): Acervo {
  return {
    fontes: [
      {
        id: "stf-hc-193726",
        tipo: "decisao-judicial",
        titulo: "HC 193.726",
      },
    ],
    paises: [
      {
        iso: "BRA",
        isoNumerico: "076",
        nome: "Brasil",
        periodos: [
          {
            id: "br-atual",
            inicio: "1985",
            rotulo: "Nova República",
            regime: "democracia",
            entidades: [], fontes: [],
          },
        ],
      },
    ],
    figuras: [
      {
        id: "lula",
        nome: "Lula",
        paisIso: "BRA",
        cargos: [],
        trajetoria: [],
        fontes: [],
        alegacoes: [
          {
            id: "lula-triplex",
            enunciado: "Recebeu o triplex do Guarujá",
            status: "anulado",
            fontes: ["stf-hc-193726"],
          },
        ],
      },
    ],
    viagens: [],
    indicadores: [],
    eventos: [],
    episodios: [],
    notas: [],
    ilhas: [],
  };
}

describe("verificarIntegridade", () => {
  it("não acusa nada quando tudo referencia corretamente", () => {
    expect(verificarIntegridade(acervoBase())).toEqual([]);
  });

  it("ACUSA alegação que cita fonte inexistente", () => {
    const a = acervoBase();
    a.figuras[0].alegacoes[0].fontes = ["fonte-que-nao-existe"];
    const erros = verificarIntegridade(a);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/fonte-que-nao-existe/);
    expect(erros[0]).toMatch(/lula-triplex/);
  });

  it("ACUSA figura de país que não está no atlas", () => {
    const a = acervoBase();
    a.figuras[0].paisIso = "ARG";
    expect(verificarIntegridade(a).some((e) => /ARG/.test(e))).toBe(true);
  });

  it("ACUSA ids de fonte duplicados", () => {
    const a = acervoBase();
    a.fontes.push({ ...a.fontes[0] });
    expect(verificarIntegridade(a).some((e) => /duplicad/i.test(e))).toBe(true);
  });

  it("ACUSA ids de figura duplicados", () => {
    const a = acervoBase();
    a.figuras.push({ ...a.figuras[0] });
    expect(verificarIntegridade(a).some((e) => /duplicad/i.test(e))).toBe(true);
  });

  it("ACUSA iso de país duplicado", () => {
    const a = acervoBase();
    a.paises.push({ ...a.paises[0] });
    expect(verificarIntegridade(a).some((e) => /duplicad/i.test(e))).toBe(true);
  });

  it("ACUSA viagem que cita fonte inexistente", () => {
    const a = acervoBase();
    a.viagens.push({
      id: "cabral-1500",
      titulo: "Frota de Cabral",
      paradas: [
        { local: "Lisboa", data: "1500-03-09", coords: [-9.14, 38.72] },
        { local: "Porto Seguro", data: "1500-04-22", coords: [-39.06, -16.45] },
      ],
      fontes: ["fonte-fantasma"],
    });
    expect(verificarIntegridade(a).some((e) => /fonte-fantasma/.test(e))).toBe(true);
  });

  it("ACUSA indicador que cita fonte inexistente", () => {
    const a = acervoBase();
    a.indicadores.push({
      id: "br-pobreza",
      paisIso: "BRA",
      nome: "Pobreza",
      unidade: "%",
      fonte: "fonte-fantasma",
      escala: "linear",
      serie: [{ ano: 2012, valor: 25 }],
    });
    expect(verificarIntegridade(a).some((e) => /fonte-fantasma/.test(e))).toBe(true);
  });

  it("ACUSA indicador de país fora do atlas", () => {
    const a = acervoBase();
    a.indicadores.push({
      id: "ar-pobreza",
      paisIso: "ARG",
      nome: "Pobreza",
      unidade: "%",
      fonte: "stf-hc-193726",
      escala: "linear",
      serie: [{ ano: 2012, valor: 25 }],
    });
    expect(verificarIntegridade(a).some((e) => /ARG/.test(e))).toBe(true);
  });

  it("ACUSA evento em país que não está no atlas", () => {
    const a = acervoBase();
    a.eventos.push({
      id: "evento-x",
      data: "1789-07-14",
      titulo: "Evento",
      ponto: [0, 0],
      paises: ["ARG"],
      fontes: [],
    });
    expect(verificarIntegridade(a).some((e) => /ARG/.test(e))).toBe(true);
  });

  it("ACUSA evento que cita fonte inexistente", () => {
    const a = acervoBase();
    a.eventos.push({
      id: "evento-y",
      data: "1789-07-14",
      titulo: "Evento",
      ponto: [0, 0],
      paises: ["BRA"],
      fontes: ["fonte-fantasma"],
    });
    expect(verificarIntegridade(a).some((e) => /fonte-fantasma/.test(e))).toBe(true);
  });

  it("acumula todos os erros em vez de parar no primeiro", () => {
    const a = acervoBase();
    a.figuras[0].alegacoes[0].fontes = ["inexistente-a", "inexistente-b"];
    expect(verificarIntegridade(a)).toHaveLength(2);
  });

  it("ACUSA período que cita fonte inexistente", () => {
    const a = acervoBase();
    a.paises[0].periodos[0].fontes = ["fonte-fantasma"];
    expect(verificarIntegridade(a).some((e) => /fonte-fantasma/.test(e))).toBe(true);
  });

  it("ACUSA entidade que cita fonte inexistente", () => {
    const a = acervoBase();
    a.paises[0].periodos[0].entidades = [
      { nome: "RDA", regime: "x", fontes: ["fonte-fantasma"] },
    ];
    expect(
      verificarIntegridade(a).some((e) => /RDA.*fonte-fantasma/.test(e))
    ).toBe(true);
  });
});

describe("coberturaDeFontes", () => {
  /*
   * Isto NÃO é erro. Exigir fonte de todo período quebraria os 84 de uma
   * vez, e a saída fácil para destravar o build seria inventar fonte —
   * pior que não ter nenhuma. Contar é o que faz a dívida encolher em vez
   * de sumir de vista.
   */
  it("conta só período que tem prosa — os outros não afirmam nada", () => {
    const a = acervoBase();
    a.paises[0].periodos = [
      {
        id: "sem-texto",
        inicio: "1500",
        rotulo: "A",
        regime: "x",
        entidades: [],
        fontes: [],
      },
      {
        id: "com-texto-sem-fonte",
        inicio: "1600",
        rotulo: "B",
        regime: "x",
        entidades: [],
        fontes: [],
        textoMdx: "afirma coisas",
      },
      {
        id: "com-texto-com-fonte",
        inicio: "1700",
        rotulo: "C",
        regime: "x",
        entidades: [],
        fontes: ["stf-hc-193726"],
        textoMdx: "afirma coisas com lastro",
      },
    ];

    const cob = coberturaDeFontes(a);
    expect(cob.comTexto).toBe(2);
    expect(cob.comFonte).toBe(1);
    expect(cob.semFonte).toEqual(["BRA/com-texto-sem-fonte"]);
  });

  it("o Brasil está inteiro coberto — é o país-exemplo", async () => {
    const path = await import("node:path");
    const { carregarAcervo } = await import("./carregar");
    const acervo = await carregarAcervo(
      path.join(process.cwd(), "conteudo")
    );
    const cob = coberturaDeFontes(acervo);
    expect(cob.semFonte.filter((s) => s.startsWith("BRA/"))).toEqual([]);
  });
});
