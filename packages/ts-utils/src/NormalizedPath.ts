import type { Brand } from 'effect';
import { Effect } from 'effect';
import ts from 'typescript';

export type NormalizedPath = NormalizedPathBrand & string;

export const TsNormalizedPath = Symbol.for('TsNormalizedPath');

export interface NormalizedPathBrand {
  [Brand.BrandTypeId]: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __normalizedPathTag: '__normalizedPathTag';
  };
  [TsNormalizedPath]: ts.server.NormalizedPath;
}

export type TsNormalizedPath = typeof TsNormalizedPath;

export const normalize: (s: string) => Effect.Effect<NormalizedPath, Error> = (s: string) =>
  Effect.try({
    catch: (cause) => new Error('Nope', { cause }),
    try: () => {
      const tsNormalizedPath = ts.server.toNormalizedPath(s);
      const normalizedPath = tsNormalizedPath as string as NormalizedPath;
      normalizedPath[TsNormalizedPath] = tsNormalizedPath;
      return normalizedPath;
    },
  });
