import type { TSESLint } from '@typescript-eslint/utils';
import { pipe } from 'effect';
import jsoncPlugin from 'eslint-plugin-jsonc';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import jsoncParser from 'jsonc-eslint-parser';
import tseslint from 'typescript-eslint';

import { overrideWith } from '../../overrideHelpers.js';

export const plugins: TSESLint.FlatConfig.Plugins = {
  jsonc: jsoncPlugin,
  prettier: prettierPlugin,
};

export const overrides: Partial<TSESLint.FlatConfig.Config> = {
  languageOptions: {
    parser: jsoncParser,
  },
  plugins,
};

export const eslintConfig: TSESLint.FlatConfig.ConfigArray = pipe(
  tseslint.config(
    prettierRecommended,
    ...(jsoncPlugin.configs['flat/recommended-with-jsonc'] as TSESLint.FlatConfig.ConfigArray),
    // disables rules that conflict with prettier
    ...(jsoncPlugin.configs['flat/prettier'] as TSESLint.FlatConfig.ConfigArray),
  ),
  overrideWith(overrides),
);

export default eslintConfig;
