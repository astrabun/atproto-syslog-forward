import {defineConfig} from 'oxlint';

export default defineConfig({
  categories: {
    correctness: 'warn',
    style: 'error',
  },
  overrides: [
    {
      files: ['src/**/*.ts'],
      rules: {
        'func-style': 'off',
        'init-declarations': 'off',
        'max-statements': 'off',
        'no-magic-numbers': 'off',
        'no-ternary': 'off',
        'prefer-ternary': 'off',
        'sort-imports': 'off',
      },
    },
  ],
  rules: {
    'unicorn/empty-brace-spaces': 'error',
    'unicorn/numeric-separators-style': 'off',
  },
});