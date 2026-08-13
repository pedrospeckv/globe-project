import { describe, it, expect } from "vitest";
import { Viagem, coordenadasDe } from "./viagem";

const cabral = {
  id: "cabral-1500",
  titulo: "Frota de Cabral",
  paradas: [
    { local: "Lisboa", data: "1500-03-09", coords: [-9.14, 38.72] },
    { local: "Cabo Verde", data: "1500-03-22", coords: [-23.51, 14.93] },
    { local: "Porto Seguro", data: "1500-04-22", coords: [-39.06, -16.45] },
  ],
};

describe("Viagem", () => {
  it("aceita viagem com paradas", () => {
    expect(Viagem.safeParse(cabral).success).toBe(true);
  });

  it("REJEITA viagem com menos de duas paradas — não é percurso", () => {
    expect(
      Viagem.safeParse({ ...cabral, paradas: [cabral.paradas[0]] }).success
    ).toBe(false);
  });

  it("REJEITA paradas fora de ordem cronológica", () => {
    const r = Viagem.safeParse({
      ...cabral,
      paradas: [cabral.paradas[2], cabral.paradas[0]],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/cronol/i);
  });

  it.each([
    [[-181, 0]],
    [[181, 0]],
    [[0, 91]],
    [[0, -91]],
  ])("rejeita coordenada inválida %j", (coords) => {
    const r = Viagem.safeParse({
      ...cabral,
      paradas: [{ ...cabral.paradas[0], coords }, cabral.paradas[2]],
    });
    expect(r.success).toBe(false);
  });

  it("rejeita coordenada com número de elementos errado", () => {
    const r = Viagem.safeParse({
      ...cabral,
      paradas: [{ ...cabral.paradas[0], coords: [1, 2, 3] }, cabral.paradas[2]],
    });
    expect(r.success).toBe(false);
  });

  it("deriva a lista de coordenadas na ordem das paradas", () => {
    const parsed = Viagem.parse(cabral);
    expect(coordenadasDe(parsed)).toEqual([
      [-9.14, 38.72],
      [-23.51, 14.93],
      [-39.06, -16.45],
    ]);
  });

  it("assume lista de fontes vazia quando omitida", () => {
    const r = Viagem.safeParse(cabral);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fontes).toEqual([]);
  });
});
