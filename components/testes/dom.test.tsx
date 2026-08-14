// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { semAnoCru, textosVisiveis } from "./dom";

function tela(node: React.ReactNode): HTMLElement {
  return render(<div>{node}</div>).container;
}

/*
 * O detector é a parte que carrega peso — se ele não pegar o defeito, todos os
 * testes que dependem dele passam sem provar nada. Então ele é testado contra
 * os dois vazamentos reais e contra as datas legítimas que não pode acusar.
 */
describe("semAnoCru", () => {
  it("pega o defeito exato que apareceu no dossiê do Japão", () => {
    expect(() => semAnoCru(tela(<span>-300–300</span>))).toThrow(/ano negativo cru/);
  });

  it("pega o defeito exato que apareceu na ponta da barra de tempo", () => {
    expect(() => semAnoCru(tela(<span>-220</span>))).toThrow();
  });

  it("pega o sinal depois de espaço ou separador", () => {
    expect(() => semAnoCru(tela(<span>Yayoi · -300</span>))).toThrow();
    expect(() => semAnoCru(tela(<span>(-44)</span>))).toThrow();
  });

  it("pega o sinal escondido num atributo de tooltip", () => {
    expect(() => semAnoCru(tela(<span title="Qin -221" />))).toThrow();
  });

  it("pega mesmo quando o texto está partido entre dois nós", () => {
    // `textContent` do container juntaria em "1500-300" e o hífen ficaria
    // entre dígitos, escapando do padrão. Por isso a varredura é nó a nó.
    expect(() =>
      semAnoCru(
        tela(
          <>
            <span>1500</span>
            <span>-300</span>
          </>
        )
      )
    ).toThrow();
  });

  it("aceita a data já formatada", () => {
    expect(() => semAnoCru(tela(<span>300 a.C.–300</span>))).not.toThrow();
    expect(() => semAnoCru(tela(<span>44 a.C. (03-15)</span>))).not.toThrow();
  });

  it("não acusa data d.C. normal", () => {
    expect(() => semAnoCru(tela(<span>1500-04-22</span>))).not.toThrow();
    expect(() => semAnoCru(tela(<span>1822–1889</span>))).not.toThrow();
    expect(() => semAnoCru(tela(<span>843</span>))).not.toThrow();
  });

  it("não acusa hífen que não é sinal", () => {
    expect(() => semAnoCru(tela(<span>Áustria-Hungria</span>))).not.toThrow();
    expect(() => semAnoCru(tela(<span>pós-1945</span>))).not.toThrow();
  });

  it("aponta qual texto vazou, não só que vazou", () => {
    expect(() => semAnoCru(tela(<span>Yayoi -300</span>))).toThrow(/Yayoi -300/);
  });
});

describe("textosVisiveis", () => {
  it("junta texto e tooltip, ignorando marcação", () => {
    const c = tela(
      <p title="dica">
        um <strong>dois</strong>
      </p>
    );
    expect(textosVisiveis(c)).toContain("dica");
    expect(textosVisiveis(c)).toContain("dois");
  });

  it("não devolve espaço em branco solto", () => {
    const c = tela(
      <p>
        {" "}
        <span>x</span>{" "}
      </p>
    );
    expect(textosVisiveis(c).every((t) => t.trim().length > 0)).toBe(true);
  });
});
