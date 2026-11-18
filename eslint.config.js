import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    // The full engine (astronomy-engine and the catalog) belongs in the worker or a lazy chunk.
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: [
      "apps/web/src/lib/plan.worker.ts",
      "apps/web/src/**/*.test.{ts,tsx}",
      "apps/web/src/**/test-*.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@cyno/engine",
              message: 'Import runtime values from "@cyno/engine/input", or use import("@cyno/engine").',
              allowTypeImports: true,
            },
          ],
          patterns: [
            {
              group: ["**/packages/engine/**", "**/engine/src/**"],
              message: 'Import the engine as "@cyno/engine/input", or use import("@cyno/engine").',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
);
