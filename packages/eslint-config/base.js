import eslintConfigPrettier from 'eslint-config-prettier';
import perfectionist from 'eslint-plugin-perfectionist';
import turboPlugin from 'eslint-plugin-turbo';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

import js from '@eslint/js';

/**
 * A shared ESLint configuration for the repository.
 */
export const config = defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/out/**',
    '**/build/**',
    '**/.turbo/**',
    '**/*.tsbuildinfo',
    '**/.eslintcache',
    '**/public/**',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
      perfectionist,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',

      // Perfectionist
      'perfectionist/sort-enums': 'off',
      'perfectionist/sort-objects': 'off',
      'perfectionist/sort-classes': 'off',
      'perfectionist/sort-interfaces': 'off',
      'perfectionist/sort-union-types': 'off',
      'perfectionist/sort-object-types': 'off',

      'perfectionist/sort-imports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          internalPattern: ['^#.*', '^@.*'],

          groups: [
            'type-import',
            ['value-builtin', 'value-external'],
            'type-internal',
            'value-internal',
            ['type-parent', 'type-sibling', 'type-index'],
            ['value-parent', 'value-sibling', 'value-index'],
            'ts-equals-import',
            'side-effect',
            'unknown',
          ],
        },
      ],

      'perfectionist/sort-exports': [
        'error',
        { type: 'natural', order: 'asc' },
      ],
      'perfectionist/sort-named-imports': [
        'error',
        { type: 'natural', order: 'asc' },
      ],

      // Extra rules
      // 'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  eslintConfigPrettier,
);
