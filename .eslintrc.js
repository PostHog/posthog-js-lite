const extend = [
  'eslint:recommended',
  'plugin:@typescript-eslint/recommended',
  'plugin:react/recommended',
  'plugin:react-hooks/recommended',
  'prettier',
]

const plugins = ['prettier', 'react', '@typescript-eslint', 'eslint-plugin-react-hooks', 'eslint-plugin-jest']

module.exports = {
  ignorePatterns: ['node_modules', 'examples', 'lib', "vendor"],
  env: {
    browser: true,
    es6: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  extends: extend,
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
    module: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins,
  rules: {
    'react/prop-types': [0],
    'react/no-unescaped-entities': [0],
    'react/jsx-no-target-blank': [0],
    'react/self-closing-comp': [
      'error',
      {
        component: true,
        html: true,
      },
    ],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/prefer-ts-expect-error': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-non-null-assertion': 'error',
    curly: 'error',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'dayjs',
            message: 'Do not directly import dayjs. Only import the dayjs exported from lib/dayjs.',
          },
        ],
      },
    ],
    'no-empty': 'off',
    'no-constant-condition': 'off',
  },
  overrides: [
    {
      // enable the rule specifically for TypeScript files
      files: ['*Type.ts', '*Type.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': ['off'],
        '@typescript-eslint/ban-types': ['off'],
      },
    },
    {
      // enable the rule specifically for TypeScript files
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': ['off'],
        '@typescript-eslint/explicit-function-return-type': [
          'error',
          {
            allowExpressions: true,
          },
        ],
        '@typescript-eslint/explicit-module-boundary-types': [
          'error',
          {
            allowArgumentsExplicitlyTypedAsAny: true,
          },
        ],
      },
    },
    {
      files: ['*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      env: {
        jest: true,
        node: true,
        browser: true,
        es6: true,
      },
    },
  ],
  reportUnusedDisableDirectives: true,
}
