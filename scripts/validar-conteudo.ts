#!/usr/bin/env tsx
import path from "node:path";
import { carregarAcervo } from "../lib/conteudo/carregar";
import {
  verificarIntegridade,
  coberturaDeFontes,
} from "../lib/conteudo/integridade";

/**
 * Roda antes do `next build`. Conteúdo inválido não chega ao ar porque o
 * deploy falha — é o mecanismo que sustenta a regra "sem fonte não renderiza"
 * (§10 do spec).
 */
async function main() {
  const raiz = path.join(process.cwd(), "conteudo");

  let acervo;
  try {
    acervo = await carregarAcervo(raiz);
  } catch (e) {
    console.error("\n✗ conteúdo inválido\n");
    console.error(e instanceof Error ? e.message : e);
    console.error("");
    process.exit(1);
  }

  const erros = verificarIntegridade(acervo);
  if (erros.length > 0) {
    console.error(`\n✗ ${erros.length} problema(s) de integridade\n`);
    for (const erro of erros) console.error(`  • ${erro}`);
    console.error("");
    process.exit(1);
  }

  const alegacoes = acervo.figuras.reduce((n, f) => n + f.alegacoes.length, 0);
  const periodos = acervo.paises.reduce((n, p) => n + p.periodos.length, 0);
  console.log(
    `✓ conteúdo válido — ${acervo.paises.length} países (${periodos} períodos), ` +
      `${acervo.figuras.length} figuras, ${alegacoes} alegações, ` +
      `${acervo.eventos.length} eventos, ${acervo.viagens.length} viagens, ` +
      `${acervo.indicadores.length} indicadores, ${acervo.fontes.length} fontes`
  );

  /*
   * A dívida, dita em voz alta a cada validação. Não é erro: exigir fonte
   * de todo período quebraria os 84 de uma vez, e a saída fácil para
   * destravar o build seria inventar fonte — pior que não ter nenhuma.
   * Contar é o que faz o número encolher em vez de sumir de vista.
   */
  const cob = coberturaDeFontes(acervo);
  if (cob.semFonte.length === 0) {
    console.log(`✓ os ${cob.comTexto} períodos com texto têm fonte`);
  } else {
    console.log(
      `\n⚠ fontes nos períodos: ${cob.comFonte}/${cob.comTexto} com texto têm fonte`
    );
    for (const id of cob.semFonte) console.log(`  · ${id}`);
    console.log("");
  }
}

main();
