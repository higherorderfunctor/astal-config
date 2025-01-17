import type { Brand } from 'effect';
import { Effect, Option, pipe } from 'effect';
import ts from 'typescript';
import * as ProjectServiceError from './ProjectServiceError/index.js';

export type NormalizedPath = NormalizedPathBrand & string & TsNormalizedPath;

export const TsNormalizedPath = Symbol.for('TsNormalizedPath');

export interface NormalizedPathBrand {
  [Brand.BrandTypeId]: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __normalizedPathTag: '__normalizedPathTag';
  };
}

export type TsNormalizedPath = typeof TsNormalizedPath;

export const normalize: (s: string) => Effect.Effect<NormalizedPath, Error> = (s: string) =>
  Effect.try({
    catch: (cause) => new ProjectServiceError.PathError({ path: s, error: cause}),
    try: () => {
      const tsNormalizedPath = ts.server.toNormalizedPath(s);
      const normalizedPath = tsNormalizedPath as string as NormalizedPath;
      // NOTE: normal symbol usage behavior
      // eslint-disable-next-line security/detect-object-injection
      // normalizedPath[TsNormalizedPath] = tsNormalizedPath;
      return normalizedPath;
    },
  });

export const optional: (s?: string) => Effect.Effect<Option.Option<NormalizedPath>, Error> = (s) =>
  pipe(
    Effect.fromNullable(s),
    Effect.flatMap(normalize),
    Effect.asSome,
    Effect.catchTag('NoSuchElementException', () => Effect.succeed(Option.none())),
  );
