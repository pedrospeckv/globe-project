import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Node por padrão: os testes de lógica não precisam de DOM e ficam mais
    // rápidos sem ele. Os testes de componente pedem jsdom arquivo a arquivo,
    // com `// @vitest-environment jsdom` no topo.
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "scripts/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
