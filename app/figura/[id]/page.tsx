import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { indexarAlvos } from "@/lib/conteudo/ligacoes";
import { AlegacaoCard } from "@/components/conteudo/AlegacaoCard";
import { BlocoNarrado } from "@/components/conteudo/BlocoNarrado";
import { CabecalhoDeSecao } from "@/components/design/CabecalhoDeSecao";
import { Prosa } from "@/components/conteudo/Prosa";
import { imagensDaTrajetoria } from "@/lib/conteudo/figura";
import { rotuloDeData } from "@/lib/conteudo/tempo";
import { notasDoAlvo } from "@/lib/conteudo/nota";

const RAIZ = path.join(process.cwd(), "conteudo");

export async function generateStaticParams() {
  const acervo = await carregarAcervo(RAIZ);
  return acervo.figuras.map((f) => ({ id: f.id }));
}

/**
 * A pessoa por dentro, na linguagem do resto do atlas.
 *
 * Era a última tela na paleta antiga — fundo slate, links em sky, títulos do
 * tamanho do corpo —, e destoava justamente onde mais importa parecer o mesmo
 * lugar: quem chega aqui vem da central do país ou de um período.
 *
 * A ordem da página é uma decisão editorial, não de layout. **A trajetória vem
 * antes das alegações**, porque ler a acusação antes da vida transforma a
 * página em dossiê de acusação; e as alegações vêm antes das anotações, porque
 * são o que tem lastro obrigatório. O que é contestado nunca aparece dentro da
 * prosa: mora no cartão de alegação, com status processual e fonte.
 */
