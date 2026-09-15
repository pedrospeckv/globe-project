import { describe, expect, it } from "vitest";
import { escolher, lerPedido, nomeDoLote, repartir } from "./preparar-lote";
import { encolheuDemais, lerResposta, palavras } from "./aplicar-lote";
import type { EstiloDoPais } from "../lib/conteudo/estilo";

const pais = (iso: string, fp: number): EstiloDoPais => ({
  iso,
  nome: iso,
  palavras: 500,
  futuroDoPreterito: fp,
  avaliativo: 0,
  dentro: false,
});

describe("lerPedido", () => {
  it("sem argumento, não pede nada — quem escolhe é a fila", () => {
    expect(lerPedido([])).toEqual({});
  });

  it("número é quantidade", () => {
    expect(lerPedido(["5"])).toEqual({ quantos: 5 });
  });

  it("três letras são código de país, e sobem para maiúscula", () => {
    expect(lerPedido(["mda", "SWZ"])).toEqual({ isos: ["MDA", "SWZ"] });
  });

  /*
   * `pnpm lote BRA 5` é ambíguo, e ambiguidade sem regra vira comportamento
   * acidental. A regra é: o número ganha.
   */
  it("número e lista juntos: o número ganha", () => {
    expect(lerPedido(["BRA", "5"])).toEqual({ quantos: 5 });
  });
});

describe("escolher", () => {
  const fila = [pais("MDA", 31.2), pais("SWZ", 31.2), pais("MDG", 29.9)];

  it("sem pedido, pega do começo da fila — o pior primeiro", () => {
    expect(escolher(fila, { quantos: 2 }).map((p) => p.iso)).toEqual(["MDA", "SWZ"]);
  });

  it("com ISOs, respeita a ordem pedida e não a da fila", () => {
    expect(escolher(fila, { isos: ["MDG", "MDA"] }).map((p) => p.iso)).toEqual([
      "MDG",
      "MDA",
    ]);
  });

  /*
   * País fora da fila é país que já está dentro dos tetos. Pedi-lo não é erro
   * de digitação necessariamente — mas incluí-lo num lote de reescrita seria
   * mandar reescrever o que já está bom.
   */
  it("ignora ISO que não está na fila de reescrita", () => {
    expect(escolher(fila, { isos: ["MDA", "CHN"] }).map((p) => p.iso)).toEqual(["MDA"]);
  });
});

describe("nomeDoLote", () => {
  it("é numerado e alinhado, para ordenar direito na pasta", () => {
    expect(nomeDoLote(1)).toBe("lote-01.md");
    expect(nomeDoLote(13)).toBe("lote-13.md");
  });
});

describe("repartir", () => {
  const fila = Array.from({ length: 13 }, (_, i) => pais(`P${i}`, 30 - i));

  it("reparte na ordem da fila — o pior lote é o primeiro", () => {
    const lotes = repartir(fila, 5);
    expect(lotes.map((l) => l.length)).toEqual([5, 5, 3]);
    expect(lotes[0][0].iso).toBe("P0");
  });

  /*
   * A garantia que permite as sessões correrem em paralelo: se um país
   * aparecesse em dois lotes, duas sessões escreveriam no mesmo arquivo.
   */
  it("nenhum país cai em dois lotes, e nenhum fica de fora", () => {
    const lotes = repartir(fila, 4);
    const todos = lotes.flat().map((p) => p.iso);
    expect(todos).toHaveLength(fila.length);
    expect(new Set(todos).size).toBe(fila.length);
  });

  it("fila vazia não produz lote nenhum", () => {
    expect(repartir([], 10)).toEqual([]);
  });
});

