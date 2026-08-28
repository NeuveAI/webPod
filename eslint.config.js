import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.output/**',
      '**/.tanstack/**',
      '**/routeTree.gen.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Hard rule 1. Tool callbacks live outside React and must read and
      // write the same state the UI renders; state in a component closure
      // is unreachable from them. This is a capability constraint, so it
      // is enforced here rather than left to review.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='useState']",
          message: 'useState is banned repo-wide. Use the Jotai store.',
        },
        {
          // Any member access named useState, whatever the namespace is called.
          // The earlier `React.useState` form was too narrow: an arbitrary alias
          // (`import * as R from 'react'; R.useState()`) walked straight through
          // it, while AGENTS.md claims the law is enforced here.
          selector: "MemberExpression[property.name='useState']",
          message: 'useState is banned repo-wide. Use the Jotai store.',
        },
        {
          // Computed access: `R['useState'](0)`. A plain MemberExpression selector
          // matches on `property.name`, which a string-literal key does not have.
          selector: "MemberExpression[computed=true][property.value='useState']",
          message: 'useState is banned repo-wide. Use the Jotai store.',
        },
        {
          selector: "ImportSpecifier[imported.name='useState']",
          message: 'useState is banned repo-wide. Use the Jotai store.',
        },
        {
          // Destructured off a namespace: `const { useState: mk } = R`. Covers the
          // shorthand `const { useState } = R` too, since both carry the same key.
          // Restricted to ObjectPattern so object *literals* with a `useState`
          // property are untouched.
          selector: "ObjectPattern > Property[key.name='useState']",
          message: 'useState is banned repo-wide. Use the Jotai store.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
)
