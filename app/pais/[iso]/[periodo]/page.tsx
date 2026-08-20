import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";
import { Prosa } from "@/components/conteudo/Prosa";
import { FotoHistorica } from "@/components/conteudo/FotoHistorica";
import { eventosDoPeriodo } from "@/lib/conteudo/evento";
import { episodiosDoPeriodo, imagensDe } from "@/lib/conteudo/episodio";
import { figurasDoPeriodo } from "@/lib/conteudo/figura";
import { vizinhosDe } from "@/lib/conteudo/pais";
import { notasDoAlvo } from "@/lib/conteudo/nota";
import { rotuloDeData } from "@/lib/conteudo/tempo";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.paises.flatMap((p) =>
    p.periodos.map((per) => ({ iso: p.iso, periodo: per.id }))
  );
}

/**
 * O período por dentro, na forma do memorial da Segunda Guerra.
 *
 * A régua vertical em degradê amber, o ponto por acontecimento, a data numa
 * coluna própria em mono e o título em serifa de display — é o mesmo objeto que
 * a central do país usa para listar os períodos, e é de propósito: descer do
 * país para o período não troca de linguagem, só de escala. Lá cada ponto é um
 * regime; aqui cada ponto é um dia.
 *
 * A foto entra onde o template original põe a dele, com uma diferença que o
 * original não tem: crédito e licença embaixo, exigidos pelo schema.
 */
