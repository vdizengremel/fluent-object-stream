import { defineConfig } from 'eslint/config'
import tsEslint from 'typescript-eslint'
import vitest from '@vitest/eslint-plugin'
import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import jestFormatting from 'eslint-plugin-jest-formatting'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import pluginSecurity from 'eslint-plugin-security'
import noOnlyTests from 'eslint-plugin-no-only-tests'

export default defineConfig(
  eslint.configs.recommended,
  // Only for the published code: in tests, its rules only report false positives (fs calls on temporary files).
  { ...pluginSecurity.configs.recommended, ignores: ['**/*.test.ts'] },
  tsEslint.configs.strictTypeChecked,
  tsEslint.configs.stylisticTypeChecked,
  {
    plugins: {
      '@stylistic': stylistic,
      'jest-formatting': jestFormatting,
      'no-only-tests': noOnlyTests,
    },
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
      'no-only-tests/no-only-tests': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 1,
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
        },
      ],
      '@stylistic/lines-between-class-members': 'error',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'block' },
        { blankLine: 'always', prev: 'block', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: 'function' },
      ],
      'jest-formatting/padding-around-all': 'error',
    },
  },
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.test.ts'],
    ...vitest.configs.recommended,
  },
  {
    rules: {
      '@typescript-eslint/no-misused-spread': 'off',
    },
  }
)
