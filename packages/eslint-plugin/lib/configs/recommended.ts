import cspellRecommended from '@cspell/eslint-plugin/recommended';
import { fixupPluginRules } from '@eslint/compat';
import eslint from '@eslint/js';
import * as stylisticPlugin from '@stylistic/eslint-plugin';
import type { TSESLint } from '@typescript-eslint/utils';
import { pipe } from 'effect';
import codegenPlugin from 'eslint-plugin-codegen';
import functionalPlugin from 'eslint-plugin-functional';
import preferArrowFunctionsPlugin from 'eslint-plugin-prefer-arrow-functions';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import promisePlugin from 'eslint-plugin-promise';
import securityPlugin from 'eslint-plugin-security';
import sortDestructureKeysPlugin from 'eslint-plugin-sort-destructure-keys';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import * as tseslint from 'typescript-eslint';

import { globals } from '../constants.js';
import { declareGlobals, overrideWith } from '../overrideHelpers.js';
import astalPlugin from '../plugin/index.js';
import * as settings from '../settings/index.js';
import * as airbnbConfig from './airbnb.js';
import * as importConfig from './import.js';

export const plugins: TSESLint.FlatConfig.Plugins = {
  ...airbnbConfig.plugins,
  ...importConfig.plugins,
  '@typescript-eslint': tseslint.plugin,
  astal: astalPlugin,
  codegen: codegenPlugin,
  'prefer-arrow-functions': fixupPluginRules(preferArrowFunctionsPlugin),
  prettier: prettierPlugin,
  promise: promisePlugin,
  'sort-destructure-keys': sortDestructureKeysPlugin,
  tsdoc: tsdocPlugin,
};

export const overrides: Partial<TSESLint.FlatConfig.Config> = {
  ...airbnbConfig.overrides,
  ...importConfig.overrides,
  plugins,
  settings: settings.typescript,
};

