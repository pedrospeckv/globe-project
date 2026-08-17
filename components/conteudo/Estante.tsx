import Link from "next/link";
import { resumoDaNota, type Nota } from "@/lib/conteudo/nota";

/**
 * A ala de livros — os livros lidos sobre aquele assunto.
 *
 * A forma vem do template do arquivo histórico de Bangladesh: grade de
 * cartões, capa em cima, título, autor e ano, etiqueta de categoria, resumo
 * cortado em três linhas e um botão de largura cheia no pé. A paleta vem do
 * memorial da Segunda Guerra: fundo zinc, serifa de display, mono para
 * metadado, amber como único acento.
 *
 * Os dois templates têm fundo oposto — o de Bangladesh é claro, o memorial é
 * escuro. O atlas é escuro e já escreve em serifa com metadado em mono e datas
 * em amber, então o memorial é a base natural e o de Bangladesh entra como
 * estrutura do cartão dentro dela. Misturar cartão claro em página escura não
 * seria "igual aos dois": seria quebrado.
 *
 * `<img>` e não `next/image` de propósito — `next.config.ts` não declara
 * `remotePatterns` para books.google.com, e otimizar capa de 15 KB não paga a
 * configuração.
 */
export function Estante({
  notas,
  titulo = "Livros",
  subtitulo,
}: {
  notas: Nota[];
  titulo?: string;
  subtitulo?: string;
}) {
  if (notas.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-1 border-b border-zinc-800 pb-4">
        <h2 className="font-serif text-3xl leading-tight tracking-tight text-zinc-50 md:text-4xl">
          {titulo}
        </h2>
        <p className="font-mono text-xs tracking-widest text-amber-500/80">
          {notas.length === 1 ? "1 LIVRO" : `${notas.length} LIVROS`}
          {subtitulo && ` — ${subtitulo}`}
        </p>
      </div>

      {/*
        A grade do template original vai a quatro colunas. Aqui para em duas: a
        página do dossiê é `max-w-3xl`, e um país costuma ter um ou dois livros.
        Quatro trilhas com um cartão dentro deixariam três buracos.
      */}
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {notas.map((n) => {
          const l = n.livro!;
          const ano = l.publicado?.slice(0, 4);
          return (
            <li
              key={n.id}
              className="group flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60 transition-all duration-500 hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/10"
            >
              {/*
                Caixa de capa com proporção fixa. A primeira versão usava
                largura natural, e a estante saía vazia: imagem que ainda não
                carregou não tem dimensão intrínseca, a largura resolvia para
                zero, e elemento de área zero nunca entra no viewport aos olhos
                do `loading="lazy"`. A capa esperava uma largura que dependia da
                capa. Reservar a caixa quebra o ciclo e ainda tira o salto de
                layout quando as capas chegam fora de ordem.
              */}
              <div className="flex items-center justify-center bg-zinc-950/60 px-6 pt-6 pb-4">
                <div className="relative aspect-[2/3] w-32 overflow-hidden rounded shadow-xl shadow-black/70 ring-1 ring-zinc-700/60 transition-transform duration-700 group-hover:scale-105">
                  {l.capa ? (
                    <img
                      src={l.capa}
                      alt={`Capa de ${l.titulo}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-900 p-3">
                      <span className="font-serif text-sm leading-tight text-zinc-400">
                        {l.titulo}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="space-y-1">
                  <h3 className="font-serif text-xl leading-tight tracking-tight text-zinc-50 transition-colors duration-300 group-hover:text-amber-500/90">
                    {l.titulo}
                  </h3>
                  <p className="font-mono text-xs tracking-wide text-zinc-500">
                    {l.autor}
                    {ano && ` · ${ano}`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-zinc-700 bg-zinc-800/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    {n.pasta}
                  </span>
                  {l.paginas && (
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-0.5 font-mono text-[10px] tracking-wider text-amber-500/70">
                      {l.paginas} páginas
                    </span>
                  )}
                </div>

                <p className="line-clamp-3 text-sm leading-relaxed text-zinc-400">
                  {resumoDaNota(n)}
                </p>

                <Link
                  href={`/nota/${n.id}`}
                  className="mt-auto rounded-md border border-zinc-700 px-3 py-2 text-center font-mono text-xs tracking-wide text-zinc-300 transition-colors duration-300 hover:border-amber-500/40 hover:text-amber-500"
                >
                  ler a nota →
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
