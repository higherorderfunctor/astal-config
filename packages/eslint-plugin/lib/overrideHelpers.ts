import type { TSESLint } from '@typescript-eslint/utils';
import { Array, Record } from 'effect';
import { dual } from 'effect/Function';

const hotfixes = Array.map<TSESLint.FlatConfig.ConfigArray, TSESLint.FlatConfig.Config>(
  (config: TSESLint.FlatConfig.Config) => {
    const { import: string, ...plugins } = config.plugins ?? {};
    return {
      ...config,
      plugins,
      rules: Record.fromEntries(
        Record.toEntries(config.rules ?? {}).map(([key, value]) => {
          if (key.startsWith('import/')) {
            return [key.replace(/^import\//, 'import-x/'), value] as const;
          }
          return [key, value] as const;
        }),
      ),
    };
  },
);

export const overrideWith: {
  (
    overrides: Partial<TSESLint.FlatConfig.Config>,
  ): (configs: TSESLint.FlatConfig.ConfigArray) => TSESLint.FlatConfig.ConfigArray;
  (
    configs: TSESLint.FlatConfig.ConfigArray,
    overrides: Partial<TSESLint.FlatConfig.Config>,
  ): TSESLint.FlatConfig.ConfigArray;
} = dual(
  2,
  (
    configs: TSESLint.FlatConfig.ConfigArray,
    overrides: Partial<TSESLint.FlatConfig.Config>,
  ): TSESLint.FlatConfig.ConfigArray => {
    const { ...config } = Array.reduce(
      configs,
      { plugins: {}, rules: {} } as TSESLint.FlatConfig.Config,
      (acc, config) => ({
        ...acc,
        ...config,
        plugins: { ...acc.plugins, ...config.plugins },
        rules: { ...acc.rules, ...config.rules },
      }),
    );
    return hotfixes([
      {
        ...config,
        ...overrides,
        plugins: { ...config.plugins, ...overrides.plugins },
        rules: { ...config.rules },
      },
    ]);
  },
);

export const declareGlobals = (globals: ReadonlyArray<string>) => {
  if (Array.isEmptyReadonlyArray(globals)) {
    return [];
  }
  return [
    {
      filter: {
        match: true,
        regex: `^(${globals.join('|')})$`,
      },
      format: [],
      modifiers: ['const'], // global doesn't work in a `declare global` block
      selector: 'variable',
    },
  ];
};
