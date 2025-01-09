declare module 'eslint-plugin-promise' {
  import type { TSESLint } from '@typescript-eslint/utils';

  const plugin: { configs: { recommended: TSESLint.FlatConfig.Config } } & TSESLint.FlatConfig.Plugin;
  export default plugin;
}
