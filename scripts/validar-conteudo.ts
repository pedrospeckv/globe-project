#!/usr/bin/env tsx
import path from "node:path";
import { carregarAcervo } from "../lib/conteudo/carregar";
import {
  verificarIntegridade,
  coberturaDeFontes,
  coberturaDeNotas,
  coberturaDeImagens,
} from "../lib/conteudo/integridade";
import {
  coberturaDeEstilo,
  TETO_FUTURO_DO_PRETERITO,
  TETO_AVALIATIVO,
} from "../lib/conteudo/estilo";
import { FATIAS } from "../lib/geo/fatias";
import { carregarMundo, conferirCodigosDePais } from "../lib/geo/mundo";
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

  /*
   * O código numérico de cada país, contra a geometria empacotada.
   *
   * Entra aqui porque é o que sustenta a decisão de tirar a tabela central de
   * `lib/geo/iso.ts`: o número passou a morar no arquivo do próprio país, para
   * que um PR de país novo não toque em arquivo compartilhado — e a troca só é
   * segura se alguém conferir o número. Sem isto o erro mudaria de lugar em vez
   * de desaparecer.
   */
  const mundo = await carregarMundo();
  const codigos = conferirCodigosDePais(mundo, acervo.paises);
  if (codigos.problemas.length > 0) {
    console.error(`
✗ ${codigos.problemas.length} problema(s) de código de país
`);
    for (const erro of codigos.problemas) console.error(`  • ${erro}`);
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
      `${acervo.indicadores.length} indicadores, ${acervo.ilhas.length} ilhas, ` +
      `${acervo.nacoes.length} nações, ${acervo.fontes.length} fontes`
  );
  /*
   * A lista sai por extenso, e não só a contagem: nenhum programa sabe se o
   * contribuidor quis o Peru ou o Chile, mas `PER 604 → Peru` deixa um humano
   * ver num relance que o código plausível é o certo.
   */
  console.log(
    `✓ os ${codigos.conferidos.length} códigos de país existem no mapa: ` +
      codigos.conferidos
        .map((c) => `${c.iso} ${c.isoNumerico} → ${c.noMapa}`)
        .join(", ")
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

  /*
   * A terceira dívida contada, pelo mesmo motivo das duas de cima: curadoria
   * de imagem é lenta — cada período pede uma peça feita DENTRO do período,
   * sob licença livre e com descrição que permita escrever o alt sem inventar
   * o que a foto mostra — e exigi-la de todo país novo travaria a frente de
   * largura, que é a prioridade declarada.
   *
   * País PELA METADE é o único caso que não é dívida e sim defeito, e por
   * isso ele grita aqui e reprova no teste: quer dizer que alguém começou a
   * ilustrar e parou, e nada na tela denuncia isso até um leitor abrir
   * justamente o período que ficou sem.
   */
  /*
   * A quarta dívida, e a única que mede REGISTRO em vez de peça faltando.
   *
   * Nasceu de o autor olhar os 157 dossiês do lote e dizer que ficaram
   * "genéricos". A diferença contra os nove escritos à mão é contável: 15,0
   * contra 3,0 verbos em futuro-do-pretérito por mil palavras, e 1,9 contra
   * 0,2 adjetivos avaliativos. Ver `lib/conteudo/estilo.ts`.
   *
   * Não reprova, pelo mesmo motivo das outras três: 143 países estão acima do
   * teto, e travar o build só impediria qualquer publicação. A lista sai
   * ordenada do pior para o melhor porque essa é a fila de reescrita — o pior
   * primeiro é onde a mesma hora de trabalho muda mais a leitura.
   */
  const est = coberturaDeEstilo(acervo);
  if (est.fora.length === 0) {
    console.log(
      `✓ os ${est.medidos.length} países medidos estão dentro dos tetos de registro`
    );
  } else {
    console.log(
      `\n⚠ registro da prosa: ${est.medidos.length - est.fora.length}/${est.medidos.length} ` +
        `países dentro dos tetos (≤${TETO_FUTURO_DO_PRETERITO} futuro-do-pretérito ` +
        `e ≤${TETO_AVALIATIVO} avaliativo, por mil palavras)`
    );
    console.log("  fila de reescrita, do pior para o melhor:");
    for (const p of est.fora.slice(0, 15)) {
      console.log(
        `  · ${p.nome} (${p.iso}) — ${p.futuroDoPreterito.toFixed(1)} / ` +
          `${p.avaliativo.toFixed(1)} em ${p.palavras} palavras`
      );
    }
    if (est.fora.length > 15) {
      console.log(`  · … e outros ${est.fora.length - 15}`);
    }
    console.log("");
  }

  const img = coberturaDeImagens(acervo);
  if (img.pelaMetade.length > 0) {
    console.log(
      `\n⚠ país com imagem pela metade: ${img.pelaMetade.join(", ")}` +
        `\n  ou ilustra todos os períodos, ou nenhum — meio termo some da vista.`
    );
  }
  if (img.vazios.length === 0) {
    console.log(`✓ os ${img.periodos} períodos têm imagem de época`);
  } else {
    console.log(
      `\n⚠ imagem nos períodos: ${img.comImagem}/${img.periodos} ` +
        `(${img.completos.length} países completos, ${img.vazios.length} ainda sem nenhuma)`
    );
    console.log(`  · sem imagem: ${img.vazios.join(", ")}`);
    console.log("");
  }
}

main();
