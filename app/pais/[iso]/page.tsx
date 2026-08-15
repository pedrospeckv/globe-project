import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";
import { Prosa } from "@/components/conteudo/Prosa";
import { IndicadorChart } from "@/components/conteudo/IndicadorChart";
import { eventosDoPais } from "@/lib/conteudo/evento";
import { rotuloDeData } from "@/lib/conteudo/tempo";
import { resumoDe } from "@/lib/conteudo/pais";
import { DISPUTAS, paisesDaDisputa } from "@/lib/geo/disputas";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.paises.map((p) => ({ iso: p.iso }));
}

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

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8 px-4">
        <Link href="/" className="font-mono text-xs text-sky-400 hover:underline">
          ← globo
        </Link>

        <header>
          <h1 className="font-serif text-4xl tracking-tight">{pais.nome}</h1>
          <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/70">
            {pais.periodos.length} PERÍODOS
            {figuras.length > 0 && ` · ${figuras.length} FIGURAS`}
          </p>
        </header>

        {/*
          Índice, não texto corrido. Empilhar a prosa inteira funcionava com
          resumos de setecentos caracteres; com o Brasil escrito a fundo a
          página passou de sete mil pixels de rolagem, sem âncora e sem como
          apontar para um período específico.
        */}
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Períodos</h2>
          {pais.periodos.map((p) => (
            <article
              key={p.id}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-100">
                  <Link
                    href={`/pais/${pais.iso}/${p.id}`}
                    className="hover:text-sky-400 hover:underline"
                  >
                    {p.rotulo}
                  </Link>
                </h3>
                <span className="shrink-0 font-mono text-xs text-amber-500">
                  {rotuloDeData(p.inicio)}
                  {p.fim ? `–${rotuloDeData(p.fim)}` : "–"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{p.regime}</p>

              <Prosa texto={resumoDe(p)} alvos={alvos} />

              <p className="mt-2 flex items-center gap-2 text-xs">
                <Link
                  href={`/pais/${pais.iso}/${p.id}`}
                  className="text-sky-400 hover:underline"
                >
                  ler o período →
                </Link>
                {p.entidades.length >= 2 && (
                  <span className="text-[10px] text-slate-600">
                    · {p.entidades.length} Estados neste território
                  </span>
                )}
              </p>
            </article>
          ))}
        </section>

        {disputas.length > 0 && (
          /*
             A nota vive em lib/geo/disputas.ts, uma fonte só: é a mesma que
             o mapa usa para hachurar. Reescrevê-la aqui abriria espaço para
             a página e o mapa divergirem sobre o que está em disputa.
          */
          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">
              Territórios de soberania disputada
            </h2>
            {disputas.map((d) => (
              <article
                key={d.id}
                className="rounded-lg border border-amber-900/40 bg-amber-950/10 p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold text-amber-200">{d.nome}</h3>
                  <span className="shrink-0 font-mono text-xs text-amber-500">
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
                  <p className="mt-2 text-[11px] leading-relaxed text-amber-500/80">
                    Administrado por{" "}
                    {[...d.paises, ...(d.forasteiros ?? [])].join(", ")}. A base
                    cartográfica não separa este território em polígono próprio, então
                    o mapa o marca com um alfinete e não com uma área.
                  </p>
                )}
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{d.nota}</p>
              </article>
            ))}
          </section>
        )}

        {eventos.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">Eventos</h2>
            <ol className="space-y-2">
              {eventos.map((e) => (
                <li
                  key={e.id}
                  className="rounded border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-slate-100">
                      {e.titulo}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-rose-400">
                      {rotuloDeData(e.data)}
                    </span>
                  </div>
                  {e.paises.length > 1 && (
                    <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                      também: {e.paises.filter((p) => p !== iso).join(", ")}
                    </p>
                  )}
                  <Prosa texto={e.textoMdx} alvos={alvos} />
                </li>
              ))}
            </ol>
          </section>
        )}

        {figuras.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">Figuras</h2>
            <ul className="space-y-1">
              {figuras.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/figura/${f.id}`}
                    className="text-sm text-sky-400 hover:underline"
                  >
                    {f.nome}
                  </Link>
                  <span className="ml-2 text-xs text-slate-600">
                    {f.alegacoes.length > 0
                      ? `${f.alegacoes.length} alegação(ões)`
                      : "sem alegações"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {indicadores.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">
              Indicadores
            </h2>
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
