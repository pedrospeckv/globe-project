import { describe, it, expect } from "vitest";
import { geoArea, geoBounds } from "d3-geo";
import {
  carregarMundo,
  conferirCodigosDePais,
  prepararMundo,
  separarPaises,
  separarUltramar,
} from "./mundo";
import { criarTraducaoIso } from "./iso";
import { ISOS_DO_ACERVO, PAISES_DO_ACERVO } from "./__fixtures__/acervo";

/*
 * A tradução é montada do acervo, e não vem de tabela global: o código numérico
 * mora no arquivo de cada país desde 2026-08-19, para que PR de país novo não
 * toque em arquivo compartilhado. Ver `lib/geo/iso.ts`.
 */
const { alpha3De } = criarTraducaoIso(PAISES_DO_ACERVO);

/** Decomposição estática, feita uma vez — como na página. */
async function prepararTudo() {
  const mundo = await carregarMundo();
  return { mundo, preparado: prepararMundo(mundo, PAISES_DO_ACERVO) };
}

describe("carregarMundo", () => {
  it("devolve features de país", async () => {
    const mundo = await carregarMundo();
    expect(mundo.length).toBeGreaterThan(150);
    expect(mundo[0].type).toBe("Feature");
  });

  it("ENCONTRA todos os países do atlas no topojson", async () => {
    // Guarda contra o problema clássico de Natural Earth, em que um país vem
    // com código inválido e simplesmente some do mapa sem erro nenhum.
    const { preparado } = await prepararTudo();
    const { curados } = separarPaises(preparado, ISOS_DO_ACERVO);
    const achados = curados.map((f) => f.alpha3).sort();
    expect(achados).toEqual([...ISOS_DO_ACERVO].sort());
  });

  it("separa curados de fundo sem perder país nem duplicar", async () => {
    const { mundo, preparado } = await prepararTudo();
    const { curados, fundo } = separarPaises(preparado, ISOS_DO_ACERVO);

    // Cada país do atlas aparece uma vez só entre os curados.
    expect(new Set(curados.map((c) => c.alpha3)).size).toBe(curados.length);

    /*
     * O total PASSA de mundo.length, e isso é o recorte funcionando: um país
     * com ultramar ou com território disputado vira mais de uma feição — o
     * principal, que acende, e os pedaços, que descem para o fundo. Nada é
     * descartado, e a conta diz exatamente quantos pedaços nasceram.
     */
    const pedacos = preparado.paises.reduce(
      (s, p) => s + (p.ultramar ? 1 : 0) + p.disputados.length,
      0
    );
    expect(curados.length + fundo.length).toBe(mundo.length + pedacos);
    expect(pedacos).toBeGreaterThan(0);
  });

  describe("separarUltramar", () => {
    /*
     * O atlas desenha a forma moderna em todos os períodos. Para uma
     * fronteira que andou algumas centenas de quilômetros isso é aproximação
     * tolerável; para um território em outro continente é afirmação falsa —
     * com a França acesa em 1200, a Guiana Francesa acendia junto.
     */
    it("tira a Guiana Francesa do território aceso da França", async () => {
      const mundo = await carregarMundo();
      const franca = mundo.find(
        (f) => f.id !== undefined && alpha3De(f.id as string) === "FRA"
      )!;
      const { principal, ultramar } = separarUltramar(franca);

      expect(principal).not.toBeNull();
      expect(ultramar).not.toBeNull();

      const caixa = geoBounds(principal!);
      // Nada do território principal cruza o Atlântico.
      expect(caixa[0][0]).toBeGreaterThan(-20);
      expect(caixa[0][1]).toBeGreaterThan(35);

      // E a Guiana continua existindo, do outro lado.
      expect(geoBounds(ultramar!)[0][0]).toBeLessThan(-40);
    });

    it("mantém colado o que é colado — Alasca, Sacalina, ilhas do Japão", async () => {
      const mundo = await carregarMundo();
      for (const iso of ["JPN", "RUS"] as const) {
        const f = mundo.find(
          (x) => x.id !== undefined && alpha3De(x.id as string) === iso
        )!;
        expect(separarUltramar(f).ultramar).toBeNull();
      }
    });

    it("país de uma parte só passa intacto", async () => {
      const mundo = await carregarMundo();
      const brasil = mundo.find(
        (f) => f.id !== undefined && alpha3De(f.id as string) === "BRA"
      )!;
      const { principal, ultramar } = separarUltramar(brasil);
      expect(principal).toBe(brasil);
      expect(ultramar).toBeNull();
    });

    it("o ultramar desce para o fundo em vez de sumir do mapa", async () => {
      const { mundo, preparado } = await prepararTudo();
      const semAtlas = separarPaises(preparado, []).fundo.length;
      const comAtlas = separarPaises(preparado, ISOS_DO_ACERVO);
      const areaTotal = (fs: { geometry: unknown }[]) =>
        fs.reduce((s, f) => s + geoArea(f as Parameters<typeof geoArea>[0]), 0);

      expect(comAtlas.fundo.length).toBeGreaterThan(
        semAtlas - ISOS_DO_ACERVO.length
      );
      // A soma das áreas continua sendo o mundo inteiro.
      expect(
        areaTotal(comAtlas.fundo) + areaTotal(comAtlas.curados.map((c) => c.feature))
      ).toBeCloseTo(areaTotal(mundo), 6);
    });
  });

  it("cada país curado carrega geometria utilizável", async () => {
    const { preparado } = await prepararTudo();
    const { curados } = separarPaises(preparado, ISOS_DO_ACERVO);
    for (const c of curados) {
      expect(["Polygon", "MultiPolygon"]).toContain(c.feature.geometry.type);
    }
  });

  it("aceita subconjunto — acender só os países que têm conteúdo", async () => {
    const { preparado } = await prepararTudo();
    const { curados } = separarPaises(preparado, ["BRA", "FRA"]);
    expect(curados.map((c) => c.alpha3).sort()).toEqual(["BRA", "FRA"]);
  });

  describe("custo", () => {
    /*
     * O recorte de ultramar já esteve dentro do caminho que roda a cada
     * mexida na barra: 200ms por quadro, a interface emperrada. Este teste
     * fixa a separação — o que é por instante não pode voltar a tocar em
     * geometria.
     */
    it("escolher o que desenhar é barato depois da decomposição", async () => {
      const { preparado } = await prepararTudo();

      const t0 = performance.now();
      for (let i = 0; i < 200; i++) {
        separarPaises(preparado, ISOS_DO_ACERVO, ["crimeia"]);
      }
      const porChamada = (performance.now() - t0) / 200;

      expect(porChamada).toBeLessThan(1);
    });
  });
});

