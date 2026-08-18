import path from "node:path";
import { Atlas } from "@/components/atlas/Atlas";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { carregarMundo } from "@/lib/geo/mundo";

export default async function Home() {
  const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));
  const mundo = await carregarMundo();

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      {/*
        Largo o bastante para o mapa crescer: é o tamanho do mapa que decide
        quantos nomes de país cabem escritos nele. A prosa não estica junto —
        cada bloco de texto do Atlas carrega o seu próprio `max-w`.
      */}
      <div className="mx-auto flex max-w-[1700px] flex-col items-center gap-6 px-4">
        <header className="text-center">
          <h1 className="font-serif text-4xl tracking-tight">Atlas</h1>
          <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/70">
            {acervo.paises.length} PAÍSES · {acervo.eventos.length} EVENTOS ·{" "}
            {acervo.ilhas.length} ILHAS
          </p>
        </header>

        <Atlas
          mundo={mundo}
          paises={acervo.paises}
          viagens={acervo.viagens}
          eventos={acervo.eventos}
          ilhas={acervo.ilhas}
          fontes={acervo.fontes}
        />
      </div>
    </main>
  );
}
