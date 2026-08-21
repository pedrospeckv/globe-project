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
          {/*
            Sem contagem de acervo no subtítulo.
            
            "9 PAÍSES" media o que falta, não o que existe: a meta é o globo
            inteiro, ou ao menos os países que importam, e um contador que anda de
            9 para 10 anuncia a lacuna em vez do conteúdo. O mapa já mostra o
            mundo todo; o que o atlas cobre com dossiê se vê ao clicar.
          */}
          <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/70">
            HISTÓRIA E GEOGRAFIA, POR PAÍS E POR PERÍODO
          </p>
        </header>

        <Atlas
          mundo={mundo}
          paises={acervo.paises}
          viagens={acervo.viagens}
          eventos={acervo.eventos}
          ilhas={acervo.ilhas}
          nacoes={acervo.nacoes}
          fontes={acervo.fontes}
        />
      </div>
    </main>
  );
}
