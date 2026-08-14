import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { Prosa } from "@/components/conteudo/Prosa";
import { eventosDoPeriodo } from "@/lib/conteudo/evento";
import { figurasDoPeriodo } from "@/lib/conteudo/figura";
import { vizinhosDe } from "@/lib/conteudo/pais";
import { rotuloDeData } from "@/lib/conteudo/tempo";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.paises.flatMap((p) =>
    p.periodos.map((per) => ({ iso: p.iso, periodo: per.id }))
  );
}

// Next 16: params é Promise e precisa de await.
export default async function PeriodoPage({
  params,
}: {
  params: Promise<{ iso: string; periodo: string }>;
}) {
  const { iso, periodo: periodoId } = await params;
  const acervo = await carregarAcervo(RAIZ);

  const pais = acervo.paises.find((p) => p.iso === iso);
  if (!pais) notFound();

  const periodo = pais.periodos.find((p) => p.id === periodoId);
  if (!periodo) notFound();

  const eventos = eventosDoPeriodo(acervo.eventos, iso, periodo);
  const figuras = figurasDoPeriodo(acervo.figuras, iso, periodo);
  const { anterior, proximo } = vizinhosDe(pais, periodo.id);

  const intervalo = `${rotuloDeData(periodo.inicio)}${
    periodo.fim ? `–${rotuloDeData(periodo.fim)}` : "–"
  }`;

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-8 px-4">
        <Link
          href={`/pais/${pais.iso}`}
          className="font-mono text-xs text-sky-400 hover:underline"
        >
          ← {pais.nome}
        </Link>

        <header>
          <p className="font-mono text-xs tracking-widest text-amber-500">
            {intervalo}
          </p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">
            {periodo.rotulo}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{periodo.regime}</p>
        </header>

        <article>
          <Prosa texto={periodo.textoMdx} />
        </article>

        {periodo.entidades.length >= 2 && (
          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">
              {periodo.entidades.length} Estados neste território
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {periodo.entidades.map((e) => (
                <div
                  key={e.nome}
                  className="rounded border border-slate-800 bg-slate-900/60 p-3"
                >
                  <p className="text-xs font-semibold text-slate-200">{e.nome}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{e.regime}</p>
                  <Prosa texto={e.textoMdx} />
                </div>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-slate-600">
              O mapa desenha este território como uma forma só. A fronteira entre
              estes Estados exigiria geometria histórica, que o atlas ainda não tem —
              por isso o país aparece hachurado no globo neste período.
            </p>
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
                  <Prosa texto={e.textoMdx} />
                </li>
              ))}
            </ol>
          </section>
        )}

        {figuras.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">
              Figuras com cargo no período
            </h2>
            <ul className="space-y-1">
              {figuras.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/figura/${f.id}`}
                    className="text-sm text-sky-400 hover:underline"
                  >
                    {f.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/*
          Atravessar o país lendo. Sem isto, ler a China inteira exigiria
          voltar ao índice dezesseis vezes.
        */}
        <nav className="flex items-stretch justify-between gap-3 border-t border-slate-800 pt-4 text-xs">
          {anterior ? (
            <Link
              href={`/pais/${pais.iso}/${anterior.id}`}
              className="group max-w-[45%] text-left"
            >
              <span className="block text-[10px] uppercase tracking-wide text-slate-600">
                ← anterior
              </span>
              <span className="text-sky-400 group-hover:underline">
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
              <span className="block text-[10px] uppercase tracking-wide text-slate-600">
                seguinte →
              </span>
              <span className="text-sky-400 group-hover:underline">
                {proximo.rotulo}
              </span>
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
