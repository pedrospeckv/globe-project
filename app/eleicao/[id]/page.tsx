import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";
import { Prosa } from "@/components/conteudo/Prosa";
import { CabecalhoDeSecao } from "@/components/design/CabecalhoDeSecao";
import { ROTULO_DA_SITUACAO } from "@/lib/conteudo/eleicao";
import { rotuloDeData } from "@/lib/conteudo/tempo";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.eleicoes.map((e) => ({ id: e.id }));
}

/**
 * Uma eleição, e as chapas que pediram registro.
 *
 * É a página do atlas com o maior risco de dizer mais do que sabe, e a forma
 * dela é toda feita de recusas:
 *
 * - **Ordem alfabética, dita em voz alta.** Qualquer outra ordenação insinua
 *   ranking. Por pesquisa seria ranking declarado; por tamanho de partido ou
 *   tempo de televisão, ranking disfarçado de critério técnico. O alfabeto é o
 *   único critério que não afirma nada sobre a disputa — e a página explica
 *   que é esse o critério, porque um leitor que não sabe qual é a regra supõe
 *   uma.
 * - **Cartão do mesmo tamanho para todos.** Sem destaque para quem lidera,
 *   sem recolhimento para quem tem 0%. Dar mais pixels a uns é editorializar
 *   com layout.
 * - **Nenhuma pesquisa, nenhum rótulo ideológico.** Ambos envelhecem em dias e
 *   os dois são exatamente o que faz leitor de esquerda e de direita verem
 *   telas diferentes.
 * - **A data da conferência no alto.** É o que separa "está errado" de "mudou
 *   depois". Sem ela o leitor não sabe se olha um retrato ou um erro.
 */
// Next 16: params é Promise e precisa de await.
export default async function EleicaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const acervo = await carregarAcervo(RAIZ);
  const alvos = indexarAlvos(acervo);

  const eleicao = acervo.eleicoes.find((e) => e.id === id);
  if (!eleicao) notFound();

  const pais = acervo.paises.find((p) => p.iso === eleicao.paisIso);
  const fontes = acervo.fontes.filter((f) => eleicao.fontes.includes(f.id));

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-20">
        {pais && (
          <Link
            href={`/pais/${pais.iso}`}
            className="font-mono text-xs tracking-wider text-zinc-500 transition-colors hover:text-amber-500"
          >
            ← {pais.nome}
          </Link>
        )}

        <header className="mt-8 mb-12 md:mb-16">
          <p className="font-mono text-[10px] tracking-[0.2em] text-zinc-600">
            ELEIÇÃO
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-none tracking-tight text-zinc-50 md:text-6xl">
            {eleicao.titulo}
          </h1>
          <p className="mt-4 font-mono text-sm tracking-wider text-amber-500/80">
            {eleicao.cargo.toUpperCase()}
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-zinc-800 py-5 sm:grid-cols-4">
            {[
              ["1º TURNO", rotuloDeData(eleicao.primeiroTurno)],
              ["2º TURNO", eleicao.segundoTurno && rotuloDeData(eleicao.segundoTurno)],
              [
                "PRAZO DE REGISTRO",
                eleicao.prazoDeRegistro && rotuloDeData(eleicao.prazoDeRegistro),
              ],
              ["CHAPAS", String(eleicao.chapas.length)],
            ]
              .filter(([, valor]) => valor)
              .map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <dt className="font-mono text-[10px] tracking-widest text-zinc-600">
                    {rotulo}
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-amber-500">{valor}</dd>
                </div>
              ))}
          </dl>
        </header>

        <article className="mb-14 max-w-3xl md:mb-20">
          <Prosa texto={eleicao.abertura} alvos={alvos} />
        </article>

        <section className="mb-16 md:mb-20">
          <CabecalhoDeSecao
            titulo="As chapas"
            contador={`${eleicao.chapas.length} · EM ORDEM ALFABÉTICA`}
          />

          {/*
            A explicação da ordem vem ANTES da lista, não num rodapé. Quem lê
            uma lista de candidatos supõe um critério na primeira linha; dizer
            depois seria tarde.
          */}
          <p className="mb-8 text-sm leading-relaxed text-zinc-500">
            A lista está em ordem alfabética pelo primeiro nome do candidato — não
            por pesquisa, tamanho de partido ou tempo de propaganda. Todos os
            cartões têm o mesmo tamanho pelo mesmo motivo.
          </p>

          <ul className="space-y-3">
            {eleicao.chapas.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-amber-500/30"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-serif text-xl text-zinc-50">
                    {c.figura ? (
                      <Link
                        href={`/figura/${c.figura}`}
                        className="hover:text-amber-500/90"
                      >
                        {c.candidato}
                      </Link>
                    ) : (
                      c.candidato
                    )}
                  </h3>
                  <span className="shrink-0 font-mono text-xs tracking-wider text-amber-500/80">
                    {c.partido}
                  </span>
                </div>

                {c.vice && (
                  <p className="mt-1 text-sm text-zinc-400">
                    vice: <span className="text-zinc-300">{c.vice}</span>
                  </p>
                )}

                <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  {ROTULO_DA_SITUACAO[c.situacao]}
                </p>

                {c.nota && (
                  /*
                    O mesmo lugar que a `nota` da alegação ocupa: onde o rótulo
                    fechado não dá conta sozinho. É aqui que cabe "registrado E
                    inelegível ao mesmo tempo".
                  */
                  <div className="mt-2 border-l-2 border-zinc-800 pl-4">
                    <Prosa texto={c.nota} alvos={alvos} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {eleicao.fecho && (
          <section className="mb-16 md:mb-20">
            <div className="mb-8 h-px bg-gradient-to-r from-zinc-800 to-transparent" />
            <div className="max-w-3xl border-l-2 border-zinc-800 pl-6 text-zinc-400">
              <Prosa texto={eleicao.fecho} alvos={alvos} />
            </div>
          </section>
        )}

        <section className="mt-20 md:mt-24">
          <div className="mb-10 h-px bg-gradient-to-r from-zinc-800 to-transparent" />
          <h2 className="font-serif text-3xl leading-tight tracking-tight text-zinc-400 md:text-4xl">
            {fontes.length === 1 ? "Fonte" : "Fontes"}
          </h2>
          <ul className="mt-8 space-y-5">
            {fontes.map((f) => (
              <li key={f.id} className="border-l-2 border-zinc-800 pl-5">
                <p className="text-sm leading-relaxed">
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-500/80 hover:text-amber-500 hover:underline"
                    >
                      {f.titulo}
                    </a>
                  ) : (
                    <span className="text-zinc-300">{f.titulo}</span>
                  )}
                </p>
                <p className="mt-1 font-mono text-[10px] tracking-wide text-zinc-600">
                  {[f.autor, f.publicacao, f.data && rotuloDeData(f.data)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {f.citacao && (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    {f.citacao}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {/*
            A data da conferência fecha a página, e é informação de primeira
            classe num assunto que muda por decisão judicial de um dia para o
            outro.
          */}
          <p className="mt-10 font-mono text-[10px] tracking-widest text-zinc-600">
            LISTA CONFERIDA EM {rotuloDeData(eleicao.conferidoEm)}
          </p>
        </section>
      </div>
    </main>
  );
}
