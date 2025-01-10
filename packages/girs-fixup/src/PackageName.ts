import { HelpDoc, ValidationError } from '@effect/cli';
import { Effect, ParseResult, Schema as S } from 'effect';

export const PackageName = S.Struct({
  ext: S.Literal('d.ts'),
  packageName: S.NonEmptyTrimmedString,
  scope: S.optionalWith(S.Literal('astal', 'girs'), { default: () => 'girs' }),
});

export interface PackageName extends S.Schema.Type<typeof PackageName> {}

export const make = (filename: string): Effect.Effect<PackageName, ValidationError.ValidationError> =>
  S.decodeUnknown(PackageName)(/^(?<scope>astal)?(?<packageName>.+)\.(?<ext>d\.ts)$/.exec(filename)?.groups).pipe(
    Effect.catchAll(({ issue }) =>
      ParseResult.TreeFormatter.formatIssue(issue).pipe(
        Effect.map((error) => HelpDoc.sequence(HelpDoc.p(`Filename: ${filename}`), HelpDoc.p(error))),
        Effect.map(ValidationError.invalidValue),
        Effect.flip,
      ),
    ),
  );
