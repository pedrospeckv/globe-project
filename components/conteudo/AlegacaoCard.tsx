import { StatusBadge } from "./StatusBadge";
import type { Alegacao } from "@/lib/conteudo/alegacao";
import type { Fonte } from "@/lib/conteudo/fonte";

/**
 * Uma alegação e o que a sustenta.
 *
 * A lista de fontes NUNCA fica vazia: o schema exige ao menos uma e a
 * integridade referencial garante que os ids existem. É a promessa editorial
 * do projeto tornada mecânica.
 */
export function AlegacaoCard({
  alegacao,
  fontes,
}: {
  alegacao: Alegacao;
  fontes: Fonte[];
}) {
  const citadas = fontes.filter((f) => alegacao.fontes.includes(f.id));

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-slate-100">
          {alegacao.enunciado}
        </h3>
        <StatusBadge status={alegacao.status} />
      </header>

      {alegacao.data && (
        <p className="mt-1 font-mono text-[11px] text-slate-500">{alegacao.data}</p>
      )}

      {alegacao.nota && (
        <p className="mt-2 border-l-2 border-slate-700 pl-3 text-xs leading-relaxed text-slate-400">
          {alegacao.nota}
        </p>
      )}

      <footer className="mt-3 border-t border-slate-800 pt-2">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-600">
          {citadas.length === 1 ? "Fonte" : "Fontes"}
        </p>
        <ul className="space-y-1">
          {citadas.map((f) => (
            <li key={f.id} className="text-xs text-slate-400">
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  {f.titulo}
                </a>
              ) : (
                f.titulo
              )}
              {f.autor && <span className="text-slate-600"> · {f.autor}</span>}
              {f.publicacao && <span className="text-slate-600"> · {f.publicacao}</span>}
              {f.data && <span className="text-slate-600"> · {f.data}</span>}
            </li>
          ))}
        </ul>
      </footer>
    </article>
  );
}
