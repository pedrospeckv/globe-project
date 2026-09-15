#!/usr/bin/env tsx
/**
 * Monta o pacote de um lote de reescrita, pronto para colar num modelo.
 *
 *   pnpm lote                    # os 10 piores da fila de reescrita
 *   pnpm lote 5                  # os 5 piores
 *   pnpm lote MDA SWZ MDG        # estes países, na ordem dada
 *   pnpm lote --todos            # a fila inteira, repartida em lotes de 10
 *
 * ## Por que isto existe
 *
 * `docs/trabalho-em-lote.md` diz as REGRAS e não diz o TRABALHO. Entregue
 * sozinho a um modelo, ele produz a pergunta certa: "sobre qual país?".
 *
 * E a resposta óbvia — "leia o repositório e descubra" — não serve, por dois
 * motivos. O primeiro é prático: GPT, Deepseek, Qwen e Kimi numa janela de
 * conversa **não têm acesso a este disco**. Não há repositório para eles
 * lerem. O segundo é que mandar um modelo escolher o próprio trabalho é
 * entregar a decisão editorial junto com a execução, que é exatamente a parte
 * que não se terceiriza.
 *
 * Então o pacote leva tudo: as regras, o texto atual de cada período, a
 * medida de cada país e o formato exato da resposta. Um arquivo, uma colagem,
 * nenhuma pergunta de volta.
 *
 * ## O que ele deliberadamente NÃO faz
 *
 * Não manda escrever país que falta. Os 8 sem dossiê são Antártida, Malvinas,
 * Terras Austrais Francesas, Israel, Palestina, Taiwan, Saara Ocidental e Nova
 * Caledônia — território sem soberano ou soberania disputada, em bloco. É a
 * lista dos que menos se deve entregar a um modelo trabalhando sozinho, e a
 * cobertura estar em 95,4% é justamente o que torna essa recusa barata.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { carregarAcervo } from "../lib/conteudo/carregar";
import {
  coberturaDeEstilo,
  medirEstilo,
  TETO_AVALIATIVO,
  TETO_FUTURO_DO_PRETERITO,
  type EstiloDoPais,
} from "../lib/conteudo/estilo";
import type { Pais } from "../lib/conteudo/pais";

const RAIZ = path.join(process.cwd(), "conteudo");
const REGRAS = path.join(process.cwd(), "docs", "trabalho-em-lote.md");
const DESTINO = path.join(process.cwd(), "lotes");

/** Quantos países por lote, quando não é dito. */
const TAMANHO_PADRAO = 10;

/**
 * Argumento da linha de comando: um número, uma lista de ISO, ou nada.
 *
 * Separado do resto porque é a única parte que um humano digita errado, e
 * porque `pnpm lote BRA 5` precisa de uma resposta definida em vez de um
 * comportamento acidental — aqui, o número ganha e a lista é ignorada.
 */
export function lerPedido(args: readonly string[]): {
  quantos?: number;
  isos?: string[];
} {
  const numero = args.find((a) => /^\d+$/.test(a));
  if (numero) return { quantos: Number(numero) };
  const isos = args.filter((a) => /^[A-Za-z]{3}$/.test(a)).map((a) => a.toUpperCase());
  return isos.length > 0 ? { isos } : {};
}

/**
 * Os países do lote, na ordem em que devem ser trabalhados.
 *
 * Sem pedido explícito, é a fila de reescrita — pior primeiro, que é onde a
 * mesma hora de trabalho muda mais a leitura. Com ISOs, é a ordem que a pessoa
 * deu, porque ali a escolha já foi feita por alguém.
 */
export function escolher(
  fila: readonly EstiloDoPais[],
  pedido: { quantos?: number; isos?: string[] }
): EstiloDoPais[] {
  if (pedido.isos) {
    return pedido.isos
      .map((iso) => fila.find((p) => p.iso === iso))
      .filter((p): p is EstiloDoPais => Boolean(p));
  }
  return fila.slice(0, pedido.quantos ?? TAMANHO_PADRAO);
}