// Next 16: params é Promise e precisa de await.
export default async function FiguraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const acervo = await carregarAcervo(RAIZ);
  const alvos = indexarAlvos(acervo);
  const figura = acervo.figuras.find((f) => f.id === id);
  if (!figura) notFound();

  const pais = acervo.paises.find((p) => p.iso === figura.paisIso);
  const notas = notasDoAlvo(acervo.notas, figura.id);
  const fontes = acervo.fontes.filter((f) => figura.fontes.includes(f.id));

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-12 md:px-10 md:py-20">
        <Link
          href={pais ? `/pais/${pais.iso}` : "/"}
          className="font-mono text-xs tracking-wider text-zinc-500 transition-colors hover:text-amber-500"
        >
          ← {pais ? pais.nome : "globo"}
        </Link>

        <header className="mt-8 mb-14 md:mb-20">
          <p className="font-mono text-[10px] tracking-[0.2em] text-zinc-600">
            FIGURA
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-none tracking-tight text-zinc-50 md:text-6xl">
            {figura.nome}
          </h1>
          {pais && (
            <p className="mt-4 font-mono text-sm tracking-wider text-amber-500/80">
              {pais.nome.toUpperCase()}
            </p>
          )}
          {figura.textoMdx && (
            <div className="mt-3 max-w-2xl">
              <Prosa texto={figura.textoMdx} alvos={alvos} />
            </div>
          )}
        </header>

        {figura.cargos.length > 0 && (
          /*
            O trilho de cargos é o mesmo do memorial, em escala menor: a data à
            esquerda em mono, o cargo à direita. Cargo em curso termina no traço
            e não numa data — "hoje" num site estático envelhece sozinho.
          */
          <section className="mb-16 md:mb-20">
            <CabecalhoDeSecao
              titulo="Cargos"
              contador={`${figura.cargos.length} ${
                figura.cargos.length === 1 ? "REGISTRADO" : "REGISTRADOS"
              }`}
            />
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/20 via-amber-500/40 to-amber-500/20 md:left-[140px]" />
              <ol className="space-y-6">
                {figura.cargos.map((c, i) => (
                  <li key={`${c.titulo}-${c.inicio}-${i}`} className="group relative">
                    <div className="absolute left-[-3px] top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-500/20 transition-transform duration-300 group-hover:scale-150 md:left-[137px]" />
                    <div className="grid grid-cols-1 gap-1 pl-6 md:grid-cols-[140px_1fr] md:gap-10 md:pl-0">
                      <div className="md:pr-10 md:text-right">
                        <span className="font-mono text-sm font-bold tracking-tight text-amber-500">
                          {`${rotuloDeData(c.inicio)}–${c.fim ? rotuloDeData(c.fim) : ""}`}
                        </span>
                      </div>
                      <span className="font-serif text-lg text-zinc-50">
                        {c.titulo}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {figura.trajetoria.length > 0 && (
          /*
            O mesmo trilho do episódio, com a mesma paralaxe, porque é o mesmo
            objeto: uma sequência de momentos datados com imagem. Trocar de
            linguagem entre contar um território e contar uma pessoa faria a
            segunda parecer outra coisa que não o atlas.
          */
          <section className="mb-16 md:mb-24">
            <CabecalhoDeSecao
              titulo="Trajetória"
              contador={`${figura.trajetoria.length} MOMENTOS · ${imagensDaTrajetoria(
                figura
              )} IMAGENS`}
              className="mb-10"
            />
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/20 via-amber-500/40 to-amber-500/20 md:left-[120px]" />
              <ol className="space-y-20 md:space-y-28">
                {figura.trajetoria.map((b) => (
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
        )}

        <section className="mb-16 md:mb-20">
          <CabecalhoDeSecao
            titulo="Alegações"
            contador={
              figura.alegacoes.length > 0
                ? `${figura.alegacoes.length} COM FONTE E STATUS`
                : "NENHUMA REGISTRADA"
            }
          />

          {figura.alegacoes.length === 0 ? (
            /*
             * O vazio é declarado, não omitido. Uma seção ausente lê como
             * esquecimento; esta frase diz que a ausência é a regra do
             * projeto operando.
             */
            <p className="rounded-lg border border-dashed border-zinc-800 p-6 text-sm leading-relaxed text-zinc-500">
              Nenhuma alegação registrada. Alegações só entram acompanhadas de fonte
              verificada e de um status processual explícito — sem isso, o conteúdo
              não passa na validação e o site não publica. A ausência aqui não diz
              nada sobre a pessoa; diz que o atlas ainda não registrou nada com
              lastro.
            </p>
          ) : (
            <div className="space-y-3">
              {figura.alegacoes.map((a) => (
                <AlegacaoCard key={a.id} alegacao={a} fontes={acervo.fontes} />
              ))}
            </div>
          )}
        </section>

        {notas.length > 0 && (
          /*
            Aponta para a nota, nunca inclui o texto dela. Misturar as duas
            camadas apagaria a diferença entre o que tem lastro e o que é
            rascunho de estudo — que é a diferença que o atlas existe para
            manter.
          */
          <section className="mb-16 md:mb-20">
            <CabecalhoDeSecao titulo="Anotações" />
            <ul className="space-y-2">
              {notas.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/nota/${n.id}`}
                    className="group flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-amber-500/30"
                  >
                    <span className="font-serif text-lg text-zinc-50 group-hover:text-amber-500/90">
                      {n.titulo}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tracking-wider text-zinc-600">
                      {n.fontes.length > 0
                        ? `REVISADA · ${n.fontes.length} FONTE(S)`
                        : "RASCUNHO DO COFRE"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              Caderno de leitura. As marcadas como revisadas foram conferidas e têm
              fonte; as outras seguem como vieram do cofre, sem revisão.
            </p>
          </section>
        )}

        {fontes.length > 0 && (
          /*
            As fontes da TRAJETÓRIA. As das alegações aparecem dentro do cartão
            de cada uma, e é de propósito: ali a fonte sustenta uma afirmação
            específica com status processual, e afastá-la do enunciado que ela
            lastreia enfraqueceria exatamente o que o cartão existe para fazer.
          */
          <section className="mt-24 md:mt-32">
            <div className="mb-10 h-px bg-gradient-to-r from-zinc-800 to-transparent" />
            <h2 className="font-serif text-3xl leading-tight tracking-tight text-zinc-400 md:text-4xl">
              {fontes.length === 1 ? "Fonte da trajetória" : "Fontes da trajetória"}
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
        )}
      </div>
    </main>
  );
}
