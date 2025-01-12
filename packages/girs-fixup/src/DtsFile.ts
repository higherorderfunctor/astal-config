import { Path } from '@effect/platform';
import { type PlatformError, PlatformErrorTypeId } from '@effect/platform/Error';
import { Effect, Inspectable, ParseResult, pipe, Schema as S } from 'effect';

import * as Error from './Error/index.js';

export class DtsFile
  extends S.Class<DtsFile>('DtsFile')({
    absolutePath: S.NonEmptyTrimmedString, // TODO: valid path
    ext: S.Literal('d.ts'),
    module: S.NonEmptyTrimmedString,
    scope: S.optionalWith(S.Literal('astal', 'girs', ''), { default: () => 'girs' }),
  })
  implements Inspectable.Inspectable
{
  [Inspectable.NodeInspectSymbol]() {
    return this.toString();
  }

  toJSON() {
    const { absolutePath, ext, module, scope } = this;
    return {
      absolutePath,
      ext,
      module,
      scope,
    };
  }

  toString() {
    return `DtsFile: ${Inspectable.stringifyCircular(this.toJSON(), 2)}`;
  }
}

export const fromDts = (file: string) =>
  Effect.Do.pipe(
    Effect.bind('path', () => Path.Path),
    Effect.bind('filename', ({ path }) => Effect.succeed(path.basename(file))),
    Effect.bind('absolutePath', ({ path }) =>
      pipe(
        path.normalize(file),
        Effect.liftPredicate(
          path.isAbsolute,
          (): PlatformError => ({
            _tag: 'BadArgument',
            message: 'Path must be absolute',
            method: 'isAbsolute',
            module: 'Path',
            [PlatformErrorTypeId]: PlatformErrorTypeId,
          }),
        ),
        (v) => v,
      ),
    ),
    Effect.flatMap(
      ({ absolutePath, filename }): Effect.Effect<DtsFile, ParseResult.ParseError> =>
        S.decodeUnknown(DtsFile)({
          absolutePath,
          .../^((?<scope>)(?<module>astal-.+)|(?<scope>astal)?(?<module>.+))\.(?<ext>d\.ts)$/.exec(filename)?.groups,
        }),
    ),
    Effect.catchTags({
      // BadArgument: ({ message, method, module }) => Error.invalidValue(message, { method, module }),
      ParseError: ({ issue }) =>
        ParseResult.TreeFormatter.formatIssue(issue).pipe(
          Effect.flatMap((formatted) => Error.invalidValue('Parse error', { file }, formatted)),
        ),
    }),
  );
