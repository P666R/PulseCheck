import { defineConfig } from 'czg';

export default defineConfig({
  extends: [
    '@commitlint/config-conventional',
    '@commitlint/config-pnpm-scopes',
  ],
  rules: {
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 100],
    'subject-min-length': [2, 'always', 5],
  },
  prompt: {
    alias: { fd: 'docs: fix typos' },
    messages: {
      type: "Select the type of change that you're committing:",
      scope: 'Denote the SCOPE of this change (optional):',
      customScope: 'Denote the SCOPE of this change:',
      subject: 'Write a SHORT, IMPERATIVE tense description of the change:\n',
      body: 'Provide a LONGER description of the change (optional). Use "|" to break new line:\n',
      breaking:
        'List any BREAKING CHANGES (optional). Use "|" to break new line:\n',
      footerPrefixesSelect:
        'Select the ISSUES type of changeList by this change (optional):',
      customFooterPrefix: 'Input ISSUES prefix:',
      footer: 'List any ISSUES by this change. E.g.: #31, #34:\n',
      generatingByAI: 'Generating your AI commit subject...',
      generatedSelectByAI: 'Select suitable subject by AI generated:',
      confirmCommit: 'Are you sure you want to proceed with the commit above?',
    },
    types: [
      { value: 'feat', name: 'feat:     ✨  A new feature', emoji: '✨' },
      { value: 'fix', name: 'fix:      🐛  A bug fix', emoji: '🐛' },
      {
        value: 'docs',
        name: 'docs:     📝  Documentation changes',
        emoji: '📝',
      },
      {
        value: 'style',
        name: 'style:    💄  Formatting/Style changes',
        emoji: '💄',
      },
      {
        value: 'refactor',
        name: 'refactor: ♻️   Code refactoring',
        emoji: '♻️',
      },
      {
        value: 'perf',
        name: 'perf:     ⚡️  Performance improvements',
        emoji: '⚡️',
      },
      {
        value: 'test',
        name: 'test:     ✅  Adding/Correcting tests',
        emoji: '✅',
      },
      {
        value: 'build',
        name: 'build:    📦️  Build system/dependencies',
        emoji: '📦️',
      },
      { value: 'ci', name: 'ci:       🎡  CI configuration', emoji: '🎡' },
      {
        value: 'chore',
        name: 'chore:    🔨  General maintenance',
        emoji: '🔨',
      },
      {
        value: 'revert',
        name: 'revert:   ⏪️  Revert to previous commit',
        emoji: '⏪️',
      },
    ],
    useEmoji: true,
    emojiAlign: 'center',
    useAI: false,
    allowEmptyScopes: true,
    allowCustomScopes: true,
    enableMultipleScopes: true,
    scopeEnumSeparator: ',',
    markBreakingChangeMode: true,
    allowBreakingChanges: ['feat', 'fix'],
  },
});
