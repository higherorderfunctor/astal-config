declare module 'eslint-config-airbnb-typescript' {
  import type { TSESLint } from '@typescript-eslint/utils';

  const config: TSESLint.FlatConfig.Config;
  export default config;
}

declare module 'eslint-config-airbnb-typescript/lib/shared' {
  import type { TSESLint } from '@typescript-eslint/utils';

  const config: TSESLint.FlatConfig.Config;
  export default config;
}
