import { maxLinesPerFunctionRule } from './max-lines-per-function-rule.js';
import { maxNestedCallbacksRule } from './max-nested-callbacks.js';
import { noRestrictedDisableRule } from './no-restricted-disable-rule.js';

export const rules = {
  'max-lines-per-function': maxLinesPerFunctionRule,
  'max-nested-callbacks': maxNestedCallbacksRule,
  'no-restricted-disable': noRestrictedDisableRule,
};
