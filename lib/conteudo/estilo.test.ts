import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  medirEstilo,
  coberturaDeEstilo,
  TETO_FUTURO_DO_PRETERITO,
  TETO_AVALIATIVO,
} from "./estilo";
import { carregarAcervo } from "./carregar";

describe("medirEstilo", () => {
  it("conta futuro-do-pretérito por mil palavras", () => {
    // 4 palavras, 1 ocorrência -> 250 por mil.
    const m = medirEstilo("Ele seria deposto depois");
    expect(m.palavras).toBe(4);
    expect(m.futuroDoPreterito).toBe(250);
  });

  it("conta o plural em -riam", () => {
    expect(medirEstilo("eles manteriam tudo").futuroDoPreterito).toBeGreaterThan(0);
  });

  /*
   * O detector exige vogal temática antes do "-ria", e é isso que impede
   * substantivo de virar verbo na conta. Sem essa exigência, "Maria" e
   * "matéria" contariam e a média de qualquer texto em português subiria.
   */
  it("NÃO conta substantivo que só termina parecido", () => {
    expect(medirEstilo("Maria leu a matéria na feira").futuroDoPreterito).toBe(0);
  });

  it("acha avaliativo mesmo acentuado", () => {
    expect(medirEstilo("repressão considerável e profundamente injusta").avaliativo)
      .toBeGreaterThan(0);
  });

  it("não divide por zero em texto vazio", () => {
    expect(medirEstilo("")).toEqual({
      palavras: 0,
      futuroDoPreterito: 0,
      avaliativo: 0,
    });
  });

  /*
   * O caso que motivou a medida: a mesma informação escrita nos dois
   * registros. O segundo diz mais e não usa nenhum dos dois tiques.
   */
  it("separa o registro de sinopse do registro concreto", () => {
    const sinopse =
      "O regime seria deposto anos depois, e a repressão considerável marcaria " +
      "profundamente o país, que enfrentaria uma das piores crises de sua história.";
    const concreto =
      "O exército depôs o regime em novembro de 2017. A Quinta Brigada havia " +
      "matado civis em Matabeleland, e o relatório que o governo encomendou " +
      "em 1983 nunca foi publicado.";
    const a = medirEstilo(sinopse);
    const b = medirEstilo(concreto);
    expect(a.futuroDoPreterito).toBeGreaterThan(b.futuroDoPreterito);
    expect(a.avaliativo).toBeGreaterThan(b.avaliativo);
    expect(b.futuroDoPreterito).toBe(0);
    expect(b.avaliativo).toBe(0);
  });
});

describe("coberturaDeEstilo", () => {
  it("ordena do pior para o melhor, que é a fila de reescrita", async () => {
    const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));
    const { medidos } = coberturaDeEstilo(acervo);
    expect(medidos.length).toBeGreaterThan(100);
    for (let i = 1; i < medidos.length; i++) {
      expect(medidos[i - 1].futuroDoPreterito).toBeGreaterThanOrEqual(
        medidos[i].futuroDoPreterito
      );
    }
  });

  /*
   * Os nove dossiês que o autor aprovou são a origem dos tetos, então eles
   * têm de caber neles. Se este teste quebrar, o teto está errado — não os
   * países.
   */
  it("os países escritos à mão passam nos dois tetos", async () => {
    const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));
    const { medidos } = coberturaDeEstilo(acervo);
    const AMAO = ["BRA", "FRA", "DEU", "CHN", "USA", "JPN", "GBR", "RUS", "IND"];
    for (const iso of AMAO) {
      const m = medidos.find((x) => x.iso === iso);
      expect(m, `${iso} não foi medido`).toBeDefined();
      expect(m!.futuroDoPreterito, `${iso} futuro-do-pretérito`)
        .toBeLessThanOrEqual(TETO_FUTURO_DO_PRETERITO);
      expect(m!.avaliativo, `${iso} avaliativo`).toBeLessThanOrEqual(TETO_AVALIATIVO);
    }
  });

  /*
   * O piloto tem de passar, senão não é piloto. Foi de 28,9/8,5 para
   * 3,8/0,0 só por ser reescrito com fato concreto.
   */
  it("o Zimbábue, reescrito como piloto, passa nos dois tetos", async () => {
    const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));
    const { medidos } = coberturaDeEstilo(acervo);
    const zwe = medidos.find((x) => x.iso === "ZWE");
    expect(zwe).toBeDefined();
    expect(zwe!.futuroDoPreterito).toBeLessThanOrEqual(TETO_FUTURO_DO_PRETERITO);
    expect(zwe!.avaliativo).toBeLessThanOrEqual(TETO_AVALIATIVO);
  });
});
