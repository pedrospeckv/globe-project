import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";
import { Prosa } from "@/components/conteudo/Prosa";
import { IndicadorChart } from "@/components/conteudo/IndicadorChart";
import { Estante } from "@/components/conteudo/Estante";
import {
  IconeFiguras,
  IconeLivros,
  IconePeriodos,
} from "@/components/conteudo/IconesAla";
import { eventosDoPais } from "@/lib/conteudo/evento";
import { rotuloDeData } from "@/lib/conteudo/tempo";
import { livros } from "@/lib/conteudo/nota";
import { resumoDe } from "@/lib/conteudo/pais";
import { DISPUTAS, paisesDaDisputa } from "@/lib/geo/disputas";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.paises.map((p) => ({ iso: p.iso }));
}

/**
 * A central do país.
 *
 * A forma vem do arquivo histórico de Bangladesh: capa larga com o nome e o
 * período coberto, três alas em cartão com ícone, e o índice cronológico num
 * trilho vertical. A paleta é a do memorial da Segunda Guerra — fundo zinc,
 * serifa de display, mono para metadado, amber como único acento —, que é para
 * onde o leitor vai ao abrir um período.
 *
 * Os dois templates se encaixam porque o trilho é o mesmo objeto: aqui ele
 * lista os períodos do país, lá ele conta o período por dentro.
 */
