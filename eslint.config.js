import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/node_modules/**', '**/dist/**'],
  },
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      react,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
    settings: {
      react: { version: 'detect' },
    },
  },
);
