import type { TSESLint } from '@typescript-eslint/utils';

import { rules } from './rules/index.js';

const eslintPlugin: TSESLint.FlatConfig.Plugin = {
  rules,
};

export default eslintPlugin;
