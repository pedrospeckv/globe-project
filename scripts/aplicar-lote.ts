#!/usr/bin/env tsx
/**
 * Aplica a resposta de um lote de reescrita aos arquivos dos países.
 *
 *   pnpm tsx scripts/aplicar-lote.ts lotes/resposta.json
 *   pnpm tsx scripts/aplicar-lote.ts lotes/resposta.json --ensaio
 *
 * ## Por que a aplicação é um script, e não copiar e colar
 *
 * Um lote de dez países tem cerca de cinquenta períodos. Colar cinquenta
 * trechos à mão em dez arquivos JSON é onde o erro entra sem ser visto — texto
 * no período errado, aspas quebradas, um período pulado. E é trabalho que não
 * melhora nada: a decisão editorial foi tomada quando o lote foi aceito.
 *
 * ## O que ele recusa
 *
 * Recusa ANTES de escrever qualquer coisa, e o lote inteiro de uma vez —
 * aplicar metade deixaria o país num estado que ninguém pediu.
 *
 * 1. **Id que não existe no acervo.** É o sinal mais barato de modelo que
 *    inventou. Um id inventado que passasse viraria texto perdido.
 * 2. **Texto que encolheu demais.** A tarefa é trocar o registro, não resumir:
 *    "seria deposto em 1966" e "foi deposto em 1966" têm o mesmo tamanho. Um
 *    período que perde um terço das palavras perdeu fato junto, e nenhuma
 *    máquina consegue dizer qual — então ela para e devolve a decisão a quem
 *    lê.
 *
 * O que ele NÃO consegue conferir continua sendo o mesmo do resto do projeto:
 * se o texto novo diz a verdade. Por isso o relatório imprime a medida antes e
 * depois de cada país, e não uma aprovação.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { Pais } from "../lib/conteudo/pais";
import { medirEstilo } from "../lib/conteudo/estilo";
import { Imagem } from "../lib/conteudo/imagem";

const PAISES = path.join(process.cwd(), "conteudo", "paises");

/**
 * Quanto um período pode encolher antes de virar suspeita de resumo.
 *
 * 25% é folgado de propósito: tirar futuro-do-pretérito encurta um pouco
 * ("culminaria na deposição de 1966" → "culminou na deposição de 1966" é
 * neutro, mas "viria a ser deposto" → "foi deposto" tira duas palavras), e
 * cortar advérbio de intensidade encurta também. O que 25% pega é outra coisa:
 * o parágrafo que sumiu.
 */
const ENCOLHIMENTO_MAXIMO = 0.25;

export interface Resposta {
  /** Lote de reescrita: id do período → texto novo. */
  periodos?: Record<string, string>;
  /** Lote de ilustração: id do período → a imagem de época. */
  imagens?: Record<string, unknown>;
}

/**
 * Extrai o JSON da resposta do modelo, com ou sem cerca de markdown.
 *
 * Modelos devolvem ```json ... ``` mesmo quando o pedido diz "só o JSON", e
 * costumam escrever uma frase antes e a lista de ressalvas depois — que o
 * pedido, aliás, pede. Recusar por causa da cerca faria a pessoa editar à mão
 * exatamente o arquivo que este script existe para não ser editado à mão.
 */
