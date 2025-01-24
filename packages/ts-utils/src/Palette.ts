import * as catppuccin from '@catppuccin/palette';
import type { Ansi } from '@effect/printer-ansi';
import { AnsiDoc } from '@effect/printer-ansi';
import Bun from 'bun';
import { Array, Effect, Function, LogLevel as _LogLevel, Option, pipe, Record, Schema as S } from 'effect';

import * as PaletteError from './PaletteError/index.js';
import * as Range from './Range.js';

export type Color = Color.Hsl | Color.Rgb;

export type DocTransformer = (self: AnsiDoc.AnsiDoc) => AnsiDoc.AnsiDoc;

export namespace Color {
  export const Hsl: S.Schema<Hsl, { h: number; l: number; s: number }> = S.Struct({
    h: Range.Range(0, 360),
    l: Range.Percent,
    s: Range.Percent,
  });

  export interface Hsl<
    H extends Range.Range<0, 360> = Range.Range<0, 360>,
    S extends Range.Percent = Range.Percent,
    L extends Range.Percent = Range.Percent,
  > {
    h: H;
    l: L;
    s: S;
  }

  export const Rgb: S.Schema<Rgb, { b: number; g: number; r: number }> = S.Struct({
    b: Range.IntRange(0, 256),
    g: Range.IntRange(0, 256),
    r: Range.IntRange(0, 256),
  }).pipe(S.asSchema);

  export type Color = Hsl | Rgb;

  export interface Rgb<
    R extends Range.IntRange<0, 256> = Range.IntRange<0, 256>,
    G extends Range.IntRange<0, 256> = Range.IntRange<0, 256>,
    B extends Range.IntRange<0, 256> = Range.IntRange<0, 256>,
  > {
    b: B;
    g: G;
    r: R;
  }

  export const HslLiteral = <H extends Range.Range<0, 360>, S extends Range.Percent, L extends Range.Percent>({
    h,
    l,
    s,
  }: Hsl<H, S, L>): S.Schema<HslLiteral<H, S, L>, string> =>
    S.TemplateLiteralParser(
      'hsl(',
      S.NumberFromString.pipe(S.compose(S.Literal(h))),
      ', ',
      S.NumberFromString.pipe(S.compose(S.Literal(s))),
      '%, ',
      S.NumberFromString.pipe(S.compose(S.Literal(l))),
      '%)',
    ) as any;

  type HslLiteral<
    H extends Range.Range<0, 360>,
    S extends Range.Normalized<100>,
    L extends Range.Normalized<100>,
  > = `hsl(${H}, ${S}%,  ${L}%)`;

export const HslFromString =
<H extends Range.Range<0, 360>, S extends Range.Percent, L extends Range.Percent>({
    h,
    l,
    s,
  }: Hsl<H, S, L>) =>
  S.transform(
      HslLiteral({h, l, s})
  Hsl({h, l, s}p,
  {
    decode: ([_1, h, _2, s, _3, l]) => ({ h, l, s }),
    encode: (_, { h, l, s }) => `hsl(${h}", ${s}%, ${l}%)`,
    strict: true,
  },
).pipe((v) => v);

  // export const lighten = (self: Color.Color, amount: number): Color.Color =>
  //   pipe(Effect.fromNullable(color(self, 'hsl')), (v) => v);
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
