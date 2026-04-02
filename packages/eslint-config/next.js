import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

import pluginNext from '@next/eslint-plugin-next';

import { config as reactConfig } from './react.js';

/**
 * A custom ESLint configuration for libraries that use Next.js.
 */
export const config = defineConfig(
  ...reactConfig,

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),

  {
    plugins: { '@next/next': pluginNext },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
    },
  },
  eslintConfigPrettier,
);
