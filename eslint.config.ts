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
 * Base CSpell ESLint configuration.
 */
const cspellRules: TSESLint.FlatConfig.Rules = {
  '@cspell/spellchecker': ['warn', { configFile: './configs/cspell/cspell.config.json' }],
};

/**
 * astal import sort order.
 */
const astalImportSortOrder: TSESLint.FlatConfig.Config = {
  rules: {
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
    // performance exceptions outside of CI (e.g., LSP)
    ...(process.env.GITLAB_CI === undefined
      ? {
          'import-x/no-duplicates': 'off',
          'import-x/no-extraneous-dependencies': 'off',
          'import-x/no-named-as-default': 'off',
          'import-x/no-relative-packages': 'off',
          'import-x/no-self-import': 'off',
        }
      : {
          'import-x/no-duplicates': 'error',
          // check type imports and add development exceptions
          'import-x/no-extraneous-dependencies': [
            'error',
            {
              devDependencies: [
                'buntest.config.ts',
                'commitlint.config.ts',
                'eslint.config.ts',
                'packages/**/esbuild.*.ts',
                'packages/**/tests/**/*.ts',
                'packages/**/vite.config.ts',
                'vendor/@types/**/*.d.ts',
                'vitest.config.ts',
              ],
            },
          ],
          'import-x/no-named-as-default': 'error',
          'import-x/no-relative-packages': 'error',
          'import-x/no-self-import': 'error',
        }),
    // spellchecking
    ...cspellRules,
  },
};

const tsConfigLanguageOptions: TSESLint.FlatConfig.LanguageOptions = {
  parser: tseslint.parser,
  parserOptions: tsParserOptions,
};

/**
 * TypeScript ESLint configuration.
 */
const tsConfig = astalPlugin.overrideWith([...astalPlugin.configs.strict, astalImportSortOrder, tsConfigOverrides], {
  files: ['*.[cm]js', '*.[cm]ts', '*.js', '*.ts', 'packages/**/*.ts'],
  ignores: ['packages/client-portal/**/*'],
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
