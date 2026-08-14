import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";
import { Prosa } from "@/components/conteudo/Prosa";
import { rotuloDeData } from "@/lib/conteudo/tempo";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.notas.map((n) => ({ id: n.id }));
}

// Next 16: params é Promise e precisa de await.
export default async function NotaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const acervo = await carregarAcervo(RAIZ);
  const alvos = indexarAlvos(acervo);

  const nota = acervo.notas.find((n) => n.id === id);
  if (!nota) notFound();

  const ligados = nota.alvos.map((a) => alvos[a]).filter(Boolean);

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6 px-4">
        <Link href="/notas" className="font-mono text-xs text-sky-400 hover:underline">
          ← anotações
        </Link>

        <header>
          <p className="font-mono text-xs tracking-widest text-slate-500">
            {nota.pasta.toUpperCase()}
          </p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">{nota.titulo}</h1>
          <p className="mt-1 font-mono text-[11px] text-slate-600">
            última edição em {rotuloDeData(nota.atualizadaEm)}
          </p>
        </header>

        {/*
          O aviso é a peça central desta página, não enfeite. Todo o resto do
          atlas se sustenta em afirmação com fonte; esta parte não, e o leitor
          precisa saber disso ANTES de ler, não depois.
        */}
        <aside className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4">
          <p className="text-xs leading-relaxed text-slate-400">
            <strong className="font-semibold text-slate-200">
              Isto é anotação pessoal de estudo, não conteúdo do atlas.
            </strong>{" "}
            Foi escrita para uso próprio, sem revisão e sem fonte, e pode conter
            erro ou simplificação. O conteúdo do atlas — os períodos, as figuras e
            as alegações — segue outra regra: afirmação contestada só existe lá
            com fonte e status processual declarados. Estas duas camadas não se
            misturam de propósito.
          </p>
        </aside>

        {ligados.length > 0 && (
          <nav className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[10px] uppercase tracking-wide text-slate-600">
              no atlas
            </span>
            {ligados.map((a) => (
              <Link
                key={a.id}
                href={a.href}
                className="rounded border border-slate-700 px-2 py-1 text-sky-400 hover:bg-slate-800"
              >
                {a.rotulo}
              </Link>
            ))}
          </nav>
        )}

        <article className="border-t border-slate-800 pt-4">
          <Prosa texto={nota.corpo} alvos={alvos} />
        </article>
      </div>
    </main>
  );
}
