import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  Eleicao,
  ROTULO_DA_SITUACAO,
  SituacaoDaCandidatura,
  eleicoesDoPais,
  emOrdemAlfabetica,
  emRetratoUniforme,
} from "./eleicao";
import { carregarAcervo } from "./carregar";
import { verificarIntegridade } from "./integridade";
import { indexarAlvos } from "./ligacoes";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));

function base() {
  return {
    id: "teste",
    titulo: "Eleição de teste",
    paisIso: "BRA",
    cargo: "Presidente da República",
    primeiroTurno: "2026-10-04",
    segundoTurno: "2026-10-25",
    prazoDeRegistro: "2026-08-15",
    conferidoEm: "2026-08-19",
    abertura: "Abertura.",
    chapas: [
      {
        id: "a",
        candidato: "Ana",
        partido: "X",
        // `as const` senão o literal alarga para `string` e `emOrdemAlfabetica`,
        // que recebe `Chapa[]`, deixa de aceitar a fixture.
        situacao: "registro-protocolado" as const,
      },
      {
        id: "b",
        candidato: "Bruno",
        partido: "Y",
        situacao: "registro-deferido" as const,
      },
    ],
    fontes: ["alguma-fonte"],
  };
}

const vazio = {
  fontes: [],
  paises: [],
  figuras: [],
  viagens: [],
  indicadores: [],
  eventos: [],
  episodios: [],
  eleicoes: [],
  notas: [],
  ilhas: [],
};

describe("schema da eleição", () => {
  it("aceita o caso mínimo", () => {
    expect(Eleicao.safeParse(base()).success).toBe(true);
  });

  it("recusa eleição sem fonte — o assunto muda por decisão judicial", () => {
    const r = Eleicao.safeParse({ ...base(), fontes: [] });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("ao menos uma fonte");
  });

  it("exige a data da conferência — é o que separa 'errado' de 'mudou depois'", () => {
    const { conferidoEm: _, ...sem } = base();
    expect(Eleicao.safeParse(sem).success).toBe(false);
  });

  it("recusa uma chapa só — isso não é disputa", () => {
    const e = base();
    expect(Eleicao.safeParse({ ...e, chapas: [e.chapas[0]] }).success).toBe(false);
  });

  it("recusa segundo turno antes do primeiro", () => {
    const r = Eleicao.safeParse({
      ...base(),
      primeiroTurno: "2026-10-25",
      segundoTurno: "2026-10-04",
    });
    expect(r.success).toBe(false);
  });

  it("recusa prazo de registro depois da votação", () => {
    const r = Eleicao.safeParse({ ...base(), prazoDeRegistro: "2026-11-01" });
    expect(r.success).toBe(false);
  });

  it("situação é lista fechada — 'é candidato' não é um estado válido", () => {
    const e = base();
    const r = Eleicao.safeParse({
      ...e,
      chapas: [{ ...e.chapas[0], situacao: "candidato" }, e.chapas[1]],
    });
    expect(r.success).toBe(false);
  });

  it("toda situação do enum tem rótulo de tela", () => {
    for (const s of SituacaoDaCandidatura.options) {
      expect(ROTULO_DA_SITUACAO[s]).toBeTruthy();
    }
  });
});

describe("ordem alfabética", () => {
  it("aceita a ordem certa e recusa a invertida", () => {
    const e = base();
    expect(emOrdemAlfabetica(e.chapas)).toBe(true);
    expect(emOrdemAlfabetica([e.chapas[1], e.chapas[0]])).toBe(false);
  });

  it("retrato é tudo ou nada — meia lista com foto é o estado ruim", () => {
    const e = base();
    const foto = {
      url: "https://upload.wikimedia.org/a.jpg",
      alt: "retrato",
      credito: "TSE",
      licenca: "CC BY 4.0",
    };
    const nenhum = e.chapas;
    const todos = e.chapas.map((c) => ({ ...c, foto }));
    const meio = [{ ...e.chapas[0], foto }, e.chapas[1]];

    expect(emRetratoUniforme(nenhum)).toBe(true);
    expect(emRetratoUniforme(todos)).toBe(true);
    expect(emRetratoUniforme(meio)).toBe(false);

    // E o schema recusa, para a lista mista não chegar à tela.
    expect(Eleicao.safeParse({ ...e, chapas: todos }).success).toBe(true);
    const r = Eleicao.safeParse({ ...e, chapas: meio });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("candidatura menor");
  });

  it("usa pt-BR, para acento não jogar nome para o fim", () => {
    // Sem `localeCompare` em pt-BR, "Ângela" cairia depois de "Zema".
    const chapas = [
      { id: "1", candidato: "Ângela", partido: "X", situacao: "renuncia" },
      { id: "2", candidato: "Bruno", partido: "Y", situacao: "renuncia" },
      { id: "3", candidato: "Zema", partido: "Z", situacao: "renuncia" },
    ] as const;
    expect(emOrdemAlfabetica(chapas as never)).toBe(true);
  });
});

