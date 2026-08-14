import path from "node:path";
import Link from "next/link";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";

const RAIZ = path.join(process.cwd(), "conteudo");

export default async function NotasPage() {
  const acervo = await carregarAcervo(RAIZ);
  const alvos = indexarAlvos(acervo);

  const porPasta = new Map<string, typeof acervo.notas>();
  for (const n of [...acervo.notas].sort((a, b) =>
    a.titulo.localeCompare(b.titulo, "pt-BR")
  )) {
    porPasta.set(n.pasta, [...(porPasta.get(n.pasta) ?? []), n]);
  }

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6 px-4">
        <Link href="/" className="font-mono text-xs text-sky-400 hover:underline">
          ← globo
        </Link>

        <header>
          <h1 className="font-serif text-4xl tracking-tight">Anotações</h1>
          <p className="mt-1 font-mono text-xs tracking-widest text-slate-500">
            {acervo.notas.length} NOTAS
          </p>
        </header>

        <aside className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4">
          <p className="text-xs leading-relaxed text-slate-400">
            Cadernos de estudo importados do Obsidian, publicados como estão:{" "}
            <strong className="font-semibold text-slate-200">
              sem revisão, sem fonte e sem a garantia editorial do resto do atlas
            </strong>
            . São o material bruto de onde parte do conteúdo do atlas nasce, e não
            o conteúdo em si.
          </p>
        </aside>

        {[...porPasta.entries()].map(([pasta, notas]) => (
          <section key={pasta} className="space-y-2">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">{pasta}</h2>
            <ul className="space-y-1.5">
              {notas.map((n) => (
                <li key={n.id} className="flex flex-wrap items-baseline gap-2">
                  <Link
                    href={`/nota/${n.id}`}
                    className="text-sm text-sky-400 hover:underline"
                  >
                    {n.titulo}
                  </Link>
                  {n.alvos.length > 0 && (
                    <span className="text-[10px] text-slate-600">
                      {n.alvos
                        .map((a) => alvos[a]?.rotulo)
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
