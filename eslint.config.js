import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/drizzle/**", "**/routeTree.gen.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-syntax": [
        "error",
        ...["Literal[value=/\\u2014/]", "TemplateElement[value.raw=/\\u2014/]", "JSXText[value=/\\u2014/]"].map(
          (selector) => ({ selector, message: "No em dashes in copy. Use a comma, colon or two sentences." }),
        ),
      ],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  { files: ["apps/web/public/sw.js"], languageOptions: { globals: { ...globals.serviceworker } } },
  { files: ["apps/web/public/theme.js"], languageOptions: { globals: { ...globals.browser } } },
  prettier,
);
