import type { TSESLint } from '@typescript-eslint/utils';
import { pipe } from 'effect';
import perfectionistPlugin from 'eslint-plugin-perfectionist';
import unicornPlugin from 'eslint-plugin-unicorn';
import * as tseslint from 'typescript-eslint';

import { overrideWith } from '../overrideHelpers.js';
import * as settings from '../settings/index.js';
import * as recommendedConfig from './recommended.js';

export const plugins: TSESLint.FlatConfig.Plugins = {
  ...recommendedConfig.plugins,
  perfectionist: perfectionistPlugin,
  unicorn: unicornPlugin,
};

export const overrides: Partial<TSESLint.FlatConfig.Config> = {
  ...recommendedConfig.overrides,
  plugins,
  settings: settings.typescript,
};

export const eslintConfig: TSESLint.FlatConfig.ConfigArray = pipe(
  tseslint.config(
    unicornPlugin.configs['flat/all'],
    /**
     * Recommended rules.
     */
    ...recommendedConfig.default,
    // replaced by perfectionist
    {
      rules: {
        'sort-destructure-keys/sort-destructure-keys': 'off',
      },
    },
    /*
     * Perfectionist rules.
     */
    perfectionistPlugin.configs['recommended-alphabetical'],
    // disable as it conflicts with simple-import-sort
    {
      rules: {
        'perfectionist/sort-imports': 'off',
        'perfectionist/sort-named-imports': 'off',
      },
    },
    // disable unicorn rules
    {
      rules: {
        'unicorn/consistent-destructuring': 'off',
        // false positives with functions in namespaces
        'unicorn/consistent-function-scoping': 'off',
        'unicorn/error-message': 'warn',
        'unicorn/filename-case': 'off',
        'unicorn/no-array-callback-reference': 'off',
        // not fp
        'unicorn/no-array-for-each': 'off',
        // doesn't play nice with effect's Array
        'unicorn/no-array-method-this-argument': 'off',
        'unicorn/no-keyword-prefix': 'off',
        'unicorn/no-negated-condition': 'off',
        'unicorn/no-null': 'off',
        'unicorn/no-useless-undefined': 'off',
        'unicorn/prefer-array-flat': 'off',
        'unicorn/prefer-export-from': 'off',
        'unicorn/prefer-number-properties': [
          'error',
          {
            // default is false
            checkInfinity: true,
            // default is true
            checkNaN: true,
          },
        ],
        // too verbose
        'unicorn/prevent-abbreviations': 'off',
        // too verbose
        'unicorn/switch-case-braces': 'off',
        // doesn't play nice with TaggedError subclassing
        'unicorn/throw-new-error': 'off',
      },
    },
    /*
     * Functional rules.
     */
    // functionalPlugin.configs.strict,
  ),
  overrideWith(overrides),
);

export default eslintConfig;
