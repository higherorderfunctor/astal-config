import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

// @ts-expect-error package doesn't directly export
import maxLinesPerFunction from '../../../node_modules/eslint/lib/rules/max-lines-per-function.js';

export * as U from '@typescript-eslint/utils';

export type MessageIds = 'exceed';

type Context = Readonly<TSESLint.RuleContext<'exceed', Options>>;

const originalMaxLinesPerFunction = maxLinesPerFunction as TSESLint.RuleModule<'exceed', Options>;

type Options = [
  {
    IIFEs?: boolean;
    max?: number;
    skipBlankLines?: boolean;
    skipComments?: boolean;
  },
];

/**
 * Don't count `describe` functions in test files.
 */
const checkFunctionName =
  <N extends TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression>(
    context: Context,
    cb: TSESLint.RuleFunction<N>,
  ) =>
  (node: N) => {
    (/\.test.ts$/.test(context.filename) &&
      ('CallExpression' as TSESTree.AST_NODE_TYPES.CallExpression) === node.parent.type &&
      ('Identifier' as TSESTree.AST_NODE_TYPES.Identifier) === node.parent.callee.type &&
      node.parent.callee.name === 'describe'
      ? // eslint-disable-next-line @typescript-eslint/no-empty-function
        (_: typeof node) => {}
      : cb)(node);
  };

export const maxLinesPerFunctionRule = ESLintUtils.RuleCreator.withoutDocs<Options, MessageIds>({
  create: (context) => {
    const originalContext = originalMaxLinesPerFunction.create(context);
    return {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      ArrowFunctionExpression: checkFunctionName(context, originalContext.ArrowFunctionExpression ?? (() => {})),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      FunctionDeclaration: checkFunctionName(context, originalContext.FunctionDeclaration ?? (() => {})),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      FunctionExpression: checkFunctionName(context, originalContext.FunctionExpression ?? (() => {})),
    };
  },
  defaultOptions: [
    {
      IIFEs: false,
      max: 50,
      skipBlankLines: true,
      skipComments: true,
    },
  ],
  meta: originalMaxLinesPerFunction.meta,
});
