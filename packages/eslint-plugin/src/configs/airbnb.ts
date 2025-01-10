import type { TSESLint } from '@typescript-eslint/utils';
import { pipe } from 'effect';
import importPlugin from 'eslint-plugin-import-x';
import * as tseslint from 'typescript-eslint';

import { overrideWith } from '../overrideHelpers.js';
import * as settings from '../settings/index.js';
import airbnb from './airbnb.json' with { type: 'json' };

export const plugins: TSESLint.FlatConfig.Plugins = {
  '@typescript-eslint': tseslint.plugin,
  'import-x': importPlugin,
};

export const overrides: Partial<TSESLint.FlatConfig.Config> = {
  plugins,
  settings: settings.typescript,
};

const eslintConfig: TSESLint.FlatConfig.ConfigArray = pipe(
  [airbnb as unknown as TSESLint.FlatConfig.Config],
  overrideWith(overrides),
);

export default eslintConfig;
