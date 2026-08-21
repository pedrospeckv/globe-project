import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";
import { Prosa } from "@/components/conteudo/Prosa";
import { ROTULO_COMPETENCIA } from "@/lib/conteudo/nacao";
import { imagensDe } from "@/lib/conteudo/episodio";
import { rotuloDeData } from "@/lib/conteudo/tempo";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.nacoes.map((n) => ({ id: n.id }));
}

/**
 * A nação por dentro.
 *
 * A página é curta de propósito, e a ordem dela é o argumento: nome, o
 * instrumento que a reconhece, a casa que ela tem, e só então a porta para o
 * episódio onde a história está contada. Não é ficha de país encurtada — é o
 * inverso, uma entrada que existe para responder "por que esta está aqui" antes
 * de contar qualquer coisa.
 *
 * Por isso o reconhecimento vem ANTES da prosa e em destaque, e não no rodapé
 * junto das fontes. Num atlas que recusa Catalunha e Tibete, quem entra deve a
 * quem lê a exibição imediata do critério pelo qual entrou.
 */
// Next 16: params é Promise e precisa de await.
export default async function NacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const acervo = await carregarAcervo(RAIZ);
  const alvos = indexarAlvos(acervo);

  const nacao = acervo.nacoes.find((n) => n.id === id);
  if (!nacao) notFound();

  const anfitriao = acervo.paises.find((p) => p.iso === nacao.anfitriao);
  const episodios = acervo.episodios.filter((e) =>
    nacao.episodios.includes(e.id)
  );
  const periodos = (anfitriao?.periodos ?? []).filter((p) =>
    nacao.periodos.includes(p.id)
  );
  const fontes = acervo.fontes.filter((f) =>
    [...nacao.fontes, ...nacao.reconhecimento.fontes].includes(f.id)
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-20">
        {anfitriao && (
          <Link
            href={`/pais/${anfitriao.iso}`}
            className="font-mono text-xs tracking-wider text-zinc-500 transition-colors hover:text-amber-500"
          >
            ← {anfitriao.nome}
          </Link>
        )}

        <header className="mt-8 mb-14 md:mb-20">
          <p className="font-mono text-[10px] tracking-[0.2em] text-zinc-600">
            NAÇÃO
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-none tracking-tight text-zinc-50 md:text-6xl">
            {nacao.nome}
          </h1>
          {nacao.outrosNomes.length > 0 && (
            <p className="mt-4 font-mono text-sm tracking-wider text-amber-500/80 md:text-base">
              {nacao.outrosNomes.join(" · ")}
            </p>
          )}
        </header>

        <article className="mb-16 max-w-3xl text-lg text-zinc-300 md:mb-24">
          <Prosa texto={nacao.abertura} alvos={alvos} />
        </article>

        {/*
          O critério, em destaque e não em nota de rodapé. Ver o cabeçalho.
        */}
        <section className="mb-16 md:mb-24">
          <div className="mb-10 border-b border-zinc-800 pb-4">
            <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
              Por que está no atlas
            </h2>
            <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/80">
              {nacao.reconhecimento.instrumento.toUpperCase()} ·{" "}
              {rotuloDeData(nacao.reconhecimento.data)}
            </p>
          </div>
          <div className="max-w-3xl border-l-2 border-zinc-800 pl-6 text-lg text-zinc-300">
            <Prosa texto={nacao.reconhecimento.textoMdx} alvos={alvos} />
          </div>
        </section>

        {nacao.legislatura && (
          <section className="mb-16 md:mb-24">
            <div className="mb-8 h-px bg-gradient-to-r from-zinc-800 to-transparent" />
            <h2 className="font-serif text-2xl tracking-tight text-zinc-400 md:text-3xl">
              {nacao.legislatura.nome}
            </h2>
            <p className="mt-2 font-mono text-xs tracking-widest text-amber-500/80">
              DESDE {rotuloDeData(nacao.legislatura.desde)} ·{" "}
              {ROTULO_COMPETENCIA[nacao.legislatura.competencia].toUpperCase()}
            </p>
            {nacao.legislatura.nota && (
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
                {nacao.legislatura.nota}
              </p>
            )}
          </section>
        )}

        {episodios.length > 0 && (
          <section className="mb-16 md:mb-24">
            <div className="mb-10 border-b border-zinc-800 pb-4">
              <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
                A história
              </h2>
            </div>
            <ul className="space-y-6">
              {episodios.map((e) => (
                <li key={e.id}>
                  <Link href={`/episodio/${e.id}`} className="group block">
                    <p className="font-serif text-2xl tracking-tight text-zinc-200 transition-colors group-hover:text-amber-500">
                      {e.titulo}
                    </p>
                    <p className="mt-1 font-mono text-xs tracking-widest text-zinc-600">
                      {`${rotuloDeData(e.inicio)}–${
                        e.fim ? rotuloDeData(e.fim) : ""
                      }`}{" · "}
                      {e.blocos.length} MOMENTOS · {imagensDe(e)} IMAGENS
                    </p>
                    {e.subtitulo && (
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                        {e.subtitulo}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {periodos.length > 0 && anfitriao && (
          <section className="mb-16 md:mb-24">
            <div className="mb-8 h-px bg-gradient-to-r from-zinc-800 to-transparent" />
            <h2 className="font-serif text-2xl tracking-tight text-zinc-400 md:text-3xl">
              Nos períodos de {anfitriao.nome}
            </h2>
            <ul className="mt-6 space-y-3">
              {periodos.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/pais/${anfitriao.iso}/${p.id}`}
                    className="group flex flex-wrap items-baseline gap-x-4"
                  >
                    <span className="font-mono text-xs tracking-widest text-zinc-600">
                      {`${rotuloDeData(p.inicio)}–${
                        p.fim ? rotuloDeData(p.fim) : ""
                      }`}
                    </span>
                    <span className="text-zinc-300 transition-colors group-hover:text-amber-500">
                      {p.rotulo}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
          A ressalva cartográfica. Ela pertence a esta página e não à do país
          porque é aqui que o leitor pode estranhar a ausência: a nação tem
          verbete, tem parlamento e tem alfinete, e mesmo assim não tem contorno
          no globo. Dizer por quê é mais honesto que deixar parecer descuido.
        */}
        <p className="mt-16 max-w-3xl text-xs leading-relaxed text-zinc-600">
          No globo, {nacao.nome} aparece como marcador e não como contorno. A base
          cartográfica que o atlas empacota desenha {anfitriao?.nome ?? "o país"} como
          uma feição só, e traçar a fronteira à mão seria inventar a linha — num projeto cujo
          assunto é justamente a fronteira, o marcador é a afirmação honesta
          disponível.
        </p>
      </div>
    </main>
  );
}
