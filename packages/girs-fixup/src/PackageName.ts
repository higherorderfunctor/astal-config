import { Path } from '@effect/platform';
import { Effect, ParseResult, pipe, Schema as S } from 'effect';

import * as Error from './Error/index.js';

export const PackageName = S.Struct({
  absolutePath: S.URLFromSelf,
  ext: S.Literal('d.ts'),
  module: S.NonEmptyTrimmedString,
  scope: S.optionalWith(S.Literal('astal', 'girs'), { default: () => 'girs' }),
});

export interface PackageName extends S.Schema.Type<typeof PackageName> {}

export const fromDts = (file: string) =>
  Effect.Do.pipe(
    Effect.bind('path', () => Path.Path),
    Effect.bind('filename', ({ path }) => Effect.succeed(path.basename(file))),
    Effect.bind('absolutePath', ({ path }) => pipe(path.normalize(file), path.toFileUrl)),
    Effect.flatMap(
      ({ absolutePath, filename }): Effect.Effect<PackageName, ParseResult.ParseError> =>
        S.decodeUnknown(PackageName)({
          absolutePath,
          .../^(?<scope>astal)?(?<module>.+)\.(?<ext>d\.ts)$/.exec(filename)?.groups,
        }),
    ),
    Effect.catchTags({
      BadArgument: ({ message, method, module }) => Error.invalidValue(message, { method, module }),
      ParseError: ({ issue }) =>
        ParseResult.TreeFormatter.formatIssue(issue).pipe(
          Effect.flatMap((formatted) => Error.invalidValue('Parse error', { file }, formatted)),
        ),
    }),
  );
