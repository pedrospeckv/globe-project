import type { Metadata } from "next";
import Link from "next/link";

/**
 * A porta de entrada do projeto aberto. O mapa é a página inicial e diz o que
 * o atlas é; esta página diz o que ele é como projeto — de onde vem, o que
 * assume, sob que licença, e como alguém ajuda. Sem ela, o site é um beco sem
 * saída: quem gosta do que vê não tem para onde ir.
 *
 * Os números não são literais aqui de propósito: são os que o README e
 * `docs/cobertura.md` já auditam, e duplicar contagem à mão é criar um segundo
 * lugar para desatualizar. Esta página aponta, não mede.
 */
export const metadata: Metadata = {
  title: "Sobre",
  description:
    "O que é este atlas, de onde vêm as fronteiras, o que ele assume de " +
    "limitação, sob que licença vive e como contribuir.",
};

const LIMITACOES = [
  {
    titulo: "A fronteira mostrada é a da última fatia anterior à data",
    texto:
      "As 54 fatias de fronteira vêm de datas reais, mas não de todas as datas. " +
      "Um aviso graduado na tela diz de quanto é a defasagem — em 1650, o vão " +
      "mediano entre fatias é de 70 anos.",
  },
  {
    titulo: "A base reaproveita nomes modernos para predecessores",
    texto:
      "\"Gana\" em 800 é o Império do Gana, em território que não é o do Gana de " +
      "hoje. E território sem nome não quer dizer território sem Estado: quer " +
      "dizer que a fonte não o atribui.",
  },
  {
    titulo: "A geometria dos países acesos é a moderna",
    texto:
      "Desenhar a fronteira interalemã de 1961 exigiria geometria histórica " +
      "própria para cada dossiê; onde ela falta, o mapa hachura e admite.",
  },
];

export default function SobrePage() {
  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-8 px-4">
        <Link href="/" className="font-mono text-xs text-sky-400 hover:underline">
          ← globo
        </Link>

        <header>
          <h1 className="font-serif text-4xl tracking-tight">Sobre este atlas</h1>
          <p className="mt-1 font-mono text-xs tracking-widest text-slate-500">
            OPEN SOURCE · MIT (CÓDIGO) · CC BY-SA 4.0 (TEXTO E GEOMETRIA)
          </p>
        </header>

        <section className="space-y-3">
          <p className="leading-relaxed text-slate-300">
            Um atlas histórico e geopolítico navegável, feito para{" "}
            <strong className="font-semibold text-slate-100">estudar</strong>: um
            mapa que mostra as fronteiras de qualquer data entre 123.000 a.C. e
            hoje, e dossiês que contam o que estava acontecendo dentro delas.
            Não é obra acadêmica e não é produto — é uma ferramenta de estudo,
            aberta, mantida por quem quiser ajudar a escrevê-la.
          </p>
          <p className="leading-relaxed text-slate-300">
            A unidade de conteúdo é{" "}
            <strong className="font-semibold text-slate-100">país × período</strong>
            : &quot;França 1420&quot; e &quot;França 2026&quot; são o mesmo tipo de objeto, e é por
            isso que geopolítica atual não é um módulo separado — é o último
            período da linha do tempo. A regra que resume o projeto:{" "}
            <strong className="font-semibold text-slate-100">
              toda afirmação precisa de fonte, e nenhuma URL pode ser inventada
            </strong>{" "}
            — o build recusa conteúdo sem ela, e o CI cobra de novo em cada PR.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl tracking-tight">
            O que ele NÃO faz, e assume
          </h2>
          <p className="text-sm leading-relaxed text-slate-400">
            Esconder limitação num atlas é pior que tê-la. As três limitações
            estão declaradas também na própria tela:
          </p>
          <ol className="space-y-3">
            {LIMITACOES.map((l, i) => (
              <li
                key={l.titulo}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
              >
                <p className="text-sm font-semibold text-slate-200">
                  {i + 1}. {l.titulo}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {l.texto}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl tracking-tight">De onde vem</h2>
          <p className="text-sm leading-relaxed text-slate-400">
            As fronteiras históricas vêm do{" "}
            <a
              href="https://github.com/aourednik/historical-basemaps"
              className="text-sky-400 hover:underline"
            >
              historical-basemaps
            </a>
            , de A. Ourednik, sob CC BY-SA 4.0. A fatia moderna vem do{" "}
            <a
              href="https://www.naturalearthdata.com/"
              className="text-sky-400 hover:underline"
            >
              Natural Earth
            </a>{" "}
            (domínio público). Duas datas — 1938 e 1945 — são corrigidas contra a
            base, com o que foi mudado e por quê registrado na auditoria de
            anacronismos do repositório.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl tracking-tight">Contribuir</h2>
          <p className="leading-relaxed text-slate-300">
            Sim, por favor. O mapa cobre quase todos os países; o que sobrou é
            justo o que um projeto aberto faz melhor — casos disputados, períodos
            pós-2018, correção de erro de fato com fonte. Cada afirmação precisa
            de fonte, e quem escreve conta o que não conseguiu achar: este atlas
            não tem vergonha de buraco, tem de invenção.
          </p>
          <p className="text-sm leading-relaxed text-slate-400">
            O guia completo, com a regra da fonte e o passo a passo de um país
            novo, está no{" "}
            <a
              href="https://github.com/pedrospeckv/globe-project/blob/master/CONTRIBUTING.md"
              className="text-sky-400 hover:underline"
            >
              CONTRIBUTING do repositório
            </a>
            . Erro de fato que você encontrou?{" "}
 <a
   href="https://github.com/pedrospeckv/globe-project/issues/new/choose"
   className="text-sky-400 hover:underline"
 >
   Abra uma issue
 </a>{" "}
 com a fonte que o corrige.
          </p>
        </section>
      </div>
    </main>
  );
}