/**
 * Nome do arquivo do lote: `lote-03.md`.
 *
 * Numerado, e não nomeado pelos países, porque a fila inteira dá treze lotes e
 * quem os distribui por várias sessões precisa de um identificador que caiba
 * numa frase. `lote-2026-08-24-mda-swz-mdg-lbr-gha-sle-ago-sen-afg-nam.md`
 * é o nome correto e é inútil para dizer "o terceiro é seu". Quais países
 * estão em qual lote fica no índice.
 */
export function nomeDoLote(indice: number): string {
  return `lote-${String(indice).padStart(2, "0")}.md`;
}

/** Reparte a fila em lotes do tamanho pedido, na ordem em que ela veio. */
export function repartir<T>(fila: readonly T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < fila.length; i += tamanho) {
    lotes.push(fila.slice(i, i + tamanho));
  }
  return lotes;
}

/** O trecho de um país no pacote: medida, períodos e o texto atual de cada um. */
function secaoDoPais(pais: Pais, medida: EstiloDoPais): string {
  const linhas: string[] = [];
  linhas.push(`### ${pais.nome} (\`${pais.iso}\`)`);
  linhas.push("");
  linhas.push(
    `Hoje: **${medida.futuroDoPreterito.toFixed(1)}** de futuro-do-pretérito e ` +
      `**${medida.avaliativo.toFixed(1)}** de avaliativo, por mil palavras, ` +
      `em ${medida.palavras} palavras. ` +
      `A meta é ≤ ${TETO_FUTURO_DO_PRETERITO} e ≤ ${TETO_AVALIATIVO}.`
  );
  linhas.push("");

  for (const p of pais.periodos) {
    if (!p.textoMdx) continue;
    const m = medirEstilo(p.textoMdx);
    linhas.push(`#### \`${p.id}\` — ${p.rotulo} · ${p.regime}`);
    linhas.push("");
    linhas.push(
      `<!-- ${m.palavras} palavras · ${m.futuroDoPreterito.toFixed(1)} / ${m.avaliativo.toFixed(1)} -->`
    );
    linhas.push("");
    linhas.push("```");
    linhas.push(p.textoMdx);
    linhas.push("```");
    linhas.push("");
  }
  return linhas.join("\n");
}

/**
 * O pedido, escrito uma vez e igual para todo lote.
 *
 * Fica aqui e não no documento de regras porque é a INSTRUÇÃO DA TAREFA, não
 * a regra da casa: as regras valem para quem escreve país novo também, e esta
 * frase só vale para reescrita de registro.
 */
const PEDIDO = `## O que fazer

Reescreva o \`textoMdx\` de cada período abaixo eliminando o **futuro-do-pretérito**
e o **adjetivo avaliativo**.

**Não acrescente fato novo. Não remova fato existente. Não toque nas fontes.**
A mesma informação, contada no passado, com o detalhe concreto no lugar do
advérbio.

- Onde disser "seria deposto em 1966", diga "foi deposto em 1966".
- Onde disser "repressão considerável", ou nomeie o que aconteceu, ou corte o
  adjetivo. Não troque por sinônimo — "repressão intensa" é o mesmo defeito.
- O tamanho deve ficar parecido. Texto que encolhe um terço perdeu informação,
  e o verificador de volta recusa por isso.

Se um período já estiver bom, devolva-o **igual**. Não reescreva por reescrever.

## Formato da resposta

Só isto, sem comentário em volta — um JSON com o id de cada período e o texto
novo:

\`\`\`json
{
  "periodos": {
    "id-do-periodo": "texto novo aqui",
    "outro-id": "texto novo aqui"
  }
}
\`\`\`

Os ids são os que aparecem em cada cabeçalho \`####\` abaixo. Use exatamente
esses — id que não existir no acervo faz a aplicação do lote parar.

Ao final, **fora do JSON**, diga o que você não conseguiu: período que não deu
para reescrever sem perder informação, trecho em que o futuro-do-pretérito era
a forma certa, dúvida que ficou.`;

