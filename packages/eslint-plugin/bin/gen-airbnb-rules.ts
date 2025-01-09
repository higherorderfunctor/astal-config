#!/usr/bin/env bun
import { FileSystem, Path } from '@effect/platform';
import { BunContext } from '@effect/platform-bun';
import type { TSESLint } from '@typescript-eslint/utils';
import { Array, Cause, Effect, flow, Inspectable, Logger, pipe, Record } from 'effect';
import airbnb from 'eslint-config-airbnb-base';
import airbnbWhitespace from 'eslint-config-airbnb-base/whitespace';
import airbnbTypescript from 'eslint-config-airbnb-typescript/lib/shared';

const getAirbnbRules = (): TSESLint.FlatConfig.ConfigArray => [airbnb, airbnbWhitespace, airbnbTypescript];

const fixKey = (key: string) => {
  switch (key) {
    case '@typescript-eslint/brace-style':
      return '@stylistic/brace-style';
    case '@typescript-eslint/comma-dangle':
      return '@stylistic/comma-dangle';
    case '@typescript-eslint/func-call-spacing':
      return '@stylistic/function-call-spacing';
    case '@typescript-eslint/indent':
      return '@stylistic/indent';
    case '@typescript-eslint/keyword-spacing':
      return '@stylistic/keyword-spacing';
    case '@typescript-eslint/lines-between-class-members':
      return '@stylistic/lines-between-class-members';
    case '@typescript-eslint/no-extra-semi':
      return '@stylistic/no-extra-semi';
    case '@typescript-eslint/no-throw-literal':
      return '@typescript-eslint/only-throw-error';
    case '@typescript-eslint/space-before-blocks':
      return '@stylistic/space-before-blocks';
    default:
      return key;
  }
};

const foldRules = (configs: TSESLint.FlatConfig.ConfigArray): TSESLint.FlatConfig.Config => ({
  rules: Array.reduce(configs, {} as TSESLint.FlatConfig.Rules, (acc, config) => ({
    ...acc,
    ...Record.mapKeys(config.rules ?? {}, fixKey),
  })),
});

Effect.runPromise(
  Effect.Do.pipe(
    Effect.bind('airbnb', () =>
      pipe(getAirbnbRules(), foldRules, (_) => Inspectable.stringifyCircular(_, 2), Effect.succeed),
    ),
    Effect.bind('fs', () => FileSystem.FileSystem),
    Effect.bind('path', () => Path.Path),
    Effect.flatMap(({ airbnb, fs, path }) =>
      fs.writeFileString(path.resolve(import.meta.dirname, '../lib/configs/airbnb.json'), airbnb),
    ),
    Effect.catchAllCause(flow(Cause.pretty, Effect.logFatal)),
    Effect.orDie,
    Effect.provide(BunContext.layer),
    Effect.provide(Logger.pretty),
  ),
).catch(globalThis.console.error.bind(globalThis.console));
