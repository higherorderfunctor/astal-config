declare module 'eslint-plugin-markdown' {
  import type { TSESLint } from '@typescript-eslint/utils';

  const plugin: { configs: TSESLint.FlatConfig.SharedConfigs };
  export default plugin;
}
