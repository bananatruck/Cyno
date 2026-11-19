import { fileURLToPath, URL } from "node:url";
import { readFile } from "node:fs/promises";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths, so the same build works at / and under a GitHub Pages project path.
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "ship-licence-notices",
      async generateBundle() {
        for (const fileName of ["LICENSE", "THIRD_PARTY_NOTICES.md", "licenses/HeroUI-Apache-2.0.txt"]) {
          this.emitFile({
            type: "asset",
            fileName,
            source: await readFile(new URL(`../../${fileName}`, import.meta.url), "utf8"),
          });
        }
      },
    },
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"] },
});
