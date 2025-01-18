import type { Brand } from 'effect';
import { Effect, Option, pipe } from 'effect';
import ts from 'typescript';

import * as ProjectServiceError from './ProjectServiceError/index.js';

export type NormalizedPath = NormalizedPathBrand & string & TsNormalizedPathBrand;

export interface NormalizedPathBrand {
  [Brand.BrandTypeId]: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __normalizedPathTag: '__normalizedPathTag';
  };
}

export interface TsNormalizedPathBrand {
  __normalizedPathTag: '__normalizedPathTag';
}

export const normalize: (s: string) => Effect.Effect<NormalizedPath, Error> = (s: string) =>
  Effect.try({
    catch: (cause) => new ProjectServiceError.PathError({ error: cause, path: s }),
    try: () => {
      const tsNormalizedPath = ts.server.toNormalizedPath(s);
      const normalizedPath = tsNormalizedPath as string as NormalizedPath;
      // NOTE: normal symbol usage behavior

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
