import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";
import { AlegacaoCard } from "@/components/conteudo/AlegacaoCard";
import { Prosa } from "@/components/conteudo/Prosa";
import { rotuloDeData } from "@/lib/conteudo/tempo";
import { notasDoAlvo } from "@/lib/conteudo/nota";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.figuras.map((f) => ({ id: f.id }));
}

// Next 16: params é Promise e precisa de await.
export default async function FiguraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const acervo = await carregarAcervo(RAIZ);
  const alvos = indexarAlvos(acervo);
  const figura = acervo.figuras.find((f) => f.id === id);
  if (!figura) notFound();

  const pais = acervo.paises.find((p) => p.iso === figura.paisIso);
  const notas = notasDoAlvo(acervo.notas, figura.id);

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8 px-4">
        <Link
          href={pais ? `/pais/${pais.iso}` : "/"}
          className="font-mono text-xs text-sky-400 hover:underline"
        >
          ← {pais ? pais.nome : "globo"}
        </Link>

        <header>
          <h1 className="font-serif text-4xl tracking-tight">{figura.nome}</h1>
          {pais && (
            <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/70">
              {pais.nome.toUpperCase()}
            </p>
          )}
          <Prosa texto={figura.textoMdx} alvos={alvos} />
        </header>

        {figura.cargos.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">Cargos</h2>
            <ul className="space-y-1">
              {figura.cargos.map((c, i) => (
                <li
                  key={`${c.titulo}-${c.inicio}-${i}`}
                  className="flex items-baseline justify-between gap-3 border-b border-slate-800 pb-1 text-sm"
                >
                  <span className="text-slate-200">{c.titulo}</span>
                  <span className="shrink-0 font-mono text-xs text-amber-500">
                    {rotuloDeData(c.inicio)}
                    {c.fim ? `–${rotuloDeData(c.fim)}` : "–"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Alegações</h2>

          {figura.alegacoes.length === 0 ? (
            /*
             * O vazio é declarado, não omitido. Uma seção ausente lê como
             * esquecimento; esta frase diz que a ausência é a regra do
             * projeto operando.
             */
            <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs leading-relaxed text-slate-500">
              Nenhuma alegação registrada. Alegações só entram acompanhadas de fonte
              verificada e de um status processual explícito — sem isso, o conteúdo
              não passa na validação e o site não publica.
            </p>
          ) : (
            figura.alegacoes.map((a) => (
              <AlegacaoCard key={a.id} alegacao={a} fontes={acervo.fontes} />
            ))
          )}
        </section>

        {notas.length > 0 && (
          /*
            Aponta para a nota, nunca inclui o texto dela. Misturar as duas
            camadas apagaria a diferença entre o que tem lastro e o que é
            rascunho de estudo — que é a diferença que o atlas existe para
            manter.
          */
          <section className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">
              Anotações pessoais
            </h2>
            <ul className="space-y-1">
              {notas.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/nota/${n.id}`}
                    className="text-sm text-slate-300 hover:text-sky-400 hover:underline"
                  >
                    {n.titulo}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-[10px] leading-relaxed text-slate-600">
              Caderno de estudo, sem revisão e sem fonte. Não é conteúdo do atlas.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