// Next 16: params é Promise e precisa de await.
export default async function PeriodoPage({
  params,
}: {
  params: Promise<{ iso: string; periodo: string }>;
}) {
  const { iso, periodo: periodoId } = await params;
  const acervo = await carregarAcervo(RAIZ);
  const alvos = indexarAlvos(acervo);

  const pais = acervo.paises.find((p) => p.iso === iso);
  if (!pais) notFound();

  const periodo = pais.periodos.find((p) => p.id === periodoId);
  if (!periodo) notFound();

  const fontes = acervo.fontes.filter((f) => periodo.fontes.includes(f.id));
  const eventos = eventosDoPeriodo(acervo.eventos, iso, periodo);
  const figuras = figurasDoPeriodo(acervo.figuras, iso, periodo);
  const notas = notasDoAlvo(acervo.notas, periodo.id);
  const episodios = episodiosDoPeriodo(acervo.episodios, periodo.id);
  const { anterior, proximo } = vizinhosDe(pais, periodo.id);

  /*
   * Contíguo e terminando em traço quando o período está em curso. As duas
   * coisas são regra do projeto com teste em cima: "hoje" num site estático
   * envelhece sozinho, e qualquer data no lugar do traço seria data inventada.
   */
  const intervalo = `${rotuloDeData(periodo.inicio)}–${
    periodo.fim ? rotuloDeData(periodo.fim) : ""
  }`;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-20">
        <Link
          href={`/pais/${pais.iso}`}
          className="font-mono text-xs tracking-wider text-zinc-500 transition-colors hover:text-amber-500"
        >
          ← {pais.nome}
        </Link>

        <header className="mt-8 mb-16 md:mb-20">
          <h1 className="font-serif text-4xl leading-none tracking-tight text-zinc-50 md:text-6xl">
            {periodo.rotulo}
          </h1>
          <p className="mt-4 font-mono text-sm tracking-wider text-amber-500/80 md:text-base">
            {intervalo}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
            {periodo.regime}
          </p>
        </header>

        {periodo.imagem && (
          /*
            A imagem do período vem ANTES da prosa, e é a única do dossiê que
            ocupa a largura toda.

            Antes do texto porque ela é a abertura do período, não ilustração
            de um parágrafo — o leitor chega da linha do tempo do país, onde só
            viu um rótulo e um intervalo de datas, e a foto é o que dá lugar e
            época ao que vem a seguir. Depois da prosa ela viraria rodapé.

            A regra que governa a escolha está no schema: feita durante o
            período, não sobre ele.
          */
          <div className="mb-16 md:mb-20">
            <FotoHistorica imagem={periodo.imagem} />
          </div>
        )}

        {periodo.textoMdx && (
          <article className="mb-16 max-w-3xl text-zinc-300 md:mb-20">
            <Prosa texto={periodo.textoMdx} alvos={alvos} />
          </article>
        )}

        {eventos.length > 0 && (
          /*
            O trilho do memorial. Cada evento é um ponto na régua, com a data à
            esquerda em mono e o acontecimento à direita — e a foto, quando há
            uma licenciada, abaixo do texto como no original.
          */
          <section className="mb-16 md:mb-20">
            <div className="mb-10 border-b border-zinc-800 pb-4">
              <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
                Acontecimentos
              </h2>
              <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/80">
                {eventos.length} NO PERÍODO
              </p>
            </div>

            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/20 via-amber-500/40 to-amber-500/20 md:left-[120px]" />

              <ol className="space-y-14 md:space-y-20">
                {eventos.map((e) => (
                  <li key={e.id} className="group relative">
                    <div className="absolute left-[-3px] top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-500/20 transition-transform duration-300 group-hover:scale-150 md:left-[117px]" />

                    <div className="grid grid-cols-1 gap-4 pl-6 md:grid-cols-[120px_1fr] md:gap-10 md:pl-0">
                      <div className="md:pr-10 md:text-right">
                        <div className="font-mono text-base font-bold tracking-tight text-amber-500 md:text-lg">
                          {rotuloDeData(e.data)}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-serif text-2xl leading-tight tracking-tight text-zinc-50 transition-colors duration-300 group-hover:text-amber-500/90 md:text-3xl">
                          {e.titulo}
                        </h3>

                        {e.paises.length > 1 && (
                          <p className="font-mono text-[10px] tracking-wide text-zinc-600">
                            também: {e.paises.filter((p) => p !== iso).join(", ")}
                          </p>
                        )}

                        <div className="max-w-2xl text-zinc-400">
                          <Prosa texto={e.textoMdx} alvos={alvos} />
                        </div>

                        {e.imagem && <FotoHistorica imagem={e.imagem} />}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {episodios.length > 0 && (
          /*
            Um recorte que não coube no período: curto demais para virar um,
            específico demais para diluir na prosa. Fica aqui como porta, e o
            texto do episódio mora em página própria — com as imagens, que é
            o que ele tem e o período não.
          */
          <section className="mb-16 md:mb-20">
            <div className="mb-6 border-b border-zinc-800 pb-4">
              <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
                Episódios
              </h2>
              <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/80">
                DENTRO DESTE PERÍODO
              </p>
            </div>
            <ul className="space-y-3">
              {episodios.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/episodio/${e.id}`}
                    className="group block rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-amber-500/30"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-serif text-xl text-zinc-50 group-hover:text-amber-500/90">
                        {e.titulo}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tracking-wider text-zinc-600">
                        {rotuloDeData(e.inicio)}–
                        {e.fim ? rotuloDeData(e.fim) : ""} ·{" "}
                        {imagensDe(e)} IMAGENS
                      </span>
                    </div>
                    {e.subtitulo && (
                      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                        {e.subtitulo}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {periodo.entidades.length >= 2 && (
          <section className="mb-16 md:mb-20">
            <div className="mb-6 border-b border-zinc-800 pb-4">
              <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
                Estados neste território
              </h2>
              <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/80">
                {periodo.entidades.length} AO MESMO TEMPO
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {periodo.entidades.map((e) => (
                <div
                  key={e.nome}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-amber-500/30"
                >
                  <h3 className="font-serif text-lg text-zinc-50">{e.nome}</h3>
                  <p className="mt-0.5 font-mono text-[11px] tracking-wide text-zinc-500">
                    {e.regime}
                  </p>
                  <div className="text-zinc-400">
                    <Prosa texto={e.textoMdx} alvos={alvos} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              O mapa desenha este território como uma forma só. A fronteira entre
              estes Estados exigiria geometria histórica, que o atlas ainda não tem —
              por isso o país aparece hachurado no globo neste período.
            </p>
          </section>
        )}

        {figuras.length > 0 && (
          <section className="mb-16 md:mb-20">
            <div className="mb-6 border-b border-zinc-800 pb-4">
              <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
                Figuras com cargo no período
              </h2>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {figuras.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/figura/${f.id}`}
                    className="group block rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-amber-500/30"
                  >
                    <span className="font-serif text-lg text-zinc-50 group-hover:text-amber-500/90">
                      {f.nome}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {notas.length > 0 && (
          /*
            Aponta para a nota, nunca inclui o texto dela. Misturar as duas
            camadas apagaria a diferença entre o que tem lastro e o que é
            rascunho de estudo — que é a diferença que o atlas existe para
            manter.

            O rodapé mudou de redação junto com a revisão das notas: dizer "sem
            revisão e sem fonte" das que já foram conferidas seria falso, e
            dizer que todas foram seria pior. Quem decide é o dado.
          */
          <section className="mb-16 md:mb-20">
            <div className="mb-6 border-b border-zinc-800 pb-4">
              <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
                Anotações
              </h2>
            </div>
            <ul className="space-y-2">
              {notas.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/nota/${n.id}`}
                    className="group flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-amber-500/30"
                  >
                    <span className="font-serif text-lg text-zinc-50 group-hover:text-amber-500/90">
                      {n.titulo}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tracking-wider text-zinc-600">
                      {n.fontes.length > 0
                        ? `REVISADA · ${n.fontes.length} FONTE(S)`
                        : "RASCUNHO DO COFRE"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              Caderno de leitura. As marcadas como revisadas foram conferidas e têm
              fonte; as outras seguem como vieram do cofre, sem revisão.
            </p>
          </section>
        )}

        {fontes.length > 0 && (
          /*
            Fecha a página como o memorial fecha a dele: régua em degradê,
            título grande em cinza e o bloco final apartado do resto. Aqui o
            lugar do "In Memoriam" é o das fontes, que é o que sustenta tudo
            acima.
          */
          <section className="mt-24 md:mt-32">
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
          </section>
        )}

        {/*
          Atravessar o país lendo. Sem isto, ler a China inteira exigiria
          voltar ao índice dezesseis vezes.
        */}
        <nav className="mt-24 flex items-stretch justify-between gap-4 border-t border-zinc-800 pt-6">
          {anterior ? (
            <Link
              href={`/pais/${pais.iso}/${anterior.id}`}
              className="group max-w-[45%] text-left"
            >
              <span className="block font-mono text-[10px] tracking-widest text-zinc-600">
                ← ANTERIOR
              </span>
              <span className="font-serif text-lg text-zinc-300 group-hover:text-amber-500">
                {anterior.rotulo}
              </span>
            </Link>
          ) : (
            <span />
          )}

          {proximo && (
            <Link
              href={`/pais/${pais.iso}/${proximo.id}`}
              className="group max-w-[45%] text-right"
            >
              <span className="block font-mono text-[10px] tracking-widest text-zinc-600">
                SEGUINTE →
              </span>
              <span className="font-serif text-lg text-zinc-300 group-hover:text-amber-500">
                {proximo.rotulo}
              </span>
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
