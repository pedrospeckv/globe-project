#!/usr/bin/env tsx
import path from "node:path";
import { carregarAcervo } from "../lib/conteudo/carregar";
import { verificarIntegridade } from "../lib/conteudo/integridade";

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
}

main();
