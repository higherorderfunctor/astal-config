import * as catppuccin from '@catppuccin/palette';
import type { Ansi } from '@effect/printer-ansi';
import { AnsiDoc } from '@effect/printer-ansi';
import Bun from 'bun';
import { Array, Effect, Function, LogLevel as _LogLevel, Option, pipe, Record } from 'effect';

import * as PaletteError from './PaletteError/index.js';

export type DocTransformer = (self: AnsiDoc.AnsiDoc) => AnsiDoc.AnsiDoc;

export interface Hsl {
  h: number;
  l: number;
  s: number;
}

export type HslTransformer = (self: Hsl) => Hsl;

export namespace Options {
  export interface HslOptions {
    transform?: HslTransformer | undefined;
  }
}

const reset: AnsiDoc.Doc<never> = AnsiDoc.text(`\u001B[39m`);

type Format =
  | 'ansi-16'
  | 'ansi-16m'
  | 'ansi-256'
  | 'ansi'
  | 'css'
  | 'hex'
  | 'HEX'
  | 'hsl'
  | 'lab'
  | 'number'
  | 'rgb'
  | 'rgba';

const color: {
  (format?: Format): (self: Bun.ColorInput) => null | string;
  (self: Bun.ColorInput, format?: Format): null | string;
} = Function.dual(2, (input: Bun.ColorInput, format?: Format): null | string => Bun.color(input, format));

const hsl: {
  (options?: Options.HslOptions): (hsl: Hsl) => Effect.Effect<DocTransformer, PaletteError.HslError>;
  (hsl: Hsl, options?: Options.HslOptions): Effect.Effect<DocTransformer, PaletteError.HslError>;
} = Function.dual(
  2,
  (hsl: Hsl, options?: Options.HslOptions): Effect.Effect<DocTransformer, PaletteError.HslError> =>
    pipe(
      Option.fromNullable(options?.transform),
      Option.ap(Option.some(hsl)),
      Option.getOrElse(() => hsl),
      ({ h, l, s }) => `hsl(${h.toString(10)}, ${(s * 100).toString(10)}%, ${(l * 100).toString(10)}%)`,
      (input) =>
        pipe(
          color(input, 'ansi'),
          Option.fromNullable,
          Effect.mapError((error) => new PaletteError.HslError({ error: error.message, hsl, input })),
        ),
      Effect.map((left) => AnsiDoc.surround<never, never, Ansi.Ansi>(AnsiDoc.text(left), reset)),
    ),
);

export type Colors<T> = catppuccin.Colors<T>;

export const make: (
  transform?: HslTransformer,
) => Effect.Effect<Colors<DocTransformer>, PaletteError.PaletteColorError> = (transform) =>
  pipe(
    catppuccin.flavors.mocha.colors,
    Record.toEntries,
    Effect.partition(([name, color]) =>
      pipe(
        Option.fromNullable(transform),
        Option.ap(Option.some(color.hsl)),
        Option.getOrElse((): Hsl => color.hsl),
        hsl,
        Effect.mapBoth({
          onFailure: (error) => [name, error] as const,
          onSuccess: (transformer) => [name, transformer] as const,
        }),
      ),
    ),
    Effect.flatMap(([excluded, satisfying]) =>
      Array.isNonEmptyArray(excluded)
        ? Effect.fail(new PaletteError.PaletteColorError({ errors: Record.fromEntries(excluded) }))
        : Effect.succeed(Record.fromEntries(satisfying) as Colors<DocTransformer>),
    ),
  );
