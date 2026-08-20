import path from "node:path";
import { describe, it, expect } from "vitest";
import { Pais, Periodo, estaDividido } from "./pais";
import { carregarAcervo } from "./carregar";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));

const periodo = {
  id: "br-nova-republica",
  inicio: "1985",
  fim: "1989",
  rotulo: "Nova República",
  regime: "democracia presidencialista",
};

describe("Periodo", () => {
  it("aceita um período fechado", () => {
    expect(Periodo.safeParse(periodo).success).toBe(true);
  });

  it("aceita período aberto — o atual não tem fim", () => {
    const { fim: _fim, ...aberto } = periodo;
    expect(Periodo.safeParse(aberto).success).toBe(true);
  });

  it("REJEITA período que termina antes de começar", () => {
    const r = Periodo.safeParse({ ...periodo, inicio: "1989", fim: "1985" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/antes/i);
  });

  it("REJEITA inversão dentro do mesmo ano, não só entre anos", () => {
    const r = Periodo.safeParse({
      ...periodo,
      inicio: "1985-06-01",
      fim: "1985-02-01",
    });
    expect(r.success).toBe(false);
  });

  it("aceita período que começa e termina no mesmo ano", () => {
    expect(Periodo.safeParse({ ...periodo, inicio: "1985", fim: "1985" }).success).toBe(
      true
    );
  });

  it("aceita ano de três dígitos", () => {
    expect(Periodo.safeParse({ ...periodo, inicio: "843", fim: "987" }).success).toBe(
      true
    );
  });

  it("exige rotulo — é onde vive o nome da entidade política da época", () => {
    expect(Periodo.safeParse({ ...periodo, rotulo: "" }).success).toBe(false);
  });
});

describe("Periodo com entidades", () => {
  const dividido = {
    id: "de-divisao",
    inicio: "1949",
    fim: "1990",
    rotulo: "Alemanha dividida",
    regime: "território dividido entre dois Estados soberanos",
    entidades: [
      { nome: "República Federal da Alemanha", regime: "parlamentarista federal" },
      { nome: "República Democrática Alemã", regime: "socialista de partido único" },
    ],
  };

  it("aceita período com duas entidades", () => {
    expect(Periodo.safeParse(dividido).success).toBe(true);
  });

  it("assume lista vazia quando entidades é omitido", () => {
    const r = Periodo.safeParse(periodo);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.entidades).toEqual([]);
  });

  it("REJEITA entidade única — uma só é o próprio período", () => {
    const r = Periodo.safeParse({ ...dividido, entidades: [dividido.entidades[0]] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/duas/i);
  });

  it("exige nome e regime de cada entidade", () => {
    expect(
      Periodo.safeParse({
        ...dividido,
        entidades: [{ nome: "", regime: "x" }, dividido.entidades[1]],
      }).success
    ).toBe(false);
  });

  it("aceita mais de duas entidades", () => {
    const r = Periodo.safeParse({
      ...dividido,
      entidades: [...dividido.entidades, { nome: "Sarre", regime: "protetorado" }],
    });
    expect(r.success).toBe(true);
  });
});

describe("estaDividido", () => {
  it("é verdadeiro com duas ou mais entidades", () => {
    const p = Periodo.parse({
      id: "x",
      inicio: "1949",
      rotulo: "r",
      regime: "g",
      entidades: [
        { nome: "A", regime: "a" },
        { nome: "B", regime: "b" },
      ],
    });
    expect(estaDividido(p)).toBe(true);
  });

  it("é falso sem entidades", () => {
    expect(estaDividido(Periodo.parse(periodo))).toBe(false);
  });
});

describe("Pais", () => {
  const brasil = {
    iso: "BRA",
    isoNumerico: "076",
    nome: "Brasil",
    periodos: [periodo],
  };

  it("aceita país com períodos", () => {
    expect(Pais.safeParse(brasil).success).toBe(true);
  });

  it.each(["br", "BR", "brasil", "BRAS"])("rejeita iso %s", (iso) => {
    expect(Pais.safeParse({ ...brasil, iso }).success).toBe(false);
  });

  /*
   * `isoNumerico` é o código com que o MAPA identifica país, e ele mora aqui —
   * no arquivo do próprio país — e não numa tabela central. A razão é de projeto
   * aberto: a tabela era o único arquivo compartilhado que um PR de país novo
   * precisava tocar, e com 165 países por escrever é onde eles colidiriam.
   *
   * O schema só confere a FORMA. Que o código aponte para um país que existe na
   * geometria é conferido no build, por `conferirCodigosDePais` — aqui não daria,
   * porque exigiria carregar o mundo inteiro para validar um schema.
   */
  it("exige isoNumerico com três dígitos", () => {
    expect(Pais.safeParse({ ...brasil, isoNumerico: "076" }).success).toBe(true);
    /* Zero à esquerda FAZ parte: "76" não é o código do Brasil, é forma errada. */
    expect(Pais.safeParse({ ...brasil, isoNumerico: "76" }).success).toBe(false);
    expect(Pais.safeParse({ ...brasil, isoNumerico: "0760" }).success).toBe(false);
    expect(Pais.safeParse({ ...brasil, isoNumerico: "BRA" }).success).toBe(false);
    expect(Pais.safeParse({ ...brasil, isoNumerico: 76 }).success).toBe(false);
  });

  it("REJEITA país sem isoNumerico — sem ele o dossiê não tem onde acender", () => {
    const semNumerico: Record<string, unknown> = { ...brasil };
    delete semNumerico.isoNumerico;
    expect(Pais.safeParse(semNumerico).success).toBe(false);
  });

  it("REJEITA país sem nenhum período — país sem retrato não existe no atlas", () => {
    expect(Pais.safeParse({ ...brasil, periodos: [] }).success).toBe(false);
  });
});

describe("a imagem do período, no acervo real", () => {
  const comImagem = acervo.paises.flatMap((p) =>
    p.periodos.filter((per) => per.imagem).map((per) => ({ pais: p, periodo: per }))
  );

  it("existe pelo menos uma, senão este bloco não está conferindo nada", () => {
    expect(comImagem.length).toBeGreaterThan(0);
  });

  it("toda imagem declara crédito, licença e descrição, e vem do Commons", () => {
    for (const { pais, periodo } of comImagem) {
      const onde = `${pais.iso}/${periodo.id}`;
      const img = periodo.imagem!;
      expect(img.credito.length, onde).toBeGreaterThan(0);
      expect(img.licenca.length, onde).toBeGreaterThan(0);
      expect(img.alt.length, onde).toBeGreaterThan(0);
      expect(img.url.startsWith("https://upload.wikimedia.org/"), onde).toBe(true);
      // O `?utm_source=` que a API gruda na miniatura é rastreio da consulta.
      expect(img.url, onde).not.toContain("?");
      expect(img.origem?.startsWith("https://commons.wikimedia.org/"), onde).toBe(
        true
      );
    }
  });

  it("nenhuma aponta para TIFF — navegador não desenha TIFF, baixa", () => {
    /*
     * Dois dos melhores documentos do Arquivo Nacional estão no Commons como
     * .tif, e o endereço do original parece igual ao de qualquer outro. Posto
     * cru, o período abriria com um download em vez de uma foto, e o build
     * passaria: o schema só confere que a URL é https. Quem serve é a
     * miniatura JPEG que o Commons gera (`lossy-page1-...tif.jpg`).
     */
    for (const { pais, periodo } of comImagem) {
      expect(periodo.imagem!.url, `${pais.iso}/${periodo.id}`).not.toMatch(
        /\.tiff?$/i
      );
    }
  });

  it("o Brasil tem imagem em todos os oito períodos, e todas legendadas", () => {
    const brasil = acervo.paises.find((p) => p.iso === "BRA")!;
    expect(brasil.periodos).toHaveLength(8);
    for (const p of brasil.periodos) {
      expect(p.imagem, p.id).toBeDefined();
      /*
       * `alt` diz o que a imagem mostra; `legenda` diz por que ela está ali.
       * Sem a segunda, uma foto de rua em 1875 é decoração — o leitor não tem
       * como saber que aquela rua era o centro comercial da capital do
       * Império, que é a única razão de ela abrir o período.
       */
      expect(p.imagem!.legenda, p.id).toBeTruthy();
    }
  });
});