export function lerResposta(bruto: string): Resposta {
  const cerca = bruto.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const alvo = cerca ? cerca[1] : bruto;

  let dados: unknown;
  try {
    dados = JSON.parse(alvo);
  } catch {
    /*
     * Sem cerca e sem JSON puro, tenta o maior bloco entre chaves — o caso da
     * resposta que começa com "Claro! Aqui está:" e termina com as ressalvas.
     */
    const inicio = alvo.indexOf("{");
    const fim = alvo.lastIndexOf("}");
    if (inicio === -1 || fim <= inicio) {
      throw new Error("não achei JSON nenhum na resposta");
    }
    dados = JSON.parse(alvo.slice(inicio, fim + 1));
  }

  const { periodos, imagens } = (dados ?? {}) as Resposta;
  if (!periodos && !imagens) {
    throw new Error('o JSON não tem "periodos" nem "imagens"');
  }
  for (const [id, texto] of Object.entries(periodos ?? {})) {
    if (typeof texto !== "string" || texto.trim() === "") {
      throw new Error(`o período "${id}" veio sem texto`);
    }
  }
  /*
   * A imagem é conferida pelo schema do acervo, e não por checagem à mão aqui:
   * `Imagem` já exige url https, alt, crédito e licença, e recusa o resto. O
   * único acréscimo é `origem` — opcional no schema porque o acervo antigo não
   * a tem, obrigatória num lote novo porque é a página onde alguém confere a
   * licença que o modelo declarou.
   */
  for (const [id, img] of Object.entries(imagens ?? {})) {
    const r = Imagem.safeParse(img);
    if (!r.success) {
      /*
       * O campo entra na mensagem porque o zod diz só "Required" quando ele
       * falta — as mensagens escritas à mão em `Imagem` só disparam com o
       * campo presente e vazio. "Required" sozinho não diz a quem colou a
       * resposta do modelo que faltou o crédito.
       */
      const { path: campo, message } = r.error.issues[0];
      throw new Error(`imagem de "${id}": ${campo.join(".") || "objeto"} — ${message}`);
    }
    if (!r.data.origem) {
      throw new Error(`imagem de "${id}" veio sem "origem" — sem ela ninguém confere a licença`);
    }
  }
  return { periodos, imagens };
}

/** Palavras de um texto, pela mesma contagem que a medida de registro usa. */
export function palavras(texto: string): number {
  return texto.split(/\s+/).filter(Boolean).length;
}

/**
 * O texto novo encolheu a ponto de ter perdido fato?
 *
 * Compara só o tamanho, e é tudo o que uma máquina pode comparar aqui. Crescer
 * nunca acusa: acrescentar detalhe concreto no lugar do advérbio é o que a
 * tarefa pede, e um período que cresce 20% provavelmente fez isso.
 */
export function encolheuDemais(
  antes: string,
  depois: string,
  tolerancia = ENCOLHIMENTO_MAXIMO
): boolean {
  const a = palavras(antes);
  if (a === 0) return false;
  return (a - palavras(depois)) / a > tolerancia;
}

interface Arquivo {
  caminho: string;
  pais: Pais;
}