/**
 * O que dizer a um agente que TEM acesso ao repositório.
 *
 * Pedro distribui os lotes por sessões do Codex e do Hermes, que leem e
 * escrevem nesta máquina. Para essas, o pacote deixa de ser só um texto a
 * colar e passa a ser uma ordem de serviço: o agente aplica o próprio lote.
 *
 * Aplicar em paralelo é seguro porque **nenhum país aparece em dois lotes**.
 * Cada sessão escreve num conjunto de arquivos que só ela toca — é a razão de
 * a repartição ser feita aqui, uma vez, em vez de cada sessão escolher o que
 * pegar. Duas sessões escolhendo sozinhas escolheriam o mesmo pior da fila.
 */
function comoAplicar(indice: number, isos: readonly string[]): string {
  return `## Se você tem acesso ao repositório

Grave a sua resposta num arquivo e aplique:

\`\`\`bash
pnpm tsx scripts/aplicar-lote.ts lotes/resposta-${String(indice).padStart(2, "0")}.json --ensaio
pnpm tsx scripts/aplicar-lote.ts lotes/resposta-${String(indice).padStart(2, "0")}.json
pnpm validar
\`\`\`

O \`--ensaio\` mostra a medida nova sem gravar nada. **Rode ele primeiro.**

Passe pelo \`aplicar-lote\` em vez de editar os JSON à mão mesmo podendo editar:
ele recusa id que não existe e período que encolheu mais de 25%, que são os
dois erros que uma reescrita em lote comete sem ninguém ver.

Os países deste lote são **só seus** — \`${isos.join(", ")}\`. Nenhum outro lote
toca nesses arquivos, então não há corrida com as outras sessões. Não mexa em
país que não está na lista.`;
}

