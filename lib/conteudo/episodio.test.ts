import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  Episodio,
  episodiosDoPais,
  episodiosDoPeriodo,
  imagensDe,
} from "./episodio";
import { carregarAcervo } from "./carregar";
import { verificarIntegridade } from "./integridade";
import { indexarAlvos, verificarLigacoes } from "./ligacoes";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));

/** Um episódio mínimo que passa, para os testes o deformarem de um campo por vez. */
function base() {
  return {
    id: "teste",
    titulo: "Episódio de teste",
    inicio: "1600",
    fim: "1610",
    paises: ["BRA"],
    periodos: [],
    abertura: "Abertura.",
    blocos: [
      { id: "um", data: "1600", titulo: "Um", textoMdx: "Texto um." },
      { id: "dois", data: "1605", titulo: "Dois", textoMdx: "Texto dois." },
    ],
    fontes: ["alguma-fonte"],
  };
}

describe("schema do episódio", () => {
  it("aceita o caso mínimo", () => {
    expect(Episodio.safeParse(base()).success).toBe(true);
  });

  it("recusa episódio sem fonte — é a diferença dele para o evento", () => {
    const r = Episodio.safeParse({ ...base(), fontes: [] });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("ao menos uma fonte");
  });

  it("recusa episódio de um bloco só — isso é um parágrafo, não um trilho", () => {
    const e = base();
    const r = Episodio.safeParse({ ...e, blocos: [e.blocos[0]] });
    expect(r.success).toBe(false);
  });

  it("recusa blocos fora de ordem cronológica", () => {
    const e = base();
    const r = Episodio.safeParse({ ...e, blocos: [e.blocos[1], e.blocos[0]] });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("fora de ordem");
  });

  it("aceita blocos com a mesma data — três facetas do mesmo ano ordenam empatadas", () => {
    const e = base();
    const r = Episodio.safeParse({
      ...e,
      blocos: e.blocos.map((b) => ({ ...b, data: "1600" })),
    });
    expect(r.success).toBe(true);
  });

  it("recusa episódio que termina antes de começar", () => {
    const r = Episodio.safeParse({ ...base(), inicio: "1610", fim: "1600" });
    expect(r.success).toBe(false);
  });

  it("recusa bloco sem texto", () => {
    const e = base();
    const r = Episodio.safeParse({
      ...e,
      blocos: [{ ...e.blocos[0], textoMdx: "" }, e.blocos[1]],
    });
    expect(r.success).toBe(false);
  });

  it("a imagem do bloco continua exigindo crédito, licença e alt", () => {
    const e = base();
    const semCredito = {
      ...e,
      blocos: [
        {
          ...e.blocos[0],
          imagem: {
            url: "https://exemplo.org/a.jpg",
            alt: "descrição",
            licenca: "Domínio público",
          },
        },
        e.blocos[1],
      ],
    };
    expect(Episodio.safeParse(semCredito).success).toBe(false);
  });
});

describe("consultas de episódio", () => {
  const um = { ...base(), id: "um", inicio: "1700", periodos: ["p-a"] };
  const dois = {
    ...base(),
    id: "dois",
    inicio: "1600",
    paises: ["BRA", "PRT"],
    periodos: ["p-a", "p-b"],
  };
  const lista = [um, dois] as unknown as Episodio[];

  it("ordena do mais antigo para o mais recente", () => {
    expect(episodiosDoPais(lista, "BRA").map((e) => e.id)).toEqual(["dois", "um"]);
  });

  it("filtra por país", () => {
    expect(episodiosDoPais(lista, "PRT").map((e) => e.id)).toEqual(["dois"]);
  });

  it("filtra por período", () => {
    expect(episodiosDoPeriodo(lista, "p-b").map((e) => e.id)).toEqual(["dois"]);
    expect(episodiosDoPeriodo(lista, "p-a")).toHaveLength(2);
  });

  it("conta só os blocos que têm imagem", () => {
    expect(imagensDe(um as unknown as Episodio)).toBe(0);
  });
});