export const eslintConfig: TSESLint.FlatConfig.ConfigArray = pipe(
  tseslint.config(
    // eslint
    eslint.configs.recommended,
    // stylistic
    stylisticPlugin.default.configs['recommended-flat'],
    // airbnb
    ...airbnbConfig.default,
    // typescript-eslint
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    // prettier
    prettierRecommended,
    // promise
    { rules: promisePlugin.configs.recommended.rules ?? {} },
    // functional
    functionalPlugin.configs.stylistic,
    functionalPlugin.configs.externalTypeScriptRecommended,
    // security
    securityPlugin.configs.recommended,
    // spellchecking
    cspellRecommended as TSESLint.FlatConfig.Config,
    // import
    ...importConfig.default,
    /**
     * Custom deprecation rules.
     */
    {
      rules: {
        '@typescript-eslint/no-deprecated': 'error',
      },
    },
    /**
     * Custom general style rules
     */
    {
      rules: {
        // sort destructuring keys
        'sort-destructure-keys/sort-destructure-keys': 'error',
      },
    },
    // types
    {
      rules: {
        '@typescript-eslint/array-type': ['error', { default: 'generic' }],
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/no-empty-object-type': 'off',
        '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      },
    },
    // naming conventions
    {
      rules: {
        '@typescript-eslint/naming-convention': [
          'error',
          // declared globals
          ...declareGlobals(globals),
          // preferred defaults
          {
            format: [],
            leadingUnderscore: 'forbid',
            selector: 'default',
            trailingUnderscore: 'forbid',
          },
          {
            format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
            selector: 'variableLike',
          },
          { format: ['camelCase'], selector: 'function' },
          { format: ['PascalCase'], selector: 'typeLike' },
          {
            format: ['camelCase'],
            selector: 'property',
          },
          // adds PascalCase for nested types
          {
            format: ['camelCase', 'PascalCase'],
            selector: 'typeProperty',
          },
          // adds UPPER_CASE for static constants
          {
            format: ['UPPER_CASE'],
            modifiers: ['static', 'readonly', 'public'],
            selector: 'classProperty',
          },
          // remove restrictions when working with JSON objects
          {
            format: [],
            selector: 'objectLiteralProperty',
          },
          // useful for error reporting types with one ignored property
          // e.g., type MyErrorType = { _: never }
          {
            filter: { match: true, regex: '^_$' },
            format: [],
            selector: 'typeProperty',
          },
          // useful for ignored parameters
          {
            format: ['camelCase', 'PascalCase'],
            leadingUnderscore: 'allow',
            selector: 'parameter',
          },
          // Effect exception(s) to underscore rules
          {
            filter: { match: true, regex: '^(_tag)$' },
            format: [],
            selector: ['typeProperty', 'memberLike'],
          },
        ],
        // don't allow void in places it doesn't make sense
        '@typescript-eslint/no-invalid-void-type': [
          'error',
          {
            // prevent needing to bind functions that have an unused this
            allowAsThisParameter: true,
            // allow as a generic type parameter
            allowInGenericTypeArguments: true,
          },
        ],
      },
    },
    // handled by prettier
    {
      rules: {
        '@stylistic/brace-style': 'off',
        '@stylistic/indent': 'off',
        '@stylistic/indent-binary-ops': 'off',
        '@stylistic/operator-linebreak': 'off',
        '@stylistic/quotes': 'off',
        '@stylistic/semi': 'off',
      },
    },
    // misc
    {
      rules: {
        // semis preferred for types
        '@stylistic/member-delimiter-style': [
          'error',
          {
            multiline: {
              delimiter: 'semi',
              requireLast: true,
            },
            multilineDetection: 'brackets',
            singleline: {
              delimiter: 'semi',
              requireLast: false,
            },
          },
        ],
        // only require quotes when needed
        '@stylistic/quote-props': ['error', 'as-needed'],
        // match effects style conventions
        '@stylistic/yield-star-spacing': ['error', 'after'],
        // there are some situations where one is better than the other
        '@typescript-eslint/consistent-type-definitions': 'off',
        // default is on, conflicts with Effect conventions
        // e.g., const A = ...; type A = MappedType<typeof A>
        '@typescript-eslint/no-redeclare': 'off',
        // allow redeclares in different scopes
        '@typescript-eslint/no-shadow': 'off',
        // emulate TS with exceptions for names that start with _
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            args: 'all',
            argsIgnorePattern: '^_',
            caughtErrors: 'all',
            caughtErrorsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            ignoreRestSiblings: true,
            varsIgnorePattern: '^_',
          },
        ],
        // default is warn, covered by above
        'no-underscore-dangle': 'off',
      },
    },
    /**
     * Custom arrow function style enforcement rules
     */
    {
      rules: {
        // default is off
        '@stylistic/arrow-parens': ['error', 'always'],
        // default is off
        'arrow-body-style': ['error', 'as-needed'],
        // default is warn; adds exceptions for generators used by this project
        'func-names': [
          'warn',
          'always',
          {
            generators: 'never',
          },
        ],
        // default is off
        'func-style': 'error',
        // default is off
        'prefer-arrow-callback': 'error',
        // default is off
        'prefer-arrow-functions/prefer-arrow-functions': [
          'error',
          {
            disallowPrototype: true,
            returnStyle: 'implicit',
          },
        ],
      },
    },
    /**
     * Complexity rules.
     */
    {
      rules: {
        // modified to skip `describe` functions in test files
        'astal/max-lines-per-function': ['warn', { max: 25, skipBlankLines: true, skipComments: true }],
        // modified to not count `it` and `describe` functions in test files
        'astal/max-nested-callbacks': ['warn', { max: 4 }],
        complexity: ['warn', { max: 10 }],
        'max-depth': ['warn', { max: 4 }],
        'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
        'max-params': ['warn', { max: 5 }],
        'max-statements': ['warn', { max: 10 }],
      },
    },
    /**
     * Custom comment rules
     */
    // default is off; also adjusted location
    {
      rules: {
        'no-warning-comments': [
          'warn',
          {
            location: 'anywhere',
          },
        ],
      },
    },
    /**
     * Custom promise rules
     */
    {
      rules: {
        'promise/always-return': ['error', { ignoreLastCallback: true }],
      },
    },
    /**
     * Code generator rules
     */
    {
      rules: {
        'codegen/codegen': 'error',
      },
    },
    /**
     * Doc comment rules
     */
    {
      rules: {
        'tsdoc/syntax': 'warn',
      },
    },
    /**
     * Temporary rules to be fixed.
     */
    {
      rules: {
        // TODO: services may use, need to review
        '@typescript-eslint/no-this-alias': 'warn',
        // TODO: old school services may use, need to review
        'functional/prefer-property-signatures': 'off',
      },
    },
    /**
     * Custom rules.
     */
    {
      rules: {
        'astal/no-restricted-disable': [
          'error',
          {
            allowed: [/^@typescript-eslint\/naming-convention$/, /^max-classes-per-file$/, /^prettier\/prettier$/],
            'no-disable': [/.*/],
          },
        ],
      },
    },
  ),
  overrideWith(overrides),
);

export default eslintConfig;