describe("conferirCodigosDePais", () => {
  /*
   * Esta é a rede que sustenta a decisão de tirar a tabela central de `iso.ts`.
   * Sem ela, tirar a tabela só teria MUDADO O LUGAR do erro: um número trocado
   * faria o dossiê acender no polígono do vizinho, ou não acender em lugar
   * nenhum — e a segunda passa despercebida, porque país que não acende parece
   * país que ainda não foi escrito.
   */
  it("aprova o acervo real e diz que país cada código achou", async () => {
    const mundo = await carregarMundo();
    const { problemas, conferidos } = conferirCodigosDePais(mundo, PAISES_DO_ACERVO);

    expect(problemas).toEqual([]);
    expect(conferidos).toHaveLength(PAISES_DO_ACERVO.length);
    /* O nome vem da base, em inglês, e é o que deixa um humano ver o acerto. */
    const brasil = conferidos.find((c) => c.iso === "BRA");
    expect(brasil).toMatchObject({ isoNumerico: "076", noMapa: "Brazil" });
  });

  it("acusa código que não existe na geometria", async () => {
    const mundo = await carregarMundo();
    const { problemas } = conferirCodigosDePais(mundo, [
      { iso: "XXX", isoNumerico: "999" },
    ]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/XXX.*não existe país com o código numérico 999/);
  });

  it("acusa dois países com o mesmo código numérico", async () => {
    const mundo = await carregarMundo();
    const { problemas } = conferirCodigosDePais(mundo, [
      { iso: "BRA", isoNumerico: "076" },
      { iso: "ARG", isoNumerico: "076" },
    ]);
    expect(problemas.some((p) => /076 já é de BRA/.test(p))).toBe(true);
  });

  /*
   * Devolve TODOS os problemas, e não estoura no primeiro: quem roda o build
   * quer saber tudo o que precisa arrumar numa passada.
   */
  it("junta os problemas em vez de parar no primeiro", async () => {
    const mundo = await carregarMundo();
    const { problemas } = conferirCodigosDePais(mundo, [
      { iso: "XXX", isoNumerico: "998" },
      { iso: "YYY", isoNumerico: "999" },
    ]);
    expect(problemas).toHaveLength(2);
  });

  /* Normaliza o zero à esquerda dos dois lados — o topojson não é consistente. */
  it("casa mesmo que o código venha sem zero à esquerda", async () => {
    const mundo = await carregarMundo();
    const { problemas, conferidos } = conferirCodigosDePais(mundo, [
      { iso: "BRA", isoNumerico: "76" },
    ]);
    expect(problemas).toEqual([]);
    expect(conferidos[0]).toMatchObject({ isoNumerico: "076", noMapa: "Brazil" });
  });
});
