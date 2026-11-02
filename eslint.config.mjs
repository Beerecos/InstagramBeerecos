import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Écrans réseaux sociaux repris tels quels de BeeMarketing (docs/TRANSFERT-RESEAUX-SOCIAUX.md) : ces règles
    // n'existaient pas dans BeeMarketing. Code en production là-bas ; mise en conformité progressive, pas de réécriture.
    files: ["src/components/social/**/*.{ts,tsx}"],
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    "automation/**",
    // Fichiers tiers minifiés servis tels quels (GSAP, runtime Hyperframes).
    "public/hyperframes/**",
    "projets/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
