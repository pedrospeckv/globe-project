#!/usr/bin/env node
/**
 * Lançador do servidor de desenvolvimento.
 *
 * Existe porque o `next dev` precisa rodar com o cwd na raiz do projeto — é de
 * lá que `carregarAcervo` resolve a pasta `conteudo/`. Chamar o binário do
 * Next de outro diretório faz o acervo carregar vazio, silenciosamente.
 *
 * Uso normal continua sendo `pnpm dev`. Este arquivo serve para ferramentas
 * que precisam iniciar o servidor de fora da pasta do projeto.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(raiz);

const binNext = path.join(raiz, "node_modules", "next", "dist", "bin", "next");
const porta = process.env.PORT ?? "3000";

process.argv = [process.argv[0], binNext, "dev", "--port", porta];

await import(path.sep === "\\" ? `file://${binNext.replace(/\\/g, "/")}` : binNext);
