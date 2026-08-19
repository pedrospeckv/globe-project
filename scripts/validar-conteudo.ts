#!/usr/bin/env tsx
import path from "node:path";
import { carregarAcervo } from "../lib/conteudo/carregar";
import {
  verificarIntegridade,
  coberturaDeFontes,
  coberturaDeNotas,
} from "../lib/conteudo/integridade";
import { FATIAS } from "../lib/geo/fatias";
import { conferirFatiasLocais, lerManifesto } from "./fatias-locais";

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

  /*
   * As fatias locais entram aqui e não no script que as constrói porque o
   * buraco que importa é temporal: editar `conteudo/fatias/*.geojson` e não
   * reconstruir publica um mapa que não corresponde ao arquivo versionado ao
   * lado dele. O construtor não roda no build — este validador roda.
   */
  const desatualizadas = conferirFatiasLocais(
    FATIAS,
    path.join(process.cwd(), "public", "geo", "fatias")
  );
  if (desatualizadas.length > 0) {
    console.error(`\n✗ ${desatualizadas.length} problema(s) nas fatias locais\n`);
    for (const erro of desatualizadas) console.error(`  • ${erro}`);
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
      `${acervo.eventos.length} eventos, ${acervo.episodios.length} episódios, ` +
      `${acervo.eleicoes.length} eleições, ` +
      `${acervo.viagens.length} viagens, ` +
      `${acervo.indicadores.length} indicadores, ${acervo.ilhas.length} ilhas, ${acervo.fontes.length} fontes`
  );
  const locais = lerManifesto();
  console.log(
    `✓ ${FATIAS.length} fatias de fronteira, ${locais.length} de geometria própria` +
      (locais.length > 0 ? ` (${locais.map((f) => f.nome).join(", ")})` : "")
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

  /*
   * A mesma conta para as notas, e pelo motivo oposto: aqui a dívida é
   * temporária e tem fim marcado. As 29 vieram cruas do cofre; a decisão foi
   * revisá-las com fonte, o que tira o aviso de "sem revisão e sem fonte" da
   * página. Enquanto o número não zerar, o aviso da página precisa continuar
   * dizendo que parte do acervo ainda é rascunho.
   */
  const notas = coberturaDeNotas(acervo);
  if (notas.semFonte.length === 0) {
    console.log(`✓ as ${notas.comTexto} notas estão revisadas e com fonte`);
  } else {
    console.log(
      `\n⚠ revisão das notas: ${notas.comFonte}/${notas.comTexto} com fonte — ` +
        `${notas.semFonte.length} ainda cruas do cofre`
    );
    for (const id of notas.semFonte) console.log(`  · ${id}`);
    console.log("");
  }
}

main();