describe("integridade da eleição", () => {
  it("acusa país que não está no atlas", () => {
    const erros = verificarIntegridade({
      ...vazio,
      eleicoes: [{ ...base(), paisIso: "XYZ", fontes: [] }] as never,
    });
    expect(erros.some((e) => e.includes("XYZ"))).toBe(true);
  });

  it("acusa fonte inexistente", () => {
    const erros = verificarIntegridade({
      ...vazio,
      eleicoes: [{ ...base(), paisIso: "BRA" }] as never,
      paises: [{ iso: "BRA", nome: "Brasil", periodos: [] }] as never,
    });
    expect(erros.some((e) => e.includes("alguma-fonte"))).toBe(true);
  });

  it("acusa chapa que aponta para figura inexistente", () => {
    const e = base();
    const erros = verificarIntegridade({
      ...vazio,
      paises: [{ iso: "BRA", nome: "Brasil", periodos: [] }] as never,
      eleicoes: [
        {
          ...e,
          fontes: [],
          chapas: [{ ...e.chapas[0], figura: "ninguem" }, e.chapas[1]],
        },
      ] as never,
    });
    expect(erros.some((er) => er.includes("figura inexistente"))).toBe(true);
  });

  it("acusa chapa com id repetido", () => {
    const e = base();
    const erros = verificarIntegridade({
      ...vazio,
      paises: [{ iso: "BRA", nome: "Brasil", periodos: [] }] as never,
      eleicoes: [
        { ...e, fontes: [], chapas: [e.chapas[0], { ...e.chapas[1], id: "a" }] },
      ] as never,
    });
    expect(erros.some((er) => er.includes("chapa com id duplicado"))).toBe(true);
  });

  it("a eleição vira alvo com página própria", () => {
    const alvos = indexarAlvos({ ...vazio, eleicoes: [base()] as never });
    expect(alvos["teste"]).toEqual({
      id: "teste",
      rotulo: "Eleição de teste",
      href: "/eleicao/teste",
      tipo: "eleicao",
    });
  });
});

describe("a eleição de 2026 no acervo", () => {
  const e = acervo.eleicoes.find((x) => x.id === "2026-presidencial")!;

  it("existe e tem as treze chapas registradas", () => {
    expect(e).toBeDefined();
    expect(e.chapas).toHaveLength(13);
  });

  it("está em ordem alfabética — o único critério que não insinua ranking", () => {
    expect(emOrdemAlfabetica(e.chapas)).toBe(true);
  });

  it("nenhuma chapa é dada como deferida antes de o TSE julgar", () => {
    for (const c of e.chapas) {
      expect(c.situacao).toBe("registro-protocolado");
    }
  });

  it("a chapa inelegível carrega a nota que o rótulo não diz sozinho", () => {
    const marcal = e.chapas.find((c) => c.id === "pablo-marcal")!;
    expect(marcal.nota).toContain("inelegível");
    expect(marcal.nota).toContain("não suspendeu");
  });

  it("a chapa de quem já tem dossiê aponta para a figura", () => {
    const lula = e.chapas.find((c) => c.id === "lula-2026")!;
    expect(lula.figura).toBe("lula");
    expect(acervo.figuras.some((f) => f.id === lula.figura)).toBe(true);
  });

  it("toda chapa tem candidato, partido e situação", () => {
    for (const c of e.chapas) {
      expect(c.candidato.length).toBeGreaterThan(0);
      expect(c.partido.length).toBeGreaterThan(0);
      expect(SituacaoDaCandidatura.options).toContain(c.situacao);
    }
  });

  it("os treze têm retrato, e todos do mesmo lote oficial", () => {
    expect(emRetratoUniforme(e.chapas)).toBe(true);
    for (const c of e.chapas) {
      expect(c.foto).toBeDefined();
      expect(c.foto!.credito).toContain("Tribunal Superior Eleitoral");
      expect(c.foto!.licenca).toBe("CC BY 4.0");
      expect(c.foto!.alt.length).toBeGreaterThan(0);
      // Servida do Commons e sem o rastreio que a API gruda na miniatura.
      expect(c.foto!.url.startsWith("https://upload.wikimedia.org/")).toBe(true);
      expect(c.foto!.url).not.toContain("?");
      expect(c.foto!.origem?.startsWith("https://commons.wikimedia.org/")).toBe(
        true
      );
    }
  });

  it("cada retrato é o do seu candidato, e não o do vizinho", () => {
    /*
     * Treze arquivos de nome quase igual, colhidos por script: trocar dois é
     * o erro mais fácil de cometer e o mais difícil de ver, porque a página
     * continua bonita e simétrica com os rostos errados. O `alt` carrega o
     * nome, então dá para conferir o par.
     */
    for (const c of e.chapas) {
      expect(c.foto!.alt).toContain(c.candidato);
    }
    const urls = e.chapas.map((c) => c.foto!.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("o retrato fora do lote se declara — e é o único", () => {
    const comLegenda = e.chapas.filter((c) => c.foto?.legenda);
    expect(comLegenda).toHaveLength(1);
    expect(comLegenda[0].id).toBe("lula-2026");
    expect(comLegenda[0].foto!.legenda).toContain("2022");
    expect(comLegenda[0].foto!.alt).toContain("2022");
  });

  it("as fontes existem e o país é o Brasil", () => {
    expect(e.paisIso).toBe("BRA");
    expect(eleicoesDoPais(acervo.eleicoes, "BRA")).toContain(e);
    for (const id of e.fontes) {
      expect(acervo.fontes.some((f) => f.id === id)).toBe(true);
    }
  });
});
