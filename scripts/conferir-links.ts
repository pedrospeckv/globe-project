#!/usr/bin/env tsx
/**
 * Confere que todo endereço do acervo existe de verdade.
 *
 *   pnpm conferir-links          # usa o cache: só o que não foi visto há 30 dias
 *   pnpm conferir-links --tudo   # ignora o cache e bate em todos
 *
 * ## Por que este script existe
 *
 * A regra que resume o projeto é que nenhuma URL pode ser inventada, e até
 * aqui nada no repositório conferia isso. `Fonte.url` e `Imagem.url` são
 * `z.string().url()` — o zod confere a FORMA do endereço, não a existência
 * dele. `https://commons.wikimedia.org/wiki/File:Nao_Existe.jpg` passa na
 * validação, entra no build e vira um buraco na página.
 *
 * Isso importava pouco quando cada linha era escrita à mão e conferida na
 * hora. Passa a importar quando o trabalho de redação é distribuído: um
 * modelo que inventa um endereço plausível produz exatamente o defeito que a
 * revisão humana lê por cima, porque o endereço PARECE certo. Máquina que
 * bate na porta não se distrai.
 *
 * ## Por que fora do `pnpm validar`
 *
 * `validar` roda em todo build e em todo PR, e é a resposta rápida a quem
 * escreve conteúdo — segundos, sem rede. Enfiar centenas de requisições ali
 * tornaria lento o passo que precisa ser barato, e faria `pnpm build`
 * depender da conexão de quem constrói. São perguntas diferentes: `validar`
 * pergunta se o texto está bem-formado, este script pergunta se o mundo lá
 * fora concorda.
 *
 * ## O que ele NÃO garante, dito aqui para não virar falsa segurança
 *
 * Que o endereço responde não quer dizer que ele sustenta o que a fonte
 * afirma. Um link vivo para a página errada passa por aqui. E o alcance é
 * menor do que parece: das 617 fontes do acervo, **30 têm URL**. As outras
 * 587 são livros, documentos e decisões sem endereço nenhum, e para essas
 * este script não tem o que perguntar.
 */
import fs from "node:fs/promises";
import path from "node:path";

const RAIZ = path.join(process.cwd(), "conteudo");
const CACHE = path.join(process.cwd(), ".cache", "links.json");

/** Dias que um endereço vivo vale antes de ser conferido de novo. */
const VALIDADE_DIAS = 30;

/**
 * Servidores diferentes conferidos ao mesmo tempo.
 *
 * O paralelismo é por HOST, e não pela fila inteira, porque o acervo é
 * concentrado: 355 dos 391 endereços estão em dois servidores da Wikimedia.
 * Oito requisições simultâneas contra a fila embaralhada viram oito
 * requisições simultâneas contra o Commons, e a primeira execução deste script
 * levou **169 respostas 429** por isso — limite de taxa, não link podre. Ninguém
 * aprende nada com um relatório em que quase metade do acervo aparece como
 * "não pude conferir".
 */
const HOSTS_SIMULTANEOS = 8;

/**
 * Dentro de um mesmo servidor, uma requisição por vez, com respiro entre elas.
 *
 * É a política de robô que a Wikimedia pede, e o custo é aceitável: os dois
 * hosts grandes correm em paralelo um com o outro, então o acervo inteiro sai
 * em pouco mais de um minuto.
 */
const PAUSA_MS = 150;

/** Teto da pausa adaptativa. Acima disso o servidor não quer robô nenhum. */
const PAUSA_MAX_MS = 4_000;

/** Repetições de um endereço que respondeu 429, antes de virar "incerto". */
const REPETICOES = 3;

const ESPERA_MS = 10_000;

/**
 * Identificação honesta. O Commons responde 403 a cliente sem User-Agent, e
 * um agente que se apresenta é o que a política deles pede de robô.
 */
const AGENTE =
  "AtlasBot/0.1 (https://github.com/pedrospeckv/globe-project; verificador de links)";

/** Um endereço encontrado no acervo, com o caminho de volta até ele. */
export interface Achado {
  url: string;
  /** Caminho do arquivo, relativo à raiz do repositório. */
  arquivo: string;
  /** Onde dentro do arquivo, em notação de acesso: `periodos[2].imagem.url`. */
  campo: string;
}

