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
    eleicoes: [],
    notas: [],
    ilhas: [],
    nacoes: [],
  };
}

/*
 * A colisão entre tipos foi encontrada ao montar a nação, não por revisão: a
 * Escócia ia entrar com o mesmo id do episódio dela, e como `indexarAlvos` põe
 * tudo num Record plano, um teria apagado o outro sem erro nenhum. O sintoma
 * seria um `[[escocia]]` levando à página errada — e nada acusaria, porque as
 * duas entradas são válidas em separado.
 */
describe("id repetido entre tipos", () => {
  function comNacao(): Acervo {
    const a = acervoBase();
    a.episodios = [
      {
        id: "escocia",
        titulo: "Episódio",
        inicio: "1000",
        paises: ["BRA"],
        periodos: [],
        abertura: "Abertura.",
        blocos: [
          { id: "um", data: "1000", titulo: "Um", textoMdx: "Um." },
          { id: "dois", data: "1001", titulo: "Dois", textoMdx: "Dois." },
        ],
        fontes: ["stf-hc-193726"],
      },
    ];
    a.nacoes = [
      {
        id: "escocia",
        nome: "Escócia",
        outrosNomes: [],
        anfitriao: "BRA",
        ponto: [-4, 56],
        reconhecimento: {
          instrumento: "Lei",
          data: "1998",
          textoMdx: "Texto.",
          fontes: ["stf-hc-193726"],
        },
        abertura: "Abertura.",
        episodios: ["escocia"],
        periodos: [],
        fontes: [],
      },
    ];
    return a;
  }

  it("ACUSA quando nação e episódio disputam o mesmo id", () => {
    const erros = verificarIntegridade(comNacao());
    expect(erros.join(" | ")).toContain('id "escocia"');
    expect(erros.join(" | ")).toMatch(/episódio.*nação|nação.*episódio/);
  });

  it("aceita os dois quando o episódio tem id próprio", () => {
    const a = comNacao();
    a.episodios[0].id = "escocia-reino-e-uniao";
    a.nacoes[0].episodios = ["escocia-reino-e-uniao"];
    expect(verificarIntegridade(a)).toEqual([]);
  });

  it("ACUSA id de nação que colide com código de país", () => {
    const a = comNacao();
    a.episodios[0].id = "escocia-reino-e-uniao";
    a.nacoes[0].episodios = ["escocia-reino-e-uniao"];
    a.nacoes[0].id = "BRA";
    expect(verificarIntegridade(a).join(" | ")).toContain('id "BRA"');
  });
});

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

  /*
   * O negrito de parágrafo inteiro. Os três casos que importam estão aqui
   * porque a diferença entre eles é a regra: embrulhar tudo não é ênfase,
   * realçar uma frase é, e um parágrafo com duas frases realçadas continua
   * sendo ênfase mesmo começando e terminando em `**`.
   */
  it("ACUSA parágrafo inteiro em negrito", () => {
    const a = acervoBase();
    a.paises[0].periodos[0].textoMdx = "**A Nova República começa em 1985.**";
    expect(
      verificarIntegridade(a).some((e) => /parágrafo inteiro em negrito/.test(e))
    ).toBe(true);
  });

  it("aceita negrito que realça uma frase dentro do parágrafo", () => {
    const a = acervoBase();
    a.paises[0].periodos[0].textoMdx =
      "A Nova República começa em **1985**, com a eleição indireta de Tancredo.";
    expect(verificarIntegridade(a)).toHaveLength(0);
  });

  it("aceita parágrafo que começa e termina em negrito mas realça duas frases", () => {
    const a = acervoBase();
    a.paises[0].periodos[0].textoMdx =
      "**Tancredo** é eleito e morre antes de tomar posse; assume **Sarney**";
    expect(verificarIntegridade(a)).toHaveLength(0);
  });

  it("ACUSA parágrafo inteiro em negrito na entidade", () => {
    const a = acervoBase();
    a.paises[0].periodos[0].entidades = [
      { nome: "RDA", regime: "x", fontes: [], textoMdx: "**Estado socialista.**" },
      { nome: "RFA", regime: "y", fontes: [] },
    ];
    expect(
      verificarIntegridade(a).some((e) => /RDA.*parágrafo inteiro em negrito/.test(e))
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
