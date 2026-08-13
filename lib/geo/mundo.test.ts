import { describe, it, expect } from "vitest";
import { carregarMundo, separarPaises } from "./mundo";
import { PAISES_DO_ATLAS } from "./iso";

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

  it("separa curados de fundo sem perder nem duplicar", async () => {
    const mundo = await carregarMundo();
    const { curados, fundo } = separarPaises(mundo, PAISES_DO_ATLAS);
    expect(curados.length + fundo.length).toBe(mundo.length);
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
