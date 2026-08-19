import { describe, it, expect } from "vitest";
import { CURSO, paralaxeDe, progressoNaTela } from "./paralaxe";

/** Uma tela de 800 px e um bloco de 400 px com 100 px de folga na imagem. */
const TELA = 800;
const BLOCO = 400;
const FOLGA = 100;

function em(topo: number) {
  return { topo, altura: BLOCO, alturaDaTela: TELA, folga: FOLGA };
}

describe("progresso na tela", () => {
  it("é zero quando o bloco está centralizado", () => {
    // Centro do bloco no centro da tela: topo = 400 - 200 = 200.
    expect(progressoNaTela(em(200))).toBe(0);
  });

  it("é -1 quando o bloco encosta no rodapé, e +1 quando sai pelo topo", () => {
    // Percurso = meia tela (400) + meio bloco (200) = 600.
    expect(progressoNaTela(em(200 + 600))).toBe(-1);
    expect(progressoNaTela(em(200 - 600))).toBe(1);
  });

  it("satura fora do percurso em vez de disparar", () => {
    expect(progressoNaTela(em(5000))).toBe(-1);
    expect(progressoNaTela(em(-5000))).toBe(1);
  });

  it("é monotônico: subir na tela só aumenta o progresso", () => {
    const topos = [900, 700, 500, 300, 200, 100, -100, -300, -500];
    const valores = topos.map((t) => progressoNaTela(em(t)));
    for (let i = 1; i < valores.length; i++) {
      expect(valores[i]).toBeGreaterThanOrEqual(valores[i - 1]);
    }
  });

  it("é antissimétrico em torno do centro", () => {
    expect(progressoNaTela(em(200 + 300))).toBeCloseTo(
      -progressoNaTela(em(200 - 300)),
      10
    );
  });

  it("não divide por zero quando a tela e o bloco têm altura zero", () => {
    expect(
      progressoNaTela({ topo: 0, altura: 0, alturaDaTela: 0, folga: 0 })
    ).toBe(0);
  });
});

describe("paralaxe", () => {
  it("no centro a foto não desliza e a moldura está no tamanho cheio", () => {
    const { deslize, escala } = paralaxeDe(em(200));
    expect(deslize).toBe(0);
    expect(escala).toBeCloseTo(1.01, 10);
  });

  it("nas pontas a foto desliza para os dois lados, com sinais opostos", () => {
    const embaixo = paralaxeDe(em(800));
    const emCima = paralaxeDe(em(-400));
    expect(embaixo.deslize).toBeLessThan(0);
    expect(emCima.deslize).toBeGreaterThan(0);
    expect(embaixo.deslize).toBeCloseTo(-emCima.deslize, 10);
  });

  it("o deslize nunca gasta a folga inteira — é o que impede a borda de aparecer", () => {
    for (const topo of [-600, -300, 0, 200, 500, 900]) {
      const { deslize } = paralaxeDe(em(topo));
      expect(Math.abs(deslize)).toBeLessThanOrEqual((FOLGA / 2) * CURSO);
      expect(Math.abs(deslize)).toBeLessThan(FOLGA / 2);
    }
  });

  it("sem folga não há deslize — imagem do tamanho exato da moldura fica parada", () => {
    expect(paralaxeDe({ ...em(700), folga: 0 }).deslize).toBeCloseTo(0, 10);
  });

  it("folga negativa não inverte o efeito", () => {
    // Acontece no instante em que a imagem ainda não carregou e mede zero.
    expect(paralaxeDe({ ...em(700), folga: -300 }).deslize).toBeCloseTo(0, 10);
  });

  it("a escala fica sempre entre o mínimo e o cheio", () => {
    for (const topo of [-900, -400, 0, 200, 400, 800, 1200]) {
      const { escala } = paralaxeDe(em(topo));
      expect(escala).toBeGreaterThanOrEqual(0.985);
      expect(escala).toBeLessThanOrEqual(1.01);
    }
  });

  it("a moldura cresce ao se aproximar do centro e encolhe ao se afastar", () => {
    const longe = paralaxeDe(em(800)).escala;
    const meio = paralaxeDe(em(500)).escala;
    const centro = paralaxeDe(em(200)).escala;
    expect(longe).toBeLessThan(meio);
    expect(meio).toBeLessThan(centro);
  });
});
