import { describe, it, expect } from "vitest";
import { casa, filtrar, normalizar } from "./busca";

/*
 * Os nomes de teste saem do acervo de verdade porque é ali que a busca falha:
 * "Luiz Inácio Lula da Silva" e "Fábio Luís Lula da Silva" dividem três
 * palavras, e as duas que os separam levam acento.
 */
const FIGURAS = [
  { id: "lula", nome: "Luiz Inácio Lula da Silva", cargo: "Presidente da República" },
  { id: "bolsonaro", nome: "Jair Messias Bolsonaro", cargo: "Presidente da República" },
  { id: "fabio-luis", nome: "Fábio Luís Lula da Silva", cargo: undefined },
  { id: "joana", nome: "Joana d'Arc", cargo: undefined },
];

const texto = (f: (typeof FIGURAS)[number]) => `${f.nome} ${f.cargo ?? ""}`;

describe("normalizar", () => {
  it("tira o acento e baixa a caixa", () => {
    expect(normalizar("Inácio")).toBe("inacio");
    expect(normalizar("FÁBIO LUÍS")).toBe("fabio luis");
    expect(normalizar("João Maurício")).toBe("joao mauricio");
  });

  it("preserva o ç como c, que é o que quem digita espera", () => {
    expect(normalizar("Conceição")).toBe("conceicao");
  });

  it("colapsa espaço repetido e apara as pontas", () => {
    expect(normalizar("  Lula   da   Silva ")).toBe("lula da silva");
  });

  it("é idempotente — normalizar duas vezes dá o mesmo", () => {
    const uma = normalizar("Fábio Luís");
    expect(normalizar(uma)).toBe(uma);
  });
});

describe("casa", () => {
  it("acha mesmo quando quem digita ignora o acento", () => {
    expect(casa("Luiz Inácio Lula da Silva", "inacio")).toBe(true);
    expect(casa("Fábio Luís Lula da Silva", "fabio luis")).toBe(true);
  });

  it("acha mesmo quando quem digita PÕE o acento", () => {
    expect(casa("Luiz Inacio", "Inácio")).toBe(true);
  });

  it("ignora a ordem das palavras", () => {
    expect(casa("Luiz Inácio Lula da Silva", "silva lula")).toBe(true);
  });

  it("exige TODAS as palavras da consulta", () => {
    expect(casa("Jair Messias Bolsonaro", "jair lula")).toBe(false);
  });

  it("casa no meio da palavra — quem lembra do sobrenome não digita o começo", () => {
    expect(casa("Bolsonaro", "sonaro")).toBe(true);
  });

  it("consulta vazia ou só de espaço casa com tudo", () => {
    expect(casa("qualquer coisa", "")).toBe(true);
    expect(casa("qualquer coisa", "   ")).toBe(true);
  });
});

describe("filtrar", () => {
  it("sem consulta devolve a lista inteira", () => {
    expect(filtrar(FIGURAS, "", texto)).toHaveLength(4);
    expect(filtrar(FIGURAS, "  ", texto)).toHaveLength(4);
  });

  it("separa os dois Lula da Silva pelo primeiro nome", () => {
    expect(filtrar(FIGURAS, "fabio", texto).map((f) => f.id)).toEqual([
      "fabio-luis",
    ]);
    expect(filtrar(FIGURAS, "luiz", texto).map((f) => f.id)).toEqual(["lula"]);
  });

  it("o sobrenome comum devolve os dois", () => {
    expect(filtrar(FIGURAS, "lula da silva", texto).map((f) => f.id)).toEqual([
      "lula",
      "fabio-luis",
    ]);
  });

  it("acha pelo cargo, sem precisar do nome", () => {
    expect(filtrar(FIGURAS, "presidente", texto).map((f) => f.id)).toEqual([
      "lula",
      "bolsonaro",
    ]);
  });

  it("preserva a ordem de origem — filtrar esconde, não reordena", () => {
    const r = filtrar(FIGURAS, "a", texto).map((f) => f.id);
    const ordem = FIGURAS.map((f) => f.id).filter((id) => r.includes(id));
    expect(r).toEqual(ordem);
  });

  it("devolve lista vazia quando nada casa, e não a original", () => {
    expect(filtrar(FIGURAS, "churchill", texto)).toEqual([]);
  });

  it("não devolve a mesma referência da lista de entrada", () => {
    // Um `return itens` no atalho da consulta vazia deixaria quem chama
    // mutando o acervo sem saber.
    const r = filtrar(FIGURAS, "", texto);
    expect(r).not.toBe(FIGURAS);
    expect(r).toEqual([...FIGURAS]);
  });

  it("apóstrofo não quebra a busca", () => {
    expect(filtrar(FIGURAS, "d'arc", texto).map((f) => f.id)).toEqual(["joana"]);
  });
});
