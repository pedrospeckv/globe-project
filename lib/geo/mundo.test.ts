import { describe, it, expect } from "vitest";
import { geoArea, geoBounds } from "d3-geo";
import {
  carregarMundo,
  prepararMundo,
  separarPaises,
  separarUltramar,
} from "./mundo";
import { PAISES_DO_ATLAS, alpha3De } from "./iso";

/** Decomposição estática, feita uma vez — como na página. */
async function prepararTudo() {
  const mundo = await carregarMundo();
  return { mundo, preparado: prepararMundo(mundo, PAISES_DO_ATLAS) };
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
    const { curados } = separarPaises(preparado, PAISES_DO_ATLAS);
    const achados = curados.map((f) => f.alpha3).sort();
    expect(achados).toEqual([...PAISES_DO_ATLAS].sort());
  });

  it("separa curados de fundo sem perder país nem duplicar", async () => {
    const { mundo, preparado } = await prepararTudo();
    const { curados, fundo } = separarPaises(preparado, PAISES_DO_ATLAS);

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
      const comAtlas = separarPaises(preparado, PAISES_DO_ATLAS);
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
    const { preparado } = await prepararTudo();
    const { curados } = separarPaises(preparado, PAISES_DO_ATLAS);
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
        separarPaises(preparado, PAISES_DO_ATLAS, ["crimeia"]);
      }
      const porChamada = (performance.now() - t0) / 200;

      expect(porChamada).toBeLessThan(1);
    });
  });
});
