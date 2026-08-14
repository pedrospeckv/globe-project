import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { Prosa } from "@/components/conteudo/Prosa";
import { IndicadorChart } from "@/components/conteudo/IndicadorChart";

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
            </article>
          ))}
        </section>

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
