import path from "node:path";
import { Atlas } from "@/components/atlas/Atlas";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { carregarMundo } from "@/lib/geo/mundo";

export default async function Home() {
  const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));
  const mundo = await carregarMundo();

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4">
        <header className="text-center">
          <h1 className="font-serif text-4xl tracking-tight">Atlas</h1>
          <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/70">
            {acervo.paises.length} PAÍSES · {acervo.viagens.length} VIAGENS
          </p>
        </header>

        <Atlas mundo={mundo} paises={acervo.paises} viagens={acervo.viagens} />
      </div>
    </main>
  );
}