// Next 16: params é Promise e precisa de await.
export default async function PaisPage({
  params,
}: {
  params: Promise<{ iso: string }>;
}) {
  const { iso } = await params;
  const acervo = await carregarAcervo(RAIZ);
  const alvos = indexarAlvos(acervo);
  const pais = acervo.paises.find((p) => p.iso === iso);
  if (!pais) notFound();

  const figuras = acervo.figuras.filter((f) => f.paisIso === iso);
  const indicadores = acervo.indicadores.filter((i) => i.paisIso === iso);
  const eventos = eventosDoPais(acervo.eventos, iso);
  /*
   * Uma disputa pode envolver mais de um país do atlas — a Caxemira aparece
   * no dossiê da Índia e no da China. Filtrar por `atribuidoNaBase` só
   * funcionava enquanto toda disputa tinha um dono único na base.
   */
  const disputas = DISPUTAS.filter((d) =>
    paisesDaDisputa(d).some((p) => p === iso)
  );
  /*
   * A estante do país: livro cuja nota aponta para este dossiê, direto pelo
   * iso ou por um período dele. Sem o segundo caso a estante da Rússia
   * ficaria vazia mesmo tendo "Vikings" apontado para `ru-imperio` — o
   * vínculo existe, só não está no nível do país.
   */
  const idsDoPais = new Set([iso, ...pais.periodos.map((p) => p.id)]);
  const estante = livros(
    acervo.notas.filter((n) => n.alvos.some((a) => idsDoPais.has(a)))
  );

  const primeiro = pais.periodos[0];
  const ultimo = pais.periodos[pais.periodos.length - 1];
  const cobertura = primeiro
    ? `${rotuloDeData(primeiro.inicio)} — ${
        ultimo?.fim ? rotuloDeData(ultimo.fim) : "hoje"
      }`
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/*
        A capa. No template original é uma foto de fundo com o título centrado
        por cima; aqui o lugar da foto fica com um degradê, porque o atlas não
        tem imagem de país licenciada e inventar uma seria pior que não ter.
        A estrutura é a mesma e recebe foto no dia em que houver.
      */}
      <section className="relative overflow-hidden border-b border-zinc-800">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/10 via-zinc-950 to-zinc-950" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

        <div className="relative mx-auto max-w-5xl px-6 py-16 md:py-24">
          <Link
            href="/"
            className="font-mono text-xs tracking-wider text-zinc-500 transition-colors hover:text-amber-500"
          >
            ← globo
          </Link>

          <h1 className="mt-6 font-serif text-5xl leading-none tracking-tight text-zinc-50 md:text-7xl">
            {pais.nome}
          </h1>
          {cobertura && (
            <p className="mt-4 font-mono text-sm tracking-wider text-amber-500/80 md:text-base">
              {cobertura}
            </p>
          )}
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
            {pais.periodos.length} períodos documentados
            {figuras.length > 0 && `, ${figuras.length} figuras`}
            {eventos.length > 0 && `, ${eventos.length} eventos`}
            {estante.length > 0 &&
              `, ${estante.length} ${estante.length === 1 ? "livro lido" : "livros lidos"}`}
            .
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#periodos"
              className="rounded-md bg-amber-500 px-5 py-2.5 font-mono text-xs tracking-wider text-zinc-950 transition-colors hover:bg-amber-400"
            >
              PERCORRER OS PERÍODOS
            </a>
            {estante.length > 0 && (
              <a
                href="#livros"
                className="rounded-md border border-zinc-700 bg-zinc-900/50 px-5 py-2.5 font-mono text-xs tracking-wider text-zinc-300 backdrop-blur-sm transition-colors hover:border-amber-500/40 hover:text-amber-500"
              >
                VER OS LIVROS
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-20 px-6 py-16 md:py-24">
        {/* As três alas, como os três cartões de navegação do template. */}
        <section className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <a
            href="#periodos"
            className="group rounded-lg border border-zinc-800 p-6 transition-colors hover:border-amber-500/30"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <IconePeriodos className="h-10 w-10 text-amber-500" />
              <h3 className="font-serif text-xl text-zinc-50">Períodos</h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                A linha do tempo do território, um regime por vez, com o que
                mudou de fronteira e de governo em cada um.
              </p>
              <span className="mt-1 font-mono text-xs text-amber-500/70 group-hover:text-amber-500">
                {pais.periodos.length} →
              </span>
            </div>
          </a>

          <a
            href={figuras.length > 0 ? "#figuras" : "#periodos"}
            className="group rounded-lg border border-zinc-800 p-6 transition-colors hover:border-amber-500/30"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <IconeFiguras className="h-10 w-10 text-amber-500" />
              <h3 className="font-serif text-xl text-zinc-50">Figuras</h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                Quem respondeu por decisão registrada, com alegação, fonte e
                estado processual declarados.
              </p>
              <span className="mt-1 font-mono text-xs text-amber-500/70 group-hover:text-amber-500">
                {figuras.length > 0 ? `${figuras.length} →` : "nenhuma ainda"}
              </span>
            </div>
          </a>

          <a
            href={estante.length > 0 ? "#livros" : "/biblioteca"}
            className="group rounded-lg border border-zinc-800 p-6 transition-colors hover:border-amber-500/30"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <IconeLivros className="h-10 w-10 text-amber-500" />
              <h3 className="font-serif text-xl text-zinc-50">Livros</h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                O que foi lido sobre este país, com a nota de leitura de cada
                título.
              </p>
              <span className="mt-1 font-mono text-xs text-amber-500/70 group-hover:text-amber-500">
                {estante.length > 0 ? `${estante.length} →` : "a biblioteca →"}
              </span>
            </div>
          </a>
        </section>

        {/*
          O trilho cronológico, na forma do memorial: régua vertical em degradê
          amber, ponto por período, a data numa coluna própria à esquerda e o
          conteúdo à direita. É índice, não texto corrido — empilhar a prosa
          inteira passava de sete mil pixels de rolagem sem âncora para apontar
          um período específico.
        */}
        <section id="periodos" className="scroll-mt-8">
          <div className="mb-10 border-b border-zinc-800 pb-4">
            <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
              Períodos
            </h2>
            <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/80">
              {pais.periodos.length} REGIMES
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/20 via-amber-500/40 to-amber-500/20 md:left-[140px]" />

            <div className="space-y-12 md:space-y-16">
              {pais.periodos.map((p) => (
                <article key={p.id} className="group relative">
                  <div className="absolute left-[-3px] top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-500/20 transition-transform duration-300 group-hover:scale-150 md:left-[137px]" />

                  <div className="grid grid-cols-1 gap-4 pl-6 md:grid-cols-[140px_1fr] md:gap-10 md:pl-0">
                    {/*
                      O intervalo inteiro num elemento só, contíguo e sem
                      espaço em volta do traço. Não é capricho de tipografia:
                      os testes leem `textContent` procurando "221 a.C.–202
                      a.C.", e quebrar a data em dois elementos ou pôr espaço
                      ao lado do traço passaria a suíte a mentir. Período em
                      curso termina no traço — data no lugar dele seria data
                      inventada.
                    */}
                    <div className="md:pr-10 md:text-right">
                      <span className="font-mono text-base font-bold leading-tight tracking-tight text-amber-500 md:text-lg">
                        {`${rotuloDeData(p.inicio)}–${p.fim ? rotuloDeData(p.fim) : ""}`}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-serif text-2xl leading-tight tracking-tight text-zinc-50 transition-colors duration-300 group-hover:text-amber-500/90 md:text-3xl">
                        <Link href={`/pais/${pais.iso}/${p.id}`}>{p.rotulo}</Link>
                      </h3>
                      <p className="font-mono text-xs tracking-wide text-zinc-500">
                        {p.regime}
                      </p>

                      <div className="text-zinc-400">
                        <Prosa texto={resumoDe(p)} alvos={alvos} />
                      </div>

                      <p className="flex flex-wrap items-center gap-3 pt-1">
                        <Link
                          href={`/pais/${pais.iso}/${p.id}`}
                          className="font-mono text-xs tracking-wide text-amber-500/80 transition-colors hover:text-amber-500"
                        >
                          ler o período →
                        </Link>
                        {p.entidades.length >= 2 && (
                          <span className="font-mono text-[10px] text-zinc-600">
                            {p.entidades.length} Estados neste território
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div id="livros" className="scroll-mt-8">
          <Estante
            notas={estante}
            titulo="Livros"
            subtitulo={`lidos sobre ${pais.nome}`}
          />
        </div>

        {disputas.length > 0 && (
          /*
             A nota vive em lib/geo/disputas.ts, uma fonte só: é a mesma que
             o mapa usa para hachurar. Reescrevê-la aqui abriria espaço para
             a página e o mapa divergirem sobre o que está em disputa.
          */
          <section className="space-y-4">
            <div className="border-b border-zinc-800 pb-4">
              {/*
                "soberania disputada" em minúscula no meio do título é o que o
                teste procura em `textContent` — ele garante que o dossiê use a
                MESMA nota que o mapa hachura, e casa pela frase.
              */}
              <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
                Territórios de soberania disputada
              </h2>
              <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/80">
                {disputas.length} TERRITÓRIOS
              </p>
            </div>
            {disputas.map((d) => (
              <article
                key={d.id}
                className="rounded-lg border border-amber-900/40 bg-amber-950/10 p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="font-serif text-xl text-amber-200">{d.nome}</h3>
                  <span className="shrink-0 font-mono text-xs tracking-wider text-amber-500">
                    desde {rotuloDeData(d.desde)}
                  </span>
                </div>
                {d.recorte === "nenhum" && (
                  /*
                     Sem polígono na base, o mapa só põe um alfinete. Dizer
                     isso aqui é obrigatório: quem lê o dossiê e olha o globo
                     precisa saber por que a área não está hachurada como a
                     Crimeia está.
                  */
                  <p className="mt-3 text-xs leading-relaxed text-amber-500/80">
                    Administrado por{" "}
                    {[...d.paises, ...(d.forasteiros ?? [])].join(", ")}. A base
                    cartográfica não separa este território em polígono próprio,
                    então o mapa o marca com um alfinete e não com uma área.
                  </p>
                )}
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{d.nota}</p>
              </article>
            ))}
          </section>
        )}

        {eventos.length > 0 && (
          <section className="space-y-4">
            <div className="border-b border-zinc-800 pb-4">
              <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
                Eventos
              </h2>
              <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/80">
                {eventos.length} REGISTRADOS
              </p>
            </div>
            <ol className="space-y-3">
              {eventos.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-amber-500/30"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="font-serif text-lg text-zinc-50">{e.titulo}</h3>
                    <span className="shrink-0 font-mono text-xs tracking-wider text-amber-500">
                      {rotuloDeData(e.data)}
                    </span>
                  </div>
                  {e.paises.length > 1 && (
                    <p className="mt-1 font-mono text-[10px] tracking-wide text-zinc-600">
                      também: {e.paises.filter((p) => p !== iso).join(", ")}
                    </p>
                  )}
                  <div className="text-zinc-400">
                    <Prosa texto={e.textoMdx} alvos={alvos} />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {figuras.length > 0 && (
          <section id="figuras" className="scroll-mt-8 space-y-4">
            <div className="border-b border-zinc-800 pb-4">
              <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
                Figuras
              </h2>
              <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/80">
                {figuras.length} {figuras.length === 1 ? "PESSOA" : "PESSOAS"}
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {figuras.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/figura/${f.id}`}
                    className="group flex items-baseline justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-amber-500/30"
                  >
                    <span className="font-serif text-lg text-zinc-50 group-hover:text-amber-500/90">
                      {f.nome}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tracking-wider text-zinc-600">
                      {f.alegacoes.length > 0
                        ? `${f.alegacoes.length} ALEGAÇÃO(ÕES)`
                        : "SEM ALEGAÇÕES"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {indicadores.length > 0 && (
          <section className="space-y-4">
            <div className="border-b border-zinc-800 pb-4">
              <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
                Indicadores
              </h2>
            </div>
            {indicadores.map((i) => (
              <IndicadorChart
                key={i.id}
                indicador={i}
                fonte={acervo.fontes.find((f) => f.id === i.fonte)}
                periodos={pais.periodos}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
