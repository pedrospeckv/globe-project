import path from "node:path";
import Link from "next/link";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";
import { Estante } from "@/components/conteudo/Estante";
import { livros } from "@/lib/conteudo/nota";

const RAIZ = path.join(process.cwd(), "conteudo");

export const metadata = {
  title: "Biblioteca",
  description: "Os livros de história lidos, e a nota de leitura de cada um.",
};

/**
 * A estante inteira, num lugar só.
 *
 * A ala do dossiê só mostra o que o país tem, e é assim que deve ser. Mas o
 * atlas cobre nove países e os livros são sobre Grécia, Roma, Egito e Itália —
 * nenhum deles no atlas. Cinco dos sete livros não aparecem em dossiê nenhum,
 * e sem esta página seriam conteúdo publicado sem caminho até ele.
 *
 * A ordem é de leitura, do mais recente para o mais antigo, porque é a única
 * ordem que o acervo realmente conhece: `terminadoEm` vem do cofre.
 */
export default async function BibliotecaPage() {
  const acervo = await carregarAcervo(RAIZ);
  const alvos = indexarAlvos(acervo);
  const estante = livros(acervo.notas);

  const paginas = estante.reduce((n, x) => n + (x.livro?.paginas ?? 0), 0);
  const semDossie = estante.filter((n) => n.alvos.length === 0);

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8 px-4">
        <Link href="/" className="font-mono text-xs text-sky-400 hover:underline">
          ← globo
        </Link>

        <header>
          <h1 className="font-serif text-4xl tracking-tight">Biblioteca</h1>
          <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/70">
            {estante.length} LIVROS
            {paginas > 0 && ` · ${paginas.toLocaleString("pt-BR")} PÁGINAS`}
          </p>
        </header>

        <Estante notas={estante} titulo="Lido" />

        {/*
          A lista repete a estante em texto, e não é redundância: a estante é
          uma fila de capas com rolagem lateral, e uma fila não diz a que país
          cada livro se liga nem quando foi lido. Quem chega procurando um
          título quer a lista; quem chega olhando quer a estante.
        */}
        <section className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">
            Por leitura
          </h2>
          <ul className="space-y-2">
            {estante.map((n) => {
              const l = n.livro!;
              return (
                <li
                  key={n.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-serif text-sm text-slate-100">
                      <Link href={`/nota/${n.id}`} className="hover:text-amber-500">
                        {l.titulo}
                      </Link>
                    </h3>
                    {l.terminadoEm && (
                      <span className="shrink-0 font-mono text-[10px] tracking-widest text-amber-500/60">
                        LIDO {l.terminadoEm}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                    {l.autor}
                    {l.editora && ` · ${l.editora}`}
                    {l.paginas && ` · ${l.paginas}p`}
                  </p>
                  {n.alvos.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      {n.alvos.map((a) => {
                        const alvo = alvos[a];
                        if (!alvo) return null;
                        return (
                          <Link
                            key={a}
                            href={alvo.href}
                            className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-sky-400 hover:border-sky-400/50"
                          >
                            {alvo.rotulo}
                          </Link>
                        );
                      })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {semDossie.length > 0 && (
          /*
            Dito na página em vez de escondido. O atlas tem nove países, e a
            maior parte da leitura é sobre lugares que ele ainda não cobre —
            Grécia, Roma, Egito, Itália. Um leitor que percebe que "Os Gregos"
            não abre de nenhum dossiê merece saber que é cobertura faltando, e
            não vínculo perdido.
          */
          <aside className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4">
            <p className="text-xs leading-relaxed text-slate-400">
              <strong className="font-semibold text-slate-200">
                {semDossie.length} destes livros não abrem de nenhum dossiê.
              </strong>{" "}
              São sobre Grécia, Roma, Egito e Itália, e o atlas cobre nove países
              — nenhum deles entre esses. A ligação vai existir quando a
              cobertura chegar lá; até então a leitura mora só aqui.
            </p>
          </aside>
        )}
      </div>
    </main>
  );
}
