import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { Prosa } from "@/components/conteudo/Prosa";
import { IndicadorChart } from "@/components/conteudo/IndicadorChart";
import { eventosDoPais } from "@/lib/conteudo/evento";

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
  const pais = acervo.paises.find((p) => p.iso === iso);
  if (!pais) notFound();

  const figuras = acervo.figuras.filter((f) => f.paisIso === iso);
  const indicadores = acervo.indicadores.filter((i) => i.paisIso === iso);
  const eventos = eventosDoPais(acervo.eventos, iso);

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

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Períodos</h2>
          {pais.periodos.map((p) => (
            <article
              key={p.id}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-100">{p.rotulo}</h3>
                <span className="shrink-0 font-mono text-xs text-amber-500">
                  {p.inicio}
                  {p.fim ? `–${p.fim}` : "–"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{p.regime}</p>
              <Prosa texto={p.textoMdx} />

              {p.entidades.length >= 2 && (
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-600">
                    {p.entidades.length} Estados neste território
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {p.entidades.map((e) => (
                      <div
                        key={e.nome}
                        className="rounded border border-slate-800 bg-slate-950/60 p-3"
                      >
                        <p className="text-xs font-semibold text-slate-200">{e.nome}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{e.regime}</p>
                        <Prosa texto={e.textoMdx} />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
                    O mapa desenha este território como uma forma só. A fronteira entre
                    estes Estados exigiria geometria histórica, que o atlas ainda não
                    tem — por isso o país aparece hachurado no globo neste período.
                  </p>
                </div>
              )}
            </article>
          ))}
        </section>

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
                      {e.data}
                    </span>
                  </div>
                  {e.paises.length > 1 && (
                    <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                      também: {e.paises.filter((p) => p !== iso).join(", ")}
                    </p>
                  )}
                  <Prosa texto={e.textoMdx} />
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
