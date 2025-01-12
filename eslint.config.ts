import type { TSESLint } from '@typescript-eslint/utils';
import * as tseslint from 'typescript-eslint';

import astalPlugin from '@astal-config/eslint-plugin';

const ignores = [
  '**/.rollup-cache/**/*', // rollup cache
  '**/node_modules/**/*', // node dependencies
  'packages/*/dist/**/*', // build artifacts
];

const extraFileExtensions = [''];

/**
 * Base TypeScript ESLint configuration.
 */
const tsParserOptions: TSESLint.FlatConfig.ParserOptions = {
  ecmaVersion: 'latest',
  // optimization only for ProjectService to prevent project refresh
  extraFileExtensions,
  projectService: true,
  sourceType: 'module',
  tsconfigRootDir: import.meta.dirname,
  warnOnUnsupportedTypeScriptVersion: false,
};

const tsConfigOverrides: TSESLint.FlatConfig.Config = {
  rules: {
    '@cspell/spellchecker': ['error', { configFile: './configs/cspell/cspell.config.json' }],
    'import-x/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['eslint.config.ts', 'vendor/@types/**/*.d.ts'],
      },
    ],
    'simple-import-sort/imports': [
      'error',
      {
        groups: [
          // side effect imports
          [String.raw`^\u0000`],
          // platform imports
          ['^(bun|node):'],
          // third-party imports
          [String.raw`^@?\w`],
          // first-party imports
          ['^@astal-config/'],
          // self imports
          ['^@/'],
          // relative imports
          [String.raw`^\.`],
        ],
      },
    ],
  },
};

const tsConfigLanguageOptions: TSESLint.FlatConfig.LanguageOptions = {
  parser: tseslint.parser,
  parserOptions: tsParserOptions,
};

/**
 * TypeScript ESLint configuration.
 */
const tsConfig = astalPlugin.overrideWith([...astalPlugin.configs.strict, tsConfigOverrides], {
  files: ['*.[cm]js', '*.[cm]ts', '*.js', '*.ts', 'packages/**/*.ts'],
  languageOptions: tsConfigLanguageOptions,
});

/**
 * JSON ESLint configuration.
 */
const jsonConfig = astalPlugin.overrideWith(astalPlugin.configs['json/recommended'], {
  files: ['**/*.json', '**/*.json[5c]'],
});

/**
 * ESLint configuration
 */
const eslintConfig = [
  // global configs
  { ignores },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  // specific configs
  ...tsConfig,
  ...jsonConfig,
];

export default eslintConfig;
