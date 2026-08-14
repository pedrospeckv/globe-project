import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// O `render` do testing-library só limpa sozinho quando o vitest roda com
// `globals: true`. Este projeto importa tudo explicitamente, então o gancho
// fica aqui — todo arquivo de teste de componente importa este módulo.
afterEach(cleanup);

/**
 * Ano negativo solto no texto: `-300`, `-220`.
 *
 * O hífen precisa vir no começo de um token — precedido por nada, espaço ou
 * pontuação. Isso separa o vazamento de datas legítimas, onde o hífen está
 * sempre entre dígitos: `1500-04-22` e `44 a.C. (03-15)` não casam.
 */
const ANO_CRU = /(?:^|[^\w\d])-\d{1,4}(?!\d)/;

/**
 * Todo texto que o usuário consegue ler: nós de texto mais os atributos que
 * o navegador mostra por conta própria.
 *
 * Percorre nó a nó em vez de usar `textContent` do container inteiro. A
 * concatenação esconderia o defeito: `<span>1500</span><span>-300</span>`
 * vira `1500-300`, onde o hífen fica entre dígitos e escapa do padrão.
 */
export function textosVisiveis(raiz: Element): string[] {
  const saida: string[] = [];

  const caminhante = raiz.ownerDocument.createTreeWalker(
    raiz,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  );

  for (let no = caminhante.nextNode(); no; no = caminhante.nextNode()) {
    if (no.nodeType === 3) {
      const t = no.nodeValue?.trim();
      if (t) saida.push(t);
      continue;
    }
    // Tooltip de HTML é atributo, não filho — e aparece na tela ao passar o
    // mouse, então conta.
    const el = no as Element;
    for (const attr of ["title", "aria-label", "aria-valuetext"]) {
      const v = el.getAttribute(attr)?.trim();
      if (v) saida.push(v);
    }
  }

  return saida;
}

/**
 * A regra que a suíte não tinha.
 *
 * Duas vezes um período antes de Cristo chegou à tela como `-300` em vez de
 * `300 a.C.` — nas pontas da barra de tempo e depois no dossiê do Japão. Nos
 * dois casos os testes de lógica passavam: `rotuloDeData` estava certo, quem
 * renderizava é que não a chamava. Só um teste que olha o DOM pega isso.
 */
export function semAnoCru(raiz: Element): void {
  const vazando = textosVisiveis(raiz).filter((t) => ANO_CRU.test(t));
  if (vazando.length > 0) {
    throw new Error(
      `ano negativo cru na tela (esperado "300 a.C.", veio "-300"):\n` +
        vazando.map((t) => `  · ${JSON.stringify(t)}`).join("\n")
    );
  }
}
