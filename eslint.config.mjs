import tsEslint from 'typescript-eslint'
import eslintPluginJest from 'eslint-plugin-jest'
import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import jestFormatting from 'eslint-plugin-jest-formatting'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'

export default tsEslint.config(
  eslint.configs.recommended,
  ...tsEslint.configs.strictTypeChecked,
  ...tsEslint.configs.stylisticTypeChecked,
  {
    plugins: {
      '@stylistic': stylistic,
      'jest-formatting': jestFormatting,
    },
    files: ['**/**.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 1,
      "@typescript-eslint/restrict-template-expressions": ["error", {
        "allowNumber": true
      }],
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
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      jest: eslintPluginJest,
    },
    files: ['**/**.test.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      'jest/unbound-method': 'error',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-misused-spread': 'off',
    },
  },
)
