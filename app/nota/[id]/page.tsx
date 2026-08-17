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
  const fontes = acervo.fontes.filter((f) => nota.fontes.includes(f.id));
  const revisada = fontes.length > 0;

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
          O aviso é a peça central desta página, não enfeite — e agora existe
          em duas versões porque o acervo está no meio de uma migração.

          As notas nasceram como rascunho do cofre e a página dizia isso: "sem
          revisão e sem fonte". A decisão foi revisá-las e dar lastro, uma a
          uma. Enquanto isso não termina, as duas espécies convivem, e um
          aviso único mentiria sobre metade delas em qualquer das redações.
          Quem decide qual aparece é o próprio dado: nota com fonte foi
          revisada, nota sem fonte ainda é o que veio do cofre.

          `coberturaDeNotas` conta as que faltam a cada `pnpm validar`.
        */}
        <aside className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4">
          {revisada ? (
            <p className="text-xs leading-relaxed text-slate-400">
              <strong className="font-semibold text-slate-200">
                Isto nasceu como anotação de leitura e passou por revisão.
              </strong>{" "}
              O texto foi conferido e as afirmações têm fonte declarada no fim da
              página. Continua sendo uma leitura sobre um assunto, e não a
              unidade do atlas, que é país × período — por isso mora aqui e não
              num dossiê.
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-slate-400">
              <strong className="font-semibold text-slate-200">
                Isto é anotação pessoal de estudo, ainda sem revisão.
              </strong>{" "}
              Foi escrita para uso próprio, sem fonte, e pode conter erro ou
              simplificação. Está na fila para ser conferida e ganhar lastro,
              como as demais desta seção. O conteúdo do atlas — os períodos, as
              figuras e as alegações — nunca dependeu disso: lá, afirmação
              contestada só existe com fonte e status processual declarados.
            </p>
          )}
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

        {/* Mesma apresentação do período: o lastro aparece na página, não só no arquivo. */}
        {fontes.length > 0 && (
          <section className="border-t border-slate-800 pt-4">
            <h2 className="mb-2 text-[10px] uppercase tracking-wide text-slate-600">
              {fontes.length === 1 ? "Fonte" : "Fontes"}
            </h2>
            <ul className="space-y-1.5">
              {fontes.map((f) => (
                <li key={f.id} className="text-xs leading-relaxed text-slate-400">
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
                    <span className="text-slate-300">{f.titulo}</span>
                  )}
                  {f.autor && <span className="text-slate-600"> · {f.autor}</span>}
                  {f.publicacao && (
                    <span className="text-slate-600"> · {f.publicacao}</span>
                  )}
                  {f.data && (
                    <span className="text-slate-600"> · {rotuloDeData(f.data)}</span>
                  )}
                  {f.citacao && (
                    <p className="mt-0.5 text-[11px] text-slate-500">{f.citacao}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
