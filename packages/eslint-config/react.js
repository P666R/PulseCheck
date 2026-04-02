import eslintConfigPrettier from 'eslint-config-prettier';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

import { config as baseConfig } from './base.js';

/**
 * A custom ESLint configuration for libraries that use React.
 */
export const config = defineConfig(
  ...baseConfig,

  {
    name: '@repo/eslint-config/react',
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React recommended rules
      ...pluginReact.configs.recommended.rules,
      ...pluginReact.configs['jsx-runtime'].rules,

      // React Hooks recommended rules
      ...pluginReactHooks.configs.recommended.rules,

      // Disable legacy rules (new JSX transform + TypeScript)
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/prop-types': 'off',
    },
  },
  eslintConfigPrettier,
);
