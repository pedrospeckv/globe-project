import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  ligacoesEm,
  indexarAlvos,
  resolverLigacoes,
  verificarLigacoes,
} from "./ligacoes";
import { carregarAcervo } from "./carregar";
import type { Acervo } from "./integridade";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));
const alvos = indexarAlvos(acervo);

function acervoVazio(): Acervo {
  return {
    fontes: [],
    paises: [],
    figuras: [],
    viagens: [],
    indicadores: [],
    eventos: [],
    episodios: [],
    notas: [],
    ilhas: [],
  };
}

describe("ligacoesEm", () => {
  it("extrai os alvos citados", () => {
    expect(ligacoesEm("ver [[lula]] e [[br-imperio]]")).toEqual([
      "lula",
      "br-imperio",
    ]);
  });

  it("entende o rótulo depois da barra", () => {
    expect(ligacoesEm("[[lula|o presidente]]")).toEqual(["lula"]);
  });

  it("não repete o mesmo alvo", () => {
    expect(ligacoesEm("[[lula]] e depois [[lula]]")).toEqual(["lula"]);
  });

  it("ignora colchete solto e link markdown comum", () => {
    expect(ligacoesEm("[texto](/pais/BRA) e [isto] não")).toEqual([]);
    expect(ligacoesEm(undefined)).toEqual([]);
  });
});

describe("indexarAlvos", () => {
  it("indexa país, período e figura do acervo real", () => {
    expect(alvos["BRA"]).toMatchObject({ rotulo: "Brasil", href: "/pais/BRA" });
    expect(alvos["br-regime-militar"]).toMatchObject({
      tipo: "periodo",
      href: "/pais/BRA/br-regime-militar",
    });
    expect(alvos["lula"]).toMatchObject({
      tipo: "figura",
      href: "/figura/lula",
    });
  });

  it("NÃO indexa fonte — ela não tem página", () => {
    // Uma ligação para fonte deve falhar na validação, não virar link morto.
    expect(acervo.fontes.length).toBeGreaterThan(0);
    for (const f of acervo.fontes) expect(alvos[f.id]).toBeUndefined();
  });
});

describe("resolverLigacoes", () => {
  it("troca a ligação pelo rótulo do alvo", () => {
    expect(resolverLigacoes("veja [[lula]] aqui", alvos)).toBe(
      "veja [Luiz Inácio Lula da Silva](/figura/lula) aqui"
    );
  });

  it("respeita o rótulo escrito à mão", () => {
    expect(resolverLigacoes("[[lula|Lula]]", alvos)).toBe("[Lula](/figura/lula)");
  });

  it("alvo desconhecido vira texto simples, nunca link quebrado", () => {
    expect(resolverLigacoes("[[fantasma]]", alvos)).toBe("fantasma");
    expect(resolverLigacoes("[[fantasma|assombração]]", alvos)).toBe("assombração");
  });

  it("não mexe em texto sem ligação", () => {
    const t = "Um [link](/x) comum e **negrito**.";
    expect(resolverLigacoes(t, alvos)).toBe(t);
    expect(resolverLigacoes(undefined, alvos)).toBeUndefined();
  });
});

describe("verificarLigacoes", () => {
  it("o acervo real não tem ligação quebrada", () => {
    expect(verificarLigacoes(acervo)).toEqual([]);
  });

  it("ACUSA ligação para alvo inexistente", () => {
    const a = acervoVazio();
    a.paises.push({
      iso: "BRA",
      nome: "Brasil",
      periodos: [
        {
          id: "br-x",
          inicio: "1500",
          rotulo: "X",
          regime: "y",
          entidades: [], fontes: [],
          textoMdx: "aponta para [[nao-existe]]",
        },
      ],
    });
    const erros = verificarLigacoes(a);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/br-x.*nao-existe/);
  });

  it("ACUSA id repetido entre tipos diferentes", () => {
    /*
     * `[[x]]` não diz de que tipo é o alvo. Duas coisas com o mesmo id
     * fariam uma sobrescrever a outra no índice, e o texto apontaria para o
     * lugar errado sem sinal nenhum.
     */
    const a = acervoVazio();
    a.paises.push({
      iso: "BRA",
      nome: "Brasil",
      periodos: [
        { id: "colisao", inicio: "1500", rotulo: "X", regime: "y", entidades: [], fontes: [] },
      ],
    });
    a.figuras.push({
      id: "colisao",
      nome: "Alguém",
      paisIso: "BRA",
      cargos: [],
      trajetoria: [],
      fontes: [],
      alegacoes: [],
    });
    expect(verificarLigacoes(a).some((e) => /mais de um alvo/.test(e))).toBe(true);
  });

  it("ACUSA fonte que divide id com um alvo", () => {
    /*
     * Aconteceu de verdade: "magna-carta" era evento, e o documento entrou
     * com o mesmo id. `[[magna-carta]]` resolveria para o evento e a lista
     * de fontes citaria o documento — duas coisas com o mesmo nome, sem que
     * nada acusasse.
     */
    const a = acervoVazio();
    a.paises.push({
      iso: "BRA",
      nome: "Brasil",
      periodos: [
        { id: "algo", inicio: "1500", rotulo: "X", regime: "y", entidades: [], fontes: [] },
      ],
    });
    a.fontes.push({ id: "algo", tipo: "livro", titulo: "Livro homônimo" });
    expect(verificarLigacoes(a).some((e) => /mesmo id de um alvo/.test(e))).toBe(true);
  });

  it("ACUSA ligação malformada, que o padrão não pegaria", () => {
    /*
     * `[[x]` com um colchete só não casa o padrão: não seria acusada como
     * alvo inexistente e chegaria à tela como texto cru. O erro é de
     * sintaxe, e o build precisa dizer isso.
     */
    const a = acervoVazio();
    a.paises.push({
      iso: "BRA",
      nome: "Brasil",
      periodos: [
        {
          id: "br-x",
          inicio: "1500",
          rotulo: "X",
          regime: "y",
          entidades: [], fontes: [],
          textoMdx: "ficou [[br-x] pela metade",
        },
      ],
    });
    expect(verificarLigacoes(a).some((e) => /malformada/.test(e))).toBe(true);
  });

  it("varre entidade, evento, viagem e parada, não só o período", () => {
    const a = acervoVazio();
    a.eventos.push({
      id: "ev",
      data: "1500",
      titulo: "E",
      ponto: [0, 0],
      paises: ["BRA"],
      fontes: [],
      textoMdx: "[[some-daqui]]",
    });
    a.viagens.push({
      id: "vi",
      titulo: "V",
      fontes: [],
      paradas: [
        { local: "A", data: "1500", coords: [0, 0], textoMdx: "[[outro-fantasma]]" },
        { local: "B", data: "1501", coords: [1, 1] },
      ],
    });
    const erros = verificarLigacoes(a);
    expect(erros.some((e) => /evento "ev".*some-daqui/.test(e))).toBe(true);
    expect(erros.some((e) => /parada "A".*outro-fantasma/.test(e))).toBe(true);
  });
});
