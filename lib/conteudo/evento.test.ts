import { describe, it, expect } from "vitest";
import { Evento, eventosEm, eventosDoPais } from "./evento";

const bastilha = Evento.parse({
  id: "queda-bastilha",
  data: "1789-07-14",
  titulo: "Queda da Bastilha",
  ponto: [2.35, 48.86],
  paises: ["FRA"],
});

const muro = Evento.parse({
  id: "queda-muro",
  data: "1989-11-09",
  titulo: "Queda do Muro de Berlim",
  ponto: [13.38, 52.52],
  paises: ["DEU"],
});

const hiroshima = Evento.parse({
  id: "hiroshima",
  data: "1945-08-06",
  titulo: "Bomba atômica sobre Hiroshima",
  ponto: [132.45, 34.39],
  paises: ["JPN", "USA"],
});

describe("Evento", () => {
  it("aceita evento completo", () => {
    expect(Evento.safeParse({
      id: "x", data: "1789-07-14", titulo: "T",
      ponto: [0, 0], paises: ["FRA"], fontes: ["f1"], textoMdx: "texto",
    }).success).toBe(true);
  });

  it("assume lista de fontes vazia quando omitida", () => {
    // Ao contrário da Alegação, evento não exige fonte: alegação é afirmação
    // contestada, evento é acontecimento datado. Exigir dos dois borraria a
    // distinção que o modelo existe para traçar.
    expect(bastilha.fontes).toEqual([]);
  });

  it("REJEITA evento sem país — todo evento acontece em algum lugar do atlas", () => {
    expect(Evento.safeParse({
      id: "x", data: "1789", titulo: "T", ponto: [0, 0], paises: [],
    }).success).toBe(false);
  });

  it("aceita evento que envolve mais de um país", () => {
    expect(hiroshima.paises).toEqual(["JPN", "USA"]);
  });

  it("rejeita coordenada inválida", () => {
    expect(Evento.safeParse({
      id: "x", data: "1789", titulo: "T", ponto: [200, 0], paises: ["FRA"],
    }).success).toBe(false);
  });

  it("rejeita data fora do formato histórico", () => {
    expect(Evento.safeParse({
      id: "x", data: "14/07/1789", titulo: "T", ponto: [0, 0], paises: ["FRA"],
    }).success).toBe(false);
  });

  it("exige título", () => {
    expect(Evento.safeParse({
      id: "x", data: "1789", titulo: "", ponto: [0, 0], paises: ["FRA"],
    }).success).toBe(false);
  });
});

describe("eventosEm", () => {
  const todos = [bastilha, muro, hiroshima];

  it("mostra o evento quando o tempo está em cima dele", () => {
    const r = eventosEm(todos, 1789.53, 2);
    expect(r.map((e) => e.id)).toEqual(["queda-bastilha"]);
  });

  it("não mostra nada em época sem evento", () => {
    expect(eventosEm(todos, 1600, 2)).toEqual([]);
  });

  it("a janela controla quantos aparecem", () => {
    expect(eventosEm(todos, 1967, 2)).toHaveLength(0);
    expect(eventosEm(todos, 1967, 30)).toHaveLength(2);
  });

  it("inclui evento na borda exata da janela", () => {
    expect(eventosEm(todos, 1791.53, 2)).toHaveLength(1);
  });

  it("ordena por data", () => {
    const r = eventosEm(todos, 1900, 200);
    expect(r.map((e) => e.id)).toEqual(["queda-bastilha", "hiroshima", "queda-muro"]);
  });
});

describe("eventosDoPais", () => {
  const todos = [bastilha, muro, hiroshima];

  it("filtra pelo país", () => {
    expect(eventosDoPais(todos, "FRA").map((e) => e.id)).toEqual(["queda-bastilha"]);
  });

  it("encontra evento em que o país é um entre vários", () => {
    expect(eventosDoPais(todos, "USA").map((e) => e.id)).toEqual(["hiroshima"]);
    expect(eventosDoPais(todos, "JPN").map((e) => e.id)).toEqual(["hiroshima"]);
  });

  it("devolve vazio para país sem evento", () => {
    expect(eventosDoPais(todos, "BRA")).toEqual([]);
  });

  it("ordena por data", () => {
    const r = eventosDoPais([muro, bastilha], "FRA");
    expect(r).toHaveLength(1);
  });
});
