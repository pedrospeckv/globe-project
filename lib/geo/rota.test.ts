import { describe, it, expect } from "vitest";
import { rotaCompleta, rotaAte, paradasAte } from "./rota";
import type { Viagem } from "@/lib/conteudo/viagem";

const cabral: Viagem = {
  id: "cabral-1500",
  titulo: "Frota de Cabral",
  fontes: [],
  paradas: [
    { local: "Lisboa", data: "1500-03-09", coords: [-9.14, 38.72] },
    { local: "Cabo Verde", data: "1500-03-22", coords: [-23.51, 14.93] },
    { local: "Monte Pascoal", data: "1500-04-22", coords: [-39.42, -16.89] },
    { local: "Porto Seguro", data: "1500-04-24", coords: [-39.06, -16.45] },
  ],
};

describe("rotaCompleta", () => {
  it("vira um LineString com todas as paradas", () => {
    const r = rotaCompleta(cabral);
    expect(r.type).toBe("Feature");
    expect(r.geometry.type).toBe("LineString");
    expect(r.geometry.coordinates).toHaveLength(4);
  });

  it("preserva a ordem das paradas", () => {
    const r = rotaCompleta(cabral);
    expect(r.geometry.coordinates[0]).toEqual([-9.14, 38.72]);
    expect(r.geometry.coordinates[3]).toEqual([-39.06, -16.45]);
  });

  it("carrega id e título nas properties", () => {
    const r = rotaCompleta(cabral);
    expect(r.properties.viagemId).toBe("cabral-1500");
    expect(r.properties.titulo).toBe("Frota de Cabral");
  });
});

describe("paradasAte", () => {
  it("inclui só o que já aconteceu", () => {
    expect(paradasAte(cabral, "1500-03-22")).toHaveLength(2);
  });

  it("inclui a parada que acontece exatamente na data", () => {
    const p = paradasAte(cabral, "1500-03-09");
    expect(p).toHaveLength(1);
    expect(p[0].local).toBe("Lisboa");
  });

  it("DESEMPATA por mês — o caso do Cabral", () => {
    // Se a comparação fosse só por ano, abril e março de 1500 empatariam e a
    // rota inteira apareceria de uma vez.
    expect(paradasAte(cabral, "1500-04-22")).toHaveLength(3);
    expect(paradasAte(cabral, "1500-04-24")).toHaveLength(4);
  });

  it("devolve vazio antes da partida", () => {
    expect(paradasAte(cabral, "1499")).toHaveLength(0);
  });

  it("devolve tudo depois da chegada", () => {
    expect(paradasAte(cabral, "1600")).toHaveLength(4);
  });
});

describe("rotaAte", () => {
  it("devolve null quando não há trecho para desenhar", () => {
    expect(rotaAte(cabral, "1499")).toBeNull();
    // Uma parada só ainda não é linha
    expect(rotaAte(cabral, "1500-03-09")).toBeNull();
  });

  it("desenha o trecho parcial", () => {
    const r = rotaAte(cabral, "1500-03-22")!;
    expect(r.geometry.coordinates).toHaveLength(2);
  });

  it("cresce monotonicamente conforme o tempo avança", () => {
    const n = (d: string) => rotaAte(cabral, d)?.geometry.coordinates.length ?? 0;
    expect(n("1500-03-09")).toBeLessThanOrEqual(n("1500-03-22"));
    expect(n("1500-03-22")).toBeLessThanOrEqual(n("1500-04-22"));
    expect(n("1500-04-22")).toBeLessThanOrEqual(n("1500-04-24"));
  });
});
