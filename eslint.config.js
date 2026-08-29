import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import perfectionist from "eslint-plugin-perfectionist";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["**/dist/**", "**/target/**", "**/src-tauri/gen/**"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{js,cjs,mjs,ts,tsx}"],
    plugins: {
      perfectionist,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-duplicate-imports": ["error", { allowSeparateTypeImports: true, includeExports: true }],
      "object-shorthand": ["error", "always"],
      "perfectionist/sort-interfaces": [
        "error",
        {
          ignoreCase: true,
          order: "asc",
          type: "natural",
        },
      ],
      "perfectionist/sort-jsx-props": [
        "error",
        {
          ignoreCase: true,
          order: "asc",
          type: "natural",
        },
      ],
      "perfectionist/sort-named-exports": [
        "error",
        {
          ignoreCase: true,
          order: "asc",
          type: "natural",
        },
      ],
      "perfectionist/sort-named-imports": [
        "error",
        {
          ignoreCase: true,
          order: "asc",
          type: "natural",
        },
      ],
      "perfectionist/sort-object-types": [
        "error",
        {
          ignoreCase: true,
          order: "asc",
          type: "natural",
        },
      ],
      // Keep object-literal insertion order intact; only destructuring is mechanically sorted.
      "perfectionist/sort-objects": [
        "error",
        {
          ignoreCase: true,
          order: "asc",
          type: "natural",
          useConfigurationIf: {
            objectType: "destructured",
          },
        },
        {
          type: "unsorted",
        },
      ],
      "padding-line-between-statements": [
        "error",
        {
          blankLine: "always",
          prev: ["multiline-const", "multiline-let", "multiline-var"],
          next: "*",
        },
      ],
      "prefer-template": "error",
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^\\u0000"],
            ["^node:"],
            ["^@?\\w"],
            ["^@/components/ui(?:/|$)"],
            ["^@/(?!components/ui(?:/|$))"],
            ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
            ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
          ],
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["apps/desktop/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/features/[^/]+/.+",
              message: "Import features through their public index API.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/desktop/src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app", "@/app/**", "@/features", "@/features/**", "@/store", "@/store/**"],
              message: "UI primitives must not depend on application, feature, or state layers.",
            },
            {
              regex: "^\\.\\.(?:/\\.\\.)*/(?:app|features|store)(?:/|$)",
              message: "UI primitives must not depend on application, feature, or state layers.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/desktop/src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app",
                "@/app/**",
                "@/components",
                "@/components/**",
                "@/features",
                "@/features/**",
                "@/lib/tauri",
                "@/lib/tauri/**",
                "@/store",
                "@/store/**",
              ],
              message: "Domain modules must remain framework- and application-independent.",
            },
            {
              group: ["react", "react-dom", "react/**", "react-dom/**"],
              message: "Domain modules must remain framework- and application-independent.",
            },
            {
              regex: "^\\.\\.(?:/\\.\\.)*/(?:app|components|features|lib/tauri|store)(?:/|$)",
              message: "Domain modules must remain framework- and application-independent.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/desktop/src/**/*.{ts,tsx}", "apps/desktop/vite.config.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          disallowTypeAnnotations: false,
          fixStyle: "inline-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      ...reactHooks.configs.flat.recommended.rules,
      ...reactRefresh.configs.vite.rules,
    },
  },
  {
    files: ["apps/desktop/src/components/ui/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  eslintConfigPrettier,
);