function montarPacote(
  escolhidos: readonly EstiloDoPais[],
  porIso: Map<string, Pais>,
  regras: string,
  indice: number,
  total: number
): string {
  const isos = escolhidos.map((e) => e.iso);
  const partes: string[] = [];

  partes.push(
    total > 1
      ? `# Lote ${indice} de ${total} — reescrita de registro`
      : "# Lote de reescrita"
  );
  partes.push("");
  partes.push(
    `**${escolhidos.length} países:** ${escolhidos
      .map((e) => `${porIso.get(e.iso)?.nome ?? e.iso} (\`${e.iso}\`)`)
      .join(" · ")}`
  );
  partes.push("");
  partes.push(
    "Este arquivo é autossuficiente: contém a tarefa, o texto atual e as " +
      "regras. Funciona colado numa janela de conversa e funciona como ordem " +
      "de serviço para um agente com acesso ao repositório."
  );
  partes.push("");
  partes.push("---");
  partes.push("");
  partes.push(PEDIDO);
  partes.push("");
  partes.push("---");
  partes.push("");
  partes.push(comoAplicar(indice, isos));
  partes.push("");
  partes.push("---");
  partes.push("");
  partes.push("## Os países deste lote");
  partes.push("");
  for (const medida of escolhidos) {
    const pais = porIso.get(medida.iso);
    if (!pais) continue;
    partes.push(secaoDoPais(pais, medida));
  }
  partes.push("---");
  partes.push("");
  /*
   * As regras vêm DEPOIS da tarefa e do texto, e não antes, por uma razão
   * prática: são a parte mais longa do pacote, e um modelo que recebe oito
   * páginas de regra antes de saber o que se pede dele começa a leitura sem
   * ter onde pendurá-la.
   */
  partes.push(regras);
  return `${partes.join("\n")}\n`;
}

/**
 * O índice dos lotes — a folha que fica com quem distribui.
 *
 * Existe porque o nome do arquivo é um número e o número não diz nada sozinho.
 * Quem tem treze sessões para abrir precisa de uma tabela para marcar o que já
 * voltou, e precisa da medida de partida de cada lote para saber se voltou bom.
 */
function montarIndice(lotes: readonly EstiloDoPais[][], porIso: Map<string, Pais>): string {
  const linhas: string[] = [];
  const paises = lotes.reduce((n, l) => n + l.length, 0);
  linhas.push("# Índice dos lotes de reescrita");
  linhas.push("");
  linhas.push(
    `Gerado por \`pnpm lote --todos\`. **${paises} países fora dos tetos de ` +
      `registro**, repartidos em ${lotes.length} lotes. Nenhum país está em ` +
      "dois lotes — as sessões podem correr em paralelo sem disputar arquivo."
  );
  linhas.push("");
  linhas.push("| lote | países | períodos | pior futuro-do-pretérito | feito? |");
  linhas.push("|---|---|---|---|---|");
  lotes.forEach((lote, i) => {
    const periodos = lote.reduce(
      (n, e) => n + (porIso.get(e.iso)?.periodos.filter((p) => p.textoMdx).length ?? 0),
      0
    );
    linhas.push(
      `| \`${nomeDoLote(i + 1)}\` | ${lote.map((e) => e.iso).join(" ")} | ` +
        `${periodos} | ${lote[0].futuroDoPreterito.toFixed(1)} | |`
    );
  });
  linhas.push("");
  linhas.push("A meta de todo lote é a mesma: ≤ 5 de futuro-do-pretérito e ≤ 1 de");
  linhas.push("avaliativo, por mil palavras. Confira com `pnpm validar` depois de cada");
  linhas.push("lote aplicado — a fila encolhe à medida que voltam.");
  linhas.push("");
  return `${linhas.join("\n")}\n`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const todos = args.includes("--todos");
  const pedido = lerPedido(args.filter((a) => !a.startsWith("--")));

  const acervo = await carregarAcervo(RAIZ);
  const { fora } = coberturaDeEstilo(acervo);
  const regras = await fs.readFile(REGRAS, "utf8");
  const porIso = new Map(acervo.paises.map((p) => [p.iso, p]));

  const lotes = todos
    ? repartir(fora, pedido.quantos ?? TAMANHO_PADRAO)
    : [escolher(fora, pedido)];

  if (lotes.length === 0 || lotes[0].length === 0) {
    console.error(
      "\n✗ nenhum país escolhido — ou a fila de reescrita está vazia, ou os " +
        "códigos pedidos não estão nela.\n"
    );
    process.exit(1);
  }

  await fs.mkdir(DESTINO, { recursive: true });

  for (const [i, lote] of lotes.entries()) {
    const caminho = path.join(DESTINO, nomeDoLote(i + 1));
    await fs.writeFile(
      caminho,
      montarPacote(lote, porIso, regras, i + 1, lotes.length),
      "utf8"
    );
    const periodos = lote.reduce(
      (n, e) => n + (porIso.get(e.iso)?.periodos.filter((p) => p.textoMdx).length ?? 0),
      0
    );
    console.log(
      `  ${nomeDoLote(i + 1)}  ${String(lote.length).padStart(2)} países, ` +
        `${String(periodos).padStart(2)} períodos  ·  ${lote.map((e) => e.iso).join(" ")}`
    );
  }

  if (todos) {
    const indice = path.join(DESTINO, "INDICE.md");
    await fs.writeFile(indice, montarIndice(lotes, porIso), "utf8");
    console.log(`\n✓ ${lotes.length} lotes e o índice em lotes/`);
  } else {
    console.log(`\n✓ ${path.relative(process.cwd(), path.join(DESTINO, nomeDoLote(1)))}`);
  }
}

// `endsWith` e não `includes`: "preparar-lote-imagens" contém "preparar-lote",
// e o `includes` fazia este main rodar quando o outro script importava daqui.
if (process.argv[1]?.endsWith("preparar-lote.ts")) {
  void main();
}
