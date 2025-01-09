import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

// @ts-expect-error package doesn't directly export
import maxNestedCallbacks from '../../../node_modules/eslint/lib/rules/max-nested-callbacks.js';

export * as U from '@typescript-eslint/utils';

export type MessageIds = 'exceed';

type Context = Readonly<TSESLint.RuleContext<'exceed', Options>>;

const originalMaxNestedCallbacks = maxNestedCallbacks as TSESLint.RuleModule<'exceed', Options>;

type Options = [
  {
    max?: number;
  },
];

/**
 * Don't count `it` and `describe` functions in test files.
 */
const checkFunction =
  <N extends TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression>(
    context: Context,
    cb: TSESLint.RuleFunction<N>,
  ) =>
  (node: N) => {
    (!(
      /\.test.ts$/.test(context.filename) &&
      node.parent.type === ('CallExpression' as TSESTree.AST_NODE_TYPES.CallExpression) &&
      node.parent.callee.type === ('Identifier' as TSESTree.AST_NODE_TYPES.Identifier) &&
      (node.parent.callee.name === 'it' || node.parent.callee.name === 'describe')
    )
      ? cb
      : // eslint-disable-next-line @typescript-eslint/no-empty-function
        (_: typeof node) => {})(node);
  };

export const maxNestedCallbacksRule = ESLintUtils.RuleCreator.withoutDocs<Options, MessageIds>({
  create: (context) => {
    const originalContext = originalMaxNestedCallbacks.create(context);
    return {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      ArrowFunctionExpression: checkFunction(context, originalContext.ArrowFunctionExpression ?? (() => {})),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      'ArrowFunctionExpression:exit': originalContext['ArrowFunctionExpression:exit'] ?? (() => {}),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      FunctionExpression: checkFunction(context, originalContext.FunctionExpression ?? (() => {})),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      'FunctionExpression:exit': originalContext['FunctionExpression:exit'] ?? (() => {}),
    };
  },
  defaultOptions: [
    {
      max: 4,
    },
  ],
  meta: originalMaxNestedCallbacks.meta,
});