describe("lerResposta", () => {
  const esperado = { periodos: { "br-imperio": "texto novo" } };

  it("aceita JSON puro", () => {
    expect(lerResposta('{"periodos":{"br-imperio":"texto novo"}}')).toEqual(esperado);
  });

  /*
   * Modelos devolvem cerca de markdown mesmo quando o pedido diz "só o JSON".
   * Recusar por causa dela faria a pessoa editar à mão exatamente o arquivo
   * que este script existe para não ser editado à mão.
   */
  it("aceita dentro de cerca de markdown", () => {
    const bruto = 'Claro! Aqui está:\n\n```json\n{"periodos":{"br-imperio":"texto novo"}}\n```\n\nRessalvas: nenhuma.';
    expect(lerResposta(bruto)).toEqual(esperado);
  });

  it("aceita prosa em volta, sem cerca", () => {
    const bruto = 'Aqui vai:\n{"periodos":{"br-imperio":"texto novo"}}\nNão consegui o terceiro período.';
    expect(lerResposta(bruto)).toEqual(esperado);
  });

  it("recusa resposta sem JSON", () => {
    expect(() => lerResposta("não consegui fazer o lote")).toThrow(/não achei JSON/);
  });

  it("recusa JSON sem a chave periodos", () => {
    expect(() => lerResposta('{"paises":{}}')).toThrow(/periodos/);
  });

  it("recusa período que veio vazio — silêncio não é reescrita", () => {
    expect(() => lerResposta('{"periodos":{"br-imperio":"   "}}')).toThrow(
      /br-imperio/
    );
  });
});

describe("encolheuDemais", () => {
  const texto = (n: number) => Array.from({ length: n }, () => "palavra").join(" ");

  it("trocar registro mexe pouco no tamanho, e isso passa", () => {
    expect(encolheuDemais(texto(100), texto(95))).toBe(false);
    expect(encolheuDemais(texto(100), texto(80))).toBe(false);
  });

  it("perder um terço das palavras é resumo, e para o lote", () => {
    expect(encolheuDemais(texto(100), texto(66))).toBe(true);
  });

  /*
   * Crescer nunca acusa: pôr o detalhe concreto no lugar do advérbio é
   * exatamente o que a tarefa pede.
   */
  it("crescer nunca acusa", () => {
    expect(encolheuDemais(texto(100), texto(140))).toBe(false);
  });

  it("conta palavras como a medida de registro conta", () => {
    expect(palavras("  duas   palavras  ")).toBe(2);
    expect(palavras("")).toBe(0);
  });
});

describe("lerResposta — lote de ilustração", () => {
  const img = {
    url: "https://upload.wikimedia.org/x.jpg",
    alt: "o que se vê",
    credito: "Autor · Acervo",
    licenca: "CC BY-SA 4.0",
    origem: "https://commons.wikimedia.org/wiki/File:X.jpg",
  };

  it("aceita a chave imagens", () => {
    const r = lerResposta(JSON.stringify({ imagens: { "bs-colonia": img } }));
    expect(r.imagens?.["bs-colonia"]).toMatchObject({ licenca: "CC BY-SA 4.0" });
  });

  /*
   * `origem` é opcional no schema porque o acervo antigo não a tem, e
   * obrigatória num lote novo: é a página onde outra pessoa confere a licença
   * que o modelo declarou. Sem ela a declaração é palavra do modelo.
   */
  it("recusa imagem sem origem", () => {
    const { origem: _, ...semOrigem } = img;
    expect(() =>
      lerResposta(JSON.stringify({ imagens: { "bs-colonia": semOrigem } }))
    ).toThrow(/origem/);
  });

  it("recusa imagem sem crédito ou sem licença, e diz qual campo faltou", () => {
    const { credito: _c, ...semCredito } = img;
    expect(() =>
      lerResposta(JSON.stringify({ imagens: { x: semCredito } }))
    ).toThrow(/credito/);
    const { licenca: _l, ...semLicenca } = img;
    expect(() =>
      lerResposta(JSON.stringify({ imagens: { x: semLicenca } }))
    ).toThrow(/licenca/);
  });

  it("recusa JSON que não traz nem periodos nem imagens", () => {
    expect(() => lerResposta('{"paises":{}}')).toThrow(/periodos.*imagens/);
  });
});
