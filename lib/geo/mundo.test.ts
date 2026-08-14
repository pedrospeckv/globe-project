import { describe, it, expect } from "vitest";
import { geoArea, geoBounds } from "d3-geo";
import { carregarMundo, separarPaises, separarUltramar } from "./mundo";
import { PAISES_DO_ATLAS, alpha3De } from "./iso";

describe("carregarMundo", () => {
  it("devolve features de país", async () => {
    const mundo = await carregarMundo();
    expect(mundo.length).toBeGreaterThan(150);
    expect(mundo[0].type).toBe("Feature");
  });

  it("ENCONTRA todos os países do atlas no topojson", async () => {
    // Guarda contra o problema clássico de Natural Earth, em que um país vem
    // com código inválido e simplesmente some do mapa sem erro nenhum.
    const mundo = await carregarMundo();
    const { curados } = separarPaises(mundo, PAISES_DO_ATLAS);
    const achados = curados.map((f) => f.alpha3).sort();
    expect(achados).toEqual([...PAISES_DO_ATLAS].sort());
  });

  it("separa curados de fundo sem perder país nem duplicar", async () => {
    const mundo = await carregarMundo();
    const { curados, fundo } = separarPaises(mundo, PAISES_DO_ATLAS);

    // Cada país do atlas aparece uma vez só entre os curados.
    expect(new Set(curados.map((c) => c.alpha3)).size).toBe(curados.length);

    /*
     * O total agora PASSA de mundo.length, e isso é a correção funcionando:
     * um país com ultramar vira duas feições — o território principal, que
     * acende, e o ultramar, que desce para o fundo. Nada é descartado.
     */
    const comUltramar = PAISES_DO_ATLAS.filter(
      (iso) =>
        separarUltramar(
          mundo.find((f) => f.id !== undefined && alpha3De(f.id as string) === iso)!
        ).ultramar !== null
    ).length;
    expect(curados.length + fundo.length).toBe(mundo.length + comUltramar);
    expect(comUltramar).toBeGreaterThan(0);
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
      const mundo = await carregarMundo();
      const semAtlas = separarPaises(mundo, []).fundo.length;
      const comAtlas = separarPaises(mundo, PAISES_DO_ATLAS);
      const areaTotal = (fs: { geometry: unknown }[]) =>
        fs.reduce((s, f) => s + geoArea(f as Parameters<typeof geoArea>[0]), 0);

      expect(comAtlas.fundo.length).toBeGreaterThan(
        semAtlas - PAISES_DO_ATLAS.length
      );
      // A soma das áreas continua sendo o mundo inteiro.
      expect(
        areaTotal(comAtlas.fundo) + areaTotal(comAtlas.curados.map((c) => c.feature))
      ).toBeCloseTo(areaTotal(mundo), 6);
    });
  });

  it("cada país curado carrega geometria utilizável", async () => {
    const mundo = await carregarMundo();
    const { curados } = separarPaises(mundo, PAISES_DO_ATLAS);
    for (const c of curados) {
      expect(["Polygon", "MultiPolygon"]).toContain(c.feature.geometry.type);
    }
  });

  it("aceita subconjunto — acender só os países que têm conteúdo", async () => {
    const mundo = await carregarMundo();
    const { curados } = separarPaises(mundo, ["BRA", "FRA"]);
    expect(curados.map((c) => c.alpha3).sort()).toEqual(["BRA", "FRA"]);
  });
});
