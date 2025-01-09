import type { TSESLint } from '@typescript-eslint/utils';
import { pipe } from 'effect';
import codegenPlugin, { processors as codegenPluginProcessors } from 'eslint-plugin-codegen';
import markdownPlugin from 'eslint-plugin-markdown';
import tseslint from 'typescript-eslint';

import { overrideWith } from '../../overrideHelpers.js';

const plugins: TSESLint.FlatConfig.Plugins = {
  codegen: codegenPlugin,
  markdown: markdownPlugin as TSESLint.FlatConfig.Plugin,
};

const overrides: Partial<TSESLint.FlatConfig.Config> = {
  // TODO: code examples in markdown
  ignores: ['**/*.md/**'],
  plugins,
  processor: {
    ...codegenPluginProcessors.processor,
    // hack for eslint --cache to work
    meta: {
      name: 'eslint-plugin-codegen-md-processor',
      version: (markdownPlugin as { version: string } & TSESLint.FlatConfig.Plugin).version,
    },
  },
};

const eslintConfig: TSESLint.FlatConfig.ConfigArray = pipe(
  tseslint.config(...(markdownPlugin.configs.recommended as TSESLint.FlatConfig.ConfigArray), {
    rules: { 'codegen/codegen': 'error' },
  }),
  overrideWith(overrides),
);

export default eslintConfig;
