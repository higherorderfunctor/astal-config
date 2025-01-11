import { HelpDoc, ValidationError } from '@effect/cli';
import { Path } from '@effect/platform';
import { Effect, ParseResult, pipe, Schema as S } from 'effect';

export const PackageName = S.Struct({
  absolutePath: S.URLFromSelf,
  ext: S.Literal('d.ts'),
  module: S.NonEmptyTrimmedString,
  scope: S.optionalWith(S.Literal('astal', 'girs'), { default: () => 'girs' }),
});

export interface PackageName extends S.Schema.Type<typeof PackageName> {}

export const fromDts = (file: string): Effect.Effect<PackageName, ValidationError.ValidationError> =>
  Effect.Do.pipe(
    Effect.bind('path', () => Path.Path),
    Effect.bind('filename', ({ path }) => Effect.succeed(path.basename(file))),
    Effect.bind('absolutePath', ({ path }) => pipe(path.normalize(file), path.toFileUrl)),
    Effect.flatMap(({ absolutePath, filename }) =>
      S.decodeUnknown(PackageName)({
        absolutePath,
        .../^(?<scope>astal)?(?<module>.+)\.(?<ext>d\.ts)$/.exec(filename)?.groups,
      }),
    ),
    (v) => v,
    Effect.catchTags({
      BadArgument: (error) => 
          HelpDoc.sequence(HelpDoc.p(`File: ${file}`), HelpDoc.p(error))),
          // Effect.map(ValidationError.invalidValue),
          // Effect.flip,
        //),
      ParseError: ({ issue }) =>
        ParseResult.TreeFormatter.formatIssue(issue).pipe(
          Effect.map((error) => HelpDoc.sequence(HelpDoc.p(`File: ${file}`), HelpDoc.p(error))),
          Effect.map(ValidationError.invalidValue),
          Effect.flip,
        ),
    }),
  );
