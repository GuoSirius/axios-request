import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// 检测是否为生产环境（通过 NODE_ENV）
const isProduction = process.env.NODE_ENV === 'production';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Promise: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        AbortController: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        FormData: 'readonly',
        JSON: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // ========== TypeScript Rules - 始终 error ==========
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'no-unused-vars': 'off',

      // ========== Console & Debugger ==========
      // 生产环境禁止 console 和 debugger
      ...(isProduction
        ? {
          'no-console': 'error',
          'no-debugger': 'error',
        }
        : {}),

      // ========== 核心规则 - 始终 error ==========
      'no-prototype-builtins': 'error',
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-class-members': 'error',

      // ========== TypeScript 严格检查（不需要类型信息） ==========
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '**/*.js', 'example/'],
  },
];
