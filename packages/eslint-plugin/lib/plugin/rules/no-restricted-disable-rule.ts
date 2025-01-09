import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';
import { pipe } from 'effect';

export * as U from '@typescript-eslint/utils';

export type MessageIds = 'noRestrictedDisable';

type Context = Readonly<TSESLint.RuleContext<'noRestrictedDisable', Options>>;

type Options = [
  {
    allowed: Array<RegExp>;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'no-disable': Array<RegExp>;
  },
];

const getAllComments = (context: Context): Array<TSESTree.Comment> => context.sourceCode.getAllComments();

const extractDisabledRules = (comment: TSESTree.Comment) =>
  pipe(comment.value.trim(), (commentText) =>
    commentText.startsWith('eslint-disable ')
      ? commentText
          .replace('eslint-disable', '')
          .split(',')
          .map((rule) => rule.trim())
      : [],
  );

const isRuleRestricted: (options: { allowedRules: Array<RegExp>; disabledRule: string }) => boolean = ({
  allowedRules,
  disabledRule,
}) => !allowedRules.some((allowedRule) => allowedRule.test(disabledRule));

const reportRestrictedDisable: (options: {
  comment: TSESTree.Comment;
  context: Context;
  disabledRule: string;
}) => void = ({ comment, context, disabledRule }) => {
  context.report({
    data: { rule: disabledRule },
    messageId: 'noRestrictedDisable',
    node: comment,
  });
};

export const noRestrictedDisableRule = ESLintUtils.RuleCreator.withoutDocs<Options, MessageIds>({
  create: (context) => {
    const restrictedRules = context.options[0]['no-disable'];
    const allowedRules = context.options[0].allowed;
    return {
      Program: () => {
        getAllComments(context).forEach((comment) => {
          const disabledRules = extractDisabledRules(comment);
          disabledRules.forEach((disabledRule) => {
            if (isRuleRestricted({ allowedRules, disabledRule })) {
              restrictedRules.forEach((restrictedRule) => {
                if (restrictedRule.test(disabledRule)) {
                  reportRestrictedDisable({ comment, context, disabledRule });
                }
              });
            }
          });
        });
      },
    };
  },
  defaultOptions: [{ allowed: [], 'no-disable': [] }],
  meta: {
    docs: {
      description: 'Restricts the use of eslint-disable comments',
    },
    messages: {
      noRestrictedDisable: "No restricted disable: '{{rule}}'.",
    },
    schema: [
      {
        properties: {
          allowed: { items: { type: 'object' }, type: 'array' },
          'no-disable': {
            items: { type: 'object' },
            type: 'array',
          },
        },
        type: 'object',
      },
    ],
    type: 'problem',
  },
});