describe("integridade cruzando arquivos", () => {
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

  it("acusa país que não está no atlas", () => {
    const erros = verificarIntegridade({
      ...vazio,
      episodios: [{ ...base(), paises: ["XYZ"] }] as unknown as Episodio[],
    });
    expect(erros.some((e) => e.includes("XYZ"))).toBe(true);
  });

  it("acusa período apontado que não existe", () => {
    const erros = verificarIntegridade({
      ...vazio,
      episodios: [
        { ...base(), paises: [], periodos: ["nao-existe"] },
      ] as unknown as Episodio[],
    });
    expect(erros.some((e) => e.includes("período inexistente"))).toBe(true);
  });

  it("acusa fonte inexistente, como em toda entidade do acervo", () => {
    const erros = verificarIntegridade({
      ...vazio,
      episodios: [{ ...base(), paises: [] }] as unknown as Episodio[],
    });
    expect(erros.some((e) => e.includes("alguma-fonte"))).toBe(true);
  });

  it("acusa bloco com id repetido — âncora duplicada leva ao lugar errado", () => {
    const e = base();
    const erros = verificarIntegridade({
      ...vazio,
      episodios: [
        {
          ...e,
          paises: [],
          fontes: [],
          blocos: [e.blocos[0], { ...e.blocos[1], id: "um" }],
        },
      ] as unknown as Episodio[],
    });
    expect(erros.some((er) => er.includes("bloco com id duplicado"))).toBe(true);
  });
});

describe("o episódio no espaço de nomes das ligações", () => {
  it("vira alvo com página própria", () => {
    const alvos = indexarAlvos({
      fontes: [],
      paises: [],
      figuras: [],
      viagens: [],
      indicadores: [],
      eventos: [],
      episodios: [base()] as unknown as Episodio[],
      eleicoes: [],
      notas: [],
      ilhas: [],
    });
    expect(alvos["teste"]).toEqual({
      id: "teste",
      rotulo: "Episódio de teste",
      href: "/episodio/teste",
      tipo: "episodio",
    });
  });

  it("o texto do bloco é varrido como o resto — ligação morta não passa", () => {
    const e = base();
    const erros = verificarLigacoes({
      fontes: [],
      paises: [],
      figuras: [],
      viagens: [],
      indicadores: [],
      eventos: [],
      episodios: [
        {
          ...e,
          blocos: [
            { ...e.blocos[0], textoMdx: "vai para [[lugar-nenhum]]" },
            e.blocos[1],
          ],
        },
      ] as unknown as Episodio[],
      eleicoes: [],
      notas: [],
      ilhas: [],
    });
    expect(erros.some((er) => er.includes("lugar-nenhum"))).toBe(true);
  });
});

describe("os episódios que estão no acervo", () => {
  it("existem, e cada um tem fonte de verdade", () => {
    expect(acervo.episodios.length).toBeGreaterThan(0);
    for (const e of acervo.episodios) {
      expect(e.fontes.length).toBeGreaterThan(0);
      for (const id of e.fontes) {
        expect(acervo.fontes.some((f) => f.id === id)).toBe(true);
      }
    }
  });

  it("toda imagem declara crédito, licença e descrição, e vem do Commons", () => {
    const imagens = acervo.episodios.flatMap((e) =>
      e.blocos.flatMap((b) => (b.imagem ? [b.imagem] : []))
    );
    expect(imagens.length).toBeGreaterThan(0);
    for (const img of imagens) {
      expect(img.credito.length).toBeGreaterThan(0);
      expect(img.licenca.length).toBeGreaterThan(0);
      expect(img.alt.length).toBeGreaterThan(0);
      /*
       * Servida do Commons e sem parâmetro de consulta. O `?utm_source=...`
       * que a API gruda na miniatura é telemetria da consulta, e guardá-lo no
       * acervo mandaria o rastreio para todo leitor — ver `semRastreio`.
       */
      expect(img.url.startsWith("https://upload.wikimedia.org/")).toBe(true);
      expect(img.url).not.toContain("?");
      expect(img.origem?.startsWith("https://commons.wikimedia.org/")).toBe(true);
    }
  });

  it("todo episódio aponta para período que existe no país que ele declara", () => {
    for (const e of acervo.episodios) {
      for (const periodoId of e.periodos) {
        const dono = acervo.paises.find((p) =>
          p.periodos.some((per) => per.id === periodoId)
        );
        expect(dono).toBeDefined();
        expect(e.paises).toContain(dono!.iso);
      }
    }
  });
});
