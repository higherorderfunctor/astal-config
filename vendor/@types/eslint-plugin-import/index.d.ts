declare module 'eslint-plugin-import' {
  import type { FixupPluginDefinition } from '@eslint/compat';
  import type { TSESLint } from '@typescript-eslint/utils';

  const plugin: {
    configs: { recommended: TSESLint.FlatConfig.Config; typescript: TSESLint.FlatConfig.Config };
  } & FixupPluginDefinition;
  export default plugin;
}
