import type { TSESLint } from '@typescript-eslint/utils';
import { pipe } from 'effect';
import importPlugin from 'eslint-plugin-import-x';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import * as tseslint from 'typescript-eslint';

import { overrideWith } from '../overrideHelpers.js';
import * as settings from '../settings/index.js';

export const plugins: TSESLint.FlatConfig.Plugins = {
  '@typescript-eslint': tseslint.plugin,
  'import-x': importPlugin,
  'simple-import-sort': simpleImportSortPlugin,
};

export const overrides: Partial<TSESLint.FlatConfig.Config> = {
  plugins,
  settings: settings.typescript,
};

//  import-x/no-named-as-default
const eslintConfig: TSESLint.FlatConfig.ConfigArray = pipe(
  tseslint.config(
    {
      rules: {
        ...importPlugin.configs.recommended.rules,
        ...importPlugin.configs.typescript.rules,
        // type imports
        '@typescript-eslint/consistent-type-imports': 'error',
        // deprecated rules
        '@typescript-eslint/no-deprecated': 'error',
        // we like namespaces
        '@typescript-eslint/no-namespace': 'off',
        // whitespace
        'import-x/newline-after-import': 'error',
        // disable as madge will catch
        'import-x/no-cycle': 'off',
        // default is warn
        'import-x/no-duplicates': 'error',
        // make sure all dependencies are covered in package.json
        'import-x/no-extraneous-dependencies': 'error',
        // blocks code smell importing default as a name different than filename
        'import-x/no-named-as-default': 'error',
        // import package not relative paths
        'import-x/no-relative-packages': 'error',
        // don't import the same file
        'import-x/no-self-import': 'error',
        // don't leave unused imports
        'import-x/no-unused-modules': 'error',
        // doesn't mix well with @effect
        'import-x/prefer-default-export': 'off',
        // default is off
        'simple-import-sort/exports': ['error'],
        // disable as it conflicts with simple-import-sort
      },
    },
    {
      rules: {
        'import-x/order': 'off',
        'sort-imports': 'off',
      },
    },
    // disable as TS will catch
    {
      rules: {
        'import-x/default': 'off',
        'import-x/extensions': 'off',
        'import-x/named': 'off',
        'import-x/namespace': 'off',
        'import-x/no-named-as-default-member': 'off',
        'import-x/no-unresolved': 'off',
      },
    },
  ),
  overrideWith(overrides),
);

export default eslintConfig;
