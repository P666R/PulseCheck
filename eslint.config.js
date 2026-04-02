import { config as baseConfig } from '@repo/eslint-config/base';
import { config as nextJsConfig } from '@repo/eslint-config/next';
import { config as libraryConfig } from '@repo/eslint-config/react';

/**
 * Example root ESLint configuration for the monorepo.
 * This allows lint-staged to run from the root while respecting package-specific configs.
 */
export default [
  // Base config applies to all files
  ...baseConfig,

  // Next.js apps: map to your app package names
  {
    files: ['packages/{web,api}/**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['**/*.config.{js,mjs,cjs}'],
  },
  ...nextJsConfig.map((config) => ({
    ...config,
    files: ['packages/{web,api}/**/*.{js,mjs,cjs,ts,tsx}'],
  })),

  // Library packages: map to your library package names
  {
    files: ['packages/{shared,ui,utils}/**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['**/*.config.{js,mjs,cjs}'],
  },
  ...libraryConfig.map((config) => ({
    ...config,
    files: ['packages/{shared,ui,utils}/**/*.{js,mjs,cjs,ts,tsx}'],
  })),
];