/**
 * Todo endereço `http(s)` dentro de um JSON, com o caminho até cada um.
 *
 * Varre a estrutura inteira em vez de ler campos conhecidos de propósito. Os
 * endereços do acervo moram em vários lugares — `Fonte.url`, `Imagem.url`,
 * `Imagem.origem`, `Livro.capa`, e as imagens aninhadas dentro de período,
 * bloco de episódio, trajetória de figura e chapa de eleição. Uma lista de
 * campos conhecidos ficaria desatualizada no dia em que um schema ganhasse um
 * campo, e ficaria desatualizada em silêncio, que é o pior modo.
 *
 * O caminho é montado na descida porque a mensagem de erro é endereçada a
 * quem escreve conteúdo, não a quem programa: `brasil.json → periodos[2]`
 * abre o arquivo no lugar certo, e `url quebrada` sozinho manda procurar.
 */
export function coletarUrls(dados: unknown, arquivo: string): Achado[] {
  const achados: Achado[] = [];

  function desce(no: unknown, campo: string): void {
    if (typeof no === "string") {
      if (/^https?:\/\//.test(no)) achados.push({ url: no, arquivo, campo });
      return;
    }
    if (Array.isArray(no)) {
      no.forEach((item, i) => desce(item, `${campo}[${i}]`));
      return;
    }
    if (no && typeof no === "object") {
      for (const [chave, valor] of Object.entries(no)) {
        desce(valor, campo ? `${campo}.${chave}` : chave);
      }
    }
  }

  desce(dados, "");
  return achados;
}

export type Veredito = "vivo" | "morto" | "incerto";

/**
 * O que o código de resposta permite afirmar.
 *
 * Três estados, e não dois, porque a diferença entre "não existe" e "não me
 * deixaram ver" é justamente a que não pode ser apagada. Reprovar um PR por
 * causa de um 403 do Cloudflare seria acusar o contribuidor de inventar uma
 * fonte que existe — e o custo desse erro é alguém apagar conteúdo bom para
 * destravar o build.
 *
 * - **morto**: 404 e 410. O servidor está no ar e diz que a página não existe.
 *   É a única resposta que prova invenção ou link podre, e a única que reprova.
 * - **incerto**: 401, 403, 429 e 5xx. O servidor existe e não respondeu sobre
 *   o recurso: barreira de robô, limite de taxa ou defeito do outro lado.
 * - **vivo**: 2xx e 3xx. Redirecionamento conta como vivo — mudança de
 *   endereço é manutenção do site, não erro do atlas.
 */
export function classificar(status: number): Veredito {
  if (status === 404 || status === 410) return "morto";
  if (status >= 200 && status < 400) return "vivo";
  return "incerto";
}

export interface Registro {
  veredito: Veredito;
  status: number;
  /** Por que não houve status. Só quando `status` é 0. */
  causa?: string;
  /** Data da conferência, `AAAA-MM-DD`. */
  em: string;
}

export type Cache = Record<string, Registro>;

/**
 * O registro precisa ser conferido de novo?
 *
 * Só endereço **vivo** e recente é dispensado. Morto e incerto voltam à fila
 * em toda execução, porque são exatamente os que mudam de estado: um link
 * consertado precisa parar de reprovar no mesmo dia, e um 403 de limite de
 * taxa não pode virar veredito permanente por ter caído numa hora ruim.
 */
export function vencido(
  reg: Registro | undefined,
  hoje: Date,
  dias = VALIDADE_DIAS
): boolean {
  if (!reg || reg.veredito !== "vivo") return true;
  const idade =
    (hoje.getTime() - new Date(`${reg.em}T00:00:00Z`).getTime()) / 86_400_000;
  return !Number.isFinite(idade) || idade >= dias;
}

/** Falha de rede — sem resposta HTTP nenhuma. Distinta de qualquer status. */
const SEM_RESPOSTA = 0;

/**
 * Bate na porta. `HEAD` primeiro, `GET` quando o servidor não aceita `HEAD`.
 *
 * `HEAD` traz só o cabeçalho e não baixa a imagem — a diferença entre alguns
 * quilobytes e alguns megabytes vezes as centenas de arquivos do Commons. Mas
 * nem todo servidor implementa: 405 e 501 são a recusa do método, não do
 * recurso, e ali o `GET` é a única maneira de saber.
 */
async function bater(url: string): Promise<Resposta> {
  async function tentar(method: "HEAD" | "GET"): Promise<number> {
    const r = await fetch(url, {
      method,
      redirect: "follow",
      headers: { "User-Agent": AGENTE },
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    return r.status;
  }

  try {
    const status = await tentar("HEAD");
    if (status === 405 || status === 501) return { status: await tentar("GET") };
    return { status };
  } catch (e) {
    return { status: SEM_RESPOSTA, causa: causaDe(e) };
  }
}

/** Uma batida na porta: o código, e por que não houve código quando não houve. */
export interface Resposta {
  status: number;
  causa?: string;
}

/**
 * Por que a requisição nem chegou a ter um código de resposta.
 *
 * Existe porque "sem resposta" mentia por omissão. Quatro endereços oficiais
 * brasileiros — três do STF e o da Comissão Nacional da Verdade — falham com
 * `UNABLE_TO_VERIFY_LEAF_SIGNATURE`: o servidor **está no ar e responde**, mas
 * a cadeia do certificado dele não fecha contra a lista de autoridades que o
 * Node traz de fábrica, porque é ICP-Brasil. Relatar isso como "não
 * respondeu" faria alguém sair caçando um link que não está quebrado — e num
 * atlas em que decisão do STF sustenta as alegações mais contestadas do
 * acervo, esse é o erro caro.
 */
export function causaDe(e: unknown): string {
  const codigo =
    e && typeof e === "object" && "cause" in e
      ? (e as { cause?: { code?: string } }).cause?.code
      : undefined;
  if (codigo === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || codigo === "CERT_HAS_EXPIRED") {
    return "certificado não verificado";
  }
  // `AbortSignal.timeout` lança `DOMException`, que no Node não é `Error`.
  if ((e as { name?: string })?.name === "TimeoutError") return "estourou o tempo";
  if (codigo === "ENOTFOUND") return "servidor não existe";
  return codigo ?? "sem resposta";
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A próxima pausa deste servidor, depois de ele ter respondido `status`.
 *
 * O ritmo se ajusta ao servidor em vez de ser adivinhado, porque adivinhar
 * errou duas vezes: a 150 ms o `upload.wikimedia.org` ainda devolveu 92
 * respostas 429, e um número fixo alto o bastante para ele castigaria os
 * outros vinte servidores do acervo sem motivo.
 *
 * Dobra a cada 429 até o teto e volta a encolher quando o servidor volta a
 * responder — assim uma rajada de limite não fixa o script no passo mais
 * lento pelo resto da execução.
 */
export function proximaPausa(pausa: number, status: number): number {
  if (status === 429) return Math.min(pausa * 2, PAUSA_MAX_MS);
  return Math.max(PAUSA_MS, Math.round(pausa * 0.9));
}

/** O servidor de um endereço, para agrupar a fila por quem responde. */
export function hostDe(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Agrupa a fila por servidor — a unidade em que o ritmo é respeitado. */
export function agruparPorHost(urls: readonly string[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const u of urls) {
    const h = hostDe(u);
    const lista = mapa.get(h);
    if (lista) lista.push(u);
    else mapa.set(h, [u]);
  }
  return mapa;
}

/** Todo `.json` de `conteudo/`, incluindo subpastas. */
async function arquivosDeConteudo(dir: string): Promise<string[]> {
  const itens = await fs.readdir(dir, { withFileTypes: true });
  const saida: string[] = [];
  for (const item of itens) {
    const caminho = path.join(dir, item.name);
    if (item.isDirectory()) saida.push(...(await arquivosDeConteudo(caminho)));
    else if (item.name.endsWith(".json")) saida.push(caminho);
  }
  return saida;
}

async function lerCache(): Promise<Cache> {
  try {
    return JSON.parse(await fs.readFile(CACHE, "utf8")) as Cache;
  } catch {
    return {};
  }
}

async function gravarCache(cache: Cache): Promise<void> {
  await fs.mkdir(path.dirname(CACHE), { recursive: true });
  await fs.writeFile(CACHE, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

/** Roda `tarefa` sobre a fila com no máximo `limite` em voo ao mesmo tempo. */
async function emParalelo<T>(
  fila: readonly T[],
  limite: number,
  tarefa: (item: T) => Promise<void>
): Promise<void> {
  let proximo = 0;
  const trabalhadores = Array.from(
    { length: Math.min(limite, fila.length) },
    async () => {
      while (proximo < fila.length) {
        await tarefa(fila[proximo++]);
      }
    }
  );
  await Promise.all(trabalhadores);
}

async function main(): Promise<void> {
  const tudo = process.argv.includes("--tudo");
  const hoje = new Date();
  const dia = hoje.toISOString().slice(0, 10);

  const arquivos = await arquivosDeConteudo(RAIZ);
  const achados: Achado[] = [];
  for (const arquivo of arquivos) {
    const dados = JSON.parse(await fs.readFile(arquivo, "utf8")) as unknown;
    achados.push(...coletarUrls(dados, path.relative(process.cwd(), arquivo)));
  }

  /*
   * Um endereço citado em cinco lugares é uma requisição, não cinco — mas os
   * cinco lugares são guardados, porque a mensagem precisa dizer todos: quem
   * conserta um link morto tem de saber que ele está em cinco arquivos.
   */
  const porUrl = new Map<string, Achado[]>();
  for (const a of achados) {
    const lista = porUrl.get(a.url);
    if (lista) lista.push(a);
    else porUrl.set(a.url, [a]);
  }

  const cache = tudo ? {} : await lerCache();
  const fila = [...porUrl.keys()].filter((u) => vencido(cache[u], hoje));
  const doCache = porUrl.size - fila.length;

  console.log(
    `conferindo ${fila.length} endereço(s) de ${porUrl.size} no acervo` +
      (doCache > 0
        ? ` — ${doCache} já conferido(s) nos últimos ${VALIDADE_DIAS} dias`
        : "") +
      ` · ${agruparPorHost(fila).size} servidor(es), um por vez em cada\n`
  );

  const resultados: Cache = {};
  let feitos = 0;
  const porHost = agruparPorHost(fila);
  await emParalelo([...porHost.values()], HOSTS_SIMULTANEOS, async (doHost) => {
    let pausa = PAUSA_MS;
    for (const url of doHost) {
      let r: Resposta = { status: SEM_RESPOSTA };
      /*
       * A repetição acontece AQUI, e não dentro de `bater`, porque quem sabe
       * o ritmo é o servidor — e o ritmo é estado do host, não da requisição.
       * Insistir sem desacelerar seria pedir o mesmo 429 três vezes.
       */
      for (let tentativa = 0; tentativa <= REPETICOES; tentativa++) {
        r = await bater(url);
        pausa = proximaPausa(pausa, r.status);
        if (r.status !== 429) break;
        await dormir(pausa);
      }
      resultados[url] = {
        veredito: r.status === SEM_RESPOSTA ? "incerto" : classificar(r.status),
        status: r.status,
        ...(r.causa ? { causa: r.causa } : {}),
        em: dia,
      };
      feitos++;
      if (feitos % 25 === 0) console.log(`  … ${feitos}/${fila.length}`);
      await dormir(pausa);
    }
  });

  const juntos: Cache = { ...cache, ...resultados };
  await gravarCache(juntos);

  /*
   * A rede caiu, e não o acervo.
   *
   * Sem esta checagem, rodar offline acusaria centenas de endereços
   * inventados — e a saída fácil para "consertar" seria apagar fonte boa. Um
   * script que reprova precisa dizer de quem é a culpa quando a culpa não é
   * do conteúdo.
   */
  const semResposta = Object.values(resultados).filter(
    (r) => r.status === SEM_RESPOSTA
  );
  if (fila.length > 0 && semResposta.length === fila.length) {
    console.error(
      `\n✗ nenhum dos ${fila.length} endereços respondeu — isto é a rede desta ` +
        "máquina, não o conteúdo. Nada foi julgado.\n"
    );
    process.exit(1);
  }

  const mortos = [...porUrl.keys()].filter((u) => juntos[u]?.veredito === "morto");
  const incertos = [...porUrl.keys()].filter(
    (u) => juntos[u]?.veredito === "incerto"
  );
  const vivos = porUrl.size - mortos.length - incertos.length;

  if (incertos.length > 0) {
    console.log(
      `\n⚠ ${incertos.length} endereço(s) não puderam ser conferidos — ` +
        "barreira de robô, limite de taxa ou defeito do servidor. Não é acusação:"
    );
    for (const u of incertos) {
      const r = juntos[u];
      console.log(`  · [${r.status || r.causa || "sem resposta"}] ${u}`);
      for (const a of porUrl.get(u) ?? []) {
        console.log(`      ${a.arquivo} → ${a.campo}`);
      }
    }
    console.log("");
  }

  if (mortos.length > 0) {
    console.error(`\n✗ ${mortos.length} endereço(s) não existem\n`);
    for (const u of mortos) {
      console.error(`  · [${juntos[u].status}] ${u}`);
      for (const a of porUrl.get(u) ?? []) {
        console.error(`      ${a.arquivo} → ${a.campo}`);
      }
    }
    console.error(
      "\n  Um endereço que responde 404 ou 410 não é link podre de site que mudou:\n" +
        "  é endereço que o servidor afirma não ter. Ou corrija, ou remova a fonte.\n"
    );
    process.exit(1);
  }

  console.log(`✓ ${vivos} de ${porUrl.size} endereços do acervo respondem`);
}

/* O `main` só roda como programa; importado no teste, o módulo é só as funções. */
if (process.argv[1]?.includes("conferir-links")) {
  void main();
}