async function carregarPaises(): Promise<Arquivo[]> {
  const nomes = (await fs.readdir(PAISES)).filter((n) => n.endsWith(".json"));
  const saida: Arquivo[] = [];
  for (const nome of nomes) {
    const caminho = path.join(PAISES, nome);
    const cru = JSON.parse(await fs.readFile(caminho, "utf8"));
    saida.push({ caminho, pais: Pais.parse(cru) });
  }
  return saida;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const ensaio = args.includes("--ensaio");
  const entrada = args.find((a) => !a.startsWith("--"));
  if (!entrada) {
    console.error("\nuso: pnpm tsx scripts/aplicar-lote.ts <resposta.json> [--ensaio]\n");
    process.exit(1);
  }

  /*
   * A recusa de leitura sai como frase, não como pilha. Quem recebe esta
   * mensagem é quem colou a resposta do modelo, e um stack trace do Node não
   * diz a essa pessoa que falta o campo `origem`.
   */
  let resposta: Resposta;
  try {
    resposta = lerResposta(await fs.readFile(entrada, "utf8"));
  } catch (e) {
    console.error(`\n✗ resposta ilegível — nada foi escrito\n`);
    console.error(`  ${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  }
  const textos = resposta.periodos ?? {};
  const imagens = (resposta.imagens ?? {}) as Record<string, Imagem>;
  const arquivos = await carregarPaises();

  /* Onde cada id de período mora — o índice que transforma id solto em arquivo. */
  const onde = new Map<string, Arquivo>();
  for (const a of arquivos) {
    for (const p of a.pais.periodos) onde.set(p.id, a);
  }

  const ids = [...new Set([...Object.keys(textos), ...Object.keys(imagens)])];
  const desconhecidos = ids.filter((id) => !onde.has(id));
  const encolhidos: string[] = [];
  for (const [id, novo] of Object.entries(textos)) {
    const antes = onde.get(id)?.pais.periodos.find((p) => p.id === id)?.textoMdx;
    if (antes && encolheuDemais(antes, novo)) {
      encolhidos.push(`${id} — ${palavras(antes)} → ${palavras(novo)} palavras`);
    }
  }

  if (desconhecidos.length > 0 || encolhidos.length > 0) {
    console.error("\n✗ o lote não foi aplicado — nada foi escrito\n");
    if (desconhecidos.length > 0) {
      console.error(`  ${desconhecidos.length} id(s) que não existem no acervo:`);
      for (const id of desconhecidos) console.error(`  · ${id}`);
      console.error("");
    }
    if (encolhidos.length > 0) {
      console.error(
        `  ${encolhidos.length} período(s) que encolheram mais de ` +
          `${ENCOLHIMENTO_MAXIMO * 100}% — a tarefa era trocar o registro, não resumir:`
      );
      for (const e of encolhidos) console.error(`  · ${e}`);
      console.error("");
    }
    process.exit(1);
  }

  /* Só agora escreve, e um arquivo por vez, para o relatório sair por país. */
  const tocados = new Map<string, Arquivo>();
  for (const id of ids) {
    const a = onde.get(id)!;
    const periodo = a.pais.periodos.find((p) => p.id === id)!;
    if (textos[id]) periodo.textoMdx = textos[id];
    if (imagens[id]) periodo.imagem = imagens[id];
    tocados.set(a.caminho, a);
  }

  const oQue = [
    Object.keys(textos).length > 0 && `${Object.keys(textos).length} textos`,
    Object.keys(imagens).length > 0 && `${Object.keys(imagens).length} imagens`,
  ]
    .filter(Boolean)
    .join(" e ");
  console.log(
    `\n${ensaio ? "ensaio — nada gravado" : "aplicado"}: ${oQue} em ${tocados.size} países\n`
  );

  for (const a of tocados.values()) {
    /*
     * O relatório diz o que a fila daquele lote mede. Num lote de reescrita é
     * o registro; num de ilustração é a cobertura — e ali o número que importa
     * é `com/total`, porque país pela metade é defeito e não progresso.
     */
    if (Object.keys(imagens).length > 0) {
      const com = a.pais.periodos.filter((p) => p.imagem).length;
      const total = a.pais.periodos.length;
      const marca = com === total ? "✓" : com === 0 ? " " : "✗ PELA METADE";
      console.log(`  ${a.pais.iso} ${a.pais.nome} → ${com}/${total} ilustrados ${marca}`);
    } else {
      const texto = a.pais.periodos.map((p) => p.textoMdx ?? "").filter(Boolean).join(" ");
      const m = medirEstilo(texto);
      console.log(
        `  ${a.pais.iso} ${a.pais.nome} → ${m.futuroDoPreterito.toFixed(1)} / ` +
          `${m.avaliativo.toFixed(1)} em ${m.palavras} palavras`
      );
    }

    if (!ensaio) {
      const cru = JSON.parse(await fs.readFile(a.caminho, "utf8")) as {
        periodos: { id: string; textoMdx?: string; imagem?: Imagem }[];
      };
      /*
       * Escreve sobre o JSON CRU, e não sobre o objeto validado pelo zod. O
       * schema tem `.default([])` em vários campos, e regravar o objeto
       * parseado gravaria esses padrões como se alguém os tivesse escrito —
       * um diff cheio de linhas que ninguém pediu, em arquivos que este
       * script não deveria estar reformatando.
       */
      for (const p of cru.periodos) {
        if (textos[p.id]) p.textoMdx = textos[p.id];
        if (imagens[p.id]) p.imagem = imagens[p.id];
      }
      await fs.writeFile(a.caminho, `${JSON.stringify(cru, null, 2)}\n`, "utf8");
    }
  }

  console.log(
    "\n  Confira antes de commitar:\n" +
      "    pnpm validar         — a fila encolheu? algum país ficou pela metade?\n" +
      (Object.keys(imagens).length > 0
        ? "    pnpm conferir-links  — os endereços das imagens existem?\n"
        : "    git diff             — algum fato sumiu?\n")
  );
}

if (process.argv[1]?.includes("aplicar-lote")) {
  void main();
}
