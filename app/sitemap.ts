import type { MetadataRoute } from "next";
import path from "node:path";
import { carregarAcervo } from "@/lib/conteudo/carregar";

const RAIZ = path.join(process.cwd(), "conteudo");

// O atlas já teve 824 páginas estáticas sem sitemap — o Google não tinha como
// descobrir nenhuma. Este arquivo existe para o conteúdo ser encontrável, não
// para ranquear: cada rota gerada por `generateStaticParams` aparece aqui uma vez.
const BASE = "https://globe-project-roan.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const acervo = await carregarAcervo(RAIZ);

  const estaticas: MetadataRoute.Sitemap = ["", "/notas", "/biblioteca"].map(
    (rota) => ({ url: `${BASE}${rota}` })
  );

  const paises: MetadataRoute.Sitemap = acervo.paises.map((p) => ({
    url: `${BASE}/pais/${p.iso}`,
  }));

  // Mesma origem das rotas de `app/pais/[iso]/[periodo]`: iso do acervo, id do período.
  const periodos: MetadataRoute.Sitemap = acervo.paises.flatMap((p) =>
    p.periodos.map((per) => ({ url: `${BASE}/pais/${p.iso}/${per.id}` }))
  );

  const colecoes: MetadataRoute.Sitemap = [
    ...acervo.episodios.map((e) => ({ url: `${BASE}/episodio/${e.id}` })),
    ...acervo.figuras.map((f) => ({ url: `${BASE}/figura/${f.id}` })),
    ...acervo.eleicoes.map((e) => ({ url: `${BASE}/eleicao/${e.id}` })),
    ...acervo.nacoes.map((n) => ({ url: `${BASE}/nacao/${n.id}` })),
    ...acervo.notas.map((n) => ({ url: `${BASE}/nota/${n.id}` })),
  ];

  return [...estaticas, ...paises, ...periodos, ...colecoes];
}
