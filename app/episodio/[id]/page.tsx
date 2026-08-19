import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";
import { Prosa } from "@/components/conteudo/Prosa";
import { BlocoNarrado } from "@/components/conteudo/BlocoNarrado";
import { imagensDe } from "@/lib/conteudo/episodio";
import { rotuloDeData } from "@/lib/conteudo/tempo";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.episodios.map((e) => ({ id: e.id }));
}

/**
 * O episódio por dentro: o trilho do memorial da Segunda Guerra, agora com a
 * foto de época em cada parada e paralaxe na rolagem.
 *
 * É a mesma régua vertical em degradê do país e do período — descer do país
 * para o episódio não troca de linguagem, só de assunto. O que muda é o peso
 * da imagem: no período ela é acessório de um evento; aqui ela é metade do
 * argumento, porque o episódio existe para mostrar o que o mapa não desenha.
 */
// Next 16: params é Promise e precisa de await.
export default async function EpisodioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const acervo = await carregarAcervo(RAIZ);
  const alvos = indexarAlvos(acervo);

  const episodio = acervo.episodios.find((e) => e.id === id);
  if (!episodio) notFound();

  const fontes = acervo.fontes.filter((f) => episodio.fontes.includes(f.id));
  const paises = episodio.paises
    .map((iso) => acervo.paises.find((p) => p.iso === iso))
    .filter((p) => p !== undefined);

  const intervalo = `${rotuloDeData(episodio.inicio)}–${
    episodio.fim ? rotuloDeData(episodio.fim) : ""
  }`;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-20">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {paises.map((p) => (
            <Link
              key={p.iso}
              href={`/pais/${p.iso}`}
              className="font-mono text-xs tracking-wider text-zinc-500 transition-colors hover:text-amber-500"
            >
              ← {p.nome}
            </Link>
          ))}
        </div>

        <header className="mt-8 mb-14 md:mb-20">
          <p className="font-mono text-[10px] tracking-[0.2em] text-zinc-600">
            EPISÓDIO
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-none tracking-tight text-zinc-50 md:text-6xl">
            {episodio.titulo}
          </h1>
          <p className="mt-4 font-mono text-sm tracking-wider text-amber-500/80 md:text-base">
            {intervalo}
          </p>
          {episodio.subtitulo && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
              {episodio.subtitulo}
            </p>
          )}
        </header>

        <article className="mb-16 max-w-3xl text-lg text-zinc-300 md:mb-24">
          <Prosa texto={episodio.abertura} alvos={alvos} />
        </article>

        <section className="mb-16 md:mb-24">
          <div className="mb-10 border-b border-zinc-800 pb-4">
            <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
              Como aconteceu
            </h2>
            <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/80">
              {episodio.blocos.length} MOMENTOS · {imagensDe(episodio)} IMAGENS
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/20 via-amber-500/40 to-amber-500/20 md:left-[120px]" />

            <ol className="space-y-20 md:space-y-28">
              {episodio.blocos.map((b) => (
                <BlocoNarrado
                  key={b.id}
                  bloco={b}
                  alvos={alvos}
                  rotulo={b.rotulo ?? rotuloDeData(b.data)}
                />
              ))}
            </ol>
          </div>
        </section>

        {episodio.fecho && (
          /*
            O lugar que o memorial reserva ao "In Memoriam". Aqui é onde o
            episódio diz o que ficou em aberto — e é de propósito que venha
            depois de tudo, e não no alto: a ressalva pesa mais quando o leitor
            já viu o que ela ressalva.
          */
          <section className="mt-24 md:mt-32">
            <div className="mb-10 h-px bg-gradient-to-r from-zinc-800 to-transparent" />
            <div className="max-w-3xl border-l-2 border-zinc-800 pl-6 text-lg font-light text-zinc-400">
              <Prosa texto={episodio.fecho} alvos={alvos} />
            </div>
          </section>
        )}

        <section className="mt-20 md:mt-24">
          <div className="mb-10 h-px bg-gradient-to-r from-zinc-800 to-transparent" />
          <h2 className="font-serif text-3xl leading-tight tracking-tight text-zinc-400 md:text-4xl">
            {fontes.length === 1 ? "Fonte" : "Fontes"}
          </h2>
          <ul className="mt-8 space-y-5">
            {fontes.map((f) => (
              <li key={f.id} className="border-l-2 border-zinc-800 pl-5">
                <p className="text-sm leading-relaxed">
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-500/80 hover:text-amber-500 hover:underline"
                    >
                      {f.titulo}
                    </a>
                  ) : (
                    <span className="text-zinc-300">{f.titulo}</span>
                  )}
                </p>
                <p className="mt-1 font-mono text-[10px] tracking-wide text-zinc-600">
                  {[f.autor, f.publicacao, f.data && rotuloDeData(f.data)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {f.citacao && (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    {f.citacao}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/*
          As imagens são de acervo público e cada uma carrega crédito e licença
          embaixo de si. Este parágrafo diz a regra uma vez, para quem chegou
          pela página e não pela legenda.
        */}
        <p className="mt-16 max-w-3xl text-xs leading-relaxed text-zinc-600">
          As imagens vêm do Wikimedia Commons, cada uma com o crédito e a licença
          declarados na própria legenda. Pintura e gravura de época retratam o que
          o autor quis mostrar a quem o pagava — são documento do olhar, não
          fotografia do fato.
        </p>
      </div>
    </main>
  );
}
