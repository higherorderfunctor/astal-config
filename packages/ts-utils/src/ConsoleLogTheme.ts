import { Ansi, AnsiDoc } from '@effect/printer-ansi';
import { DateTime, Duration, Effect, flow, LogLevel as _LogLevel, Option, pipe, Predicate } from 'effect';

import type * as Logger from './Logger.js';
import * as LogLevel from './LogLevel.js';
import * as Palette from './Palette.js';
import type * as PaletteError from './PaletteError/index.js';

namespace Colorscheme {
  export const regular: Effect.Effect<
    Palette.Colors<Palette.DocTransformer>,
    PaletteError.PaletteColorError
  > = Palette.make();

  export const light: Effect.Effect<
    Palette.Colors<Palette.DocTransformer>,
    PaletteError.PaletteColorError
  > = Palette.make(({ h, l, s }) => ({ h, l: l * 0.2, s }));

  export const dark: Effect.Effect<
    Palette.Colors<Palette.DocTransformer>,
    PaletteError.PaletteColorError
  > = Palette.make(({ h, l, s }) => ({ h, l: l * 1.2, s }));

  export const logLevel: Effect.Effect<
    LogLevel.LogLevels<Palette.DocTransformer>,
    PaletteError.PaletteColorError
  > = pipe(
    regular,
    Effect.map((palette) => ({
      [LogLevel.All.label]: palette.red,
      [LogLevel.Debug.label]: palette.subtext1,
      [LogLevel.Error.label]: palette.pink,
      [LogLevel.Fatal.label]: palette.red,
      [LogLevel.Info.label]: palette.green,
      [LogLevel.None.label]: palette.subtext0,
      [LogLevel.Trace.label]: palette.subtext0,
      [LogLevel.Warning.label]: palette.yellow,
    })),
  );

  export const message: Effect.Effect<
    LogLevel.LogLevels<Palette.DocTransformer>,
    PaletteError.PaletteColorError
  > = pipe(
    dark,
    Effect.map((palette) => ({
      [LogLevel.All.label]: palette.red,
      [LogLevel.Debug.label]: palette.subtext1,
      [LogLevel.Error.label]: palette.pink,
      [LogLevel.Fatal.label]: palette.red,
      [LogLevel.Info.label]: palette.green,
      [LogLevel.None.label]: palette.subtext0,
      [LogLevel.Trace.label]: palette.subtext0,
      [LogLevel.Warning.label]: palette.yellow,
    })),
  );
}

export namespace style {
  export type Apply<E = never, R = never> = Effect.Effect<
    (self: AnsiDoc.AnsiDoc, options: Logger.Logger.Options<string>) => AnsiDoc.AnsiDoc,
    E,
    R
  >;

  const apply: {
    // overload 1
    <E = never, R = never>(
      f: (self: AnsiDoc.AnsiDoc, options: Logger.Logger.Options<string>) => AnsiDoc.AnsiDoc,
    ): Apply<E, R>;
    // overload 2
    <A = never, E = never, R = never>(
      f: (self: AnsiDoc.AnsiDoc, options: Logger.Logger.Options<string>, use: A) => AnsiDoc.AnsiDoc,
      use: Effect.Effect<A, E, R>,
    ): Apply<E, R>;
  } =
    // implementation
    <A = never, E = never, R = never>(
      f: (self: AnsiDoc.AnsiDoc, options: Logger.Logger.Options<string>, use?: A) => AnsiDoc.AnsiDoc,
      use?: Effect.Effect<A, E, R>,
    ): Apply<E, R> =>
      pipe(
        Effect.liftPredicate(use, Predicate.isNotUndefined, () => Effect.succeed(null)),
        Effect.merge,
        Effect.flatten,
        Effect.map(
          (use) => (self: AnsiDoc.AnsiDoc, options: Logger.Logger.Options<string>) =>
            use ? f(self, options, use) : f(self, options),
        ),
      );

  export const timestamp = apply(AnsiDoc.annotate(Ansi.bold));
  export const logLevel = apply(
    (self, options, colorscheme) =>
      pipe(colorscheme[options.logLevel.label](self), AnsiDoc.annotate(Ansi.bold), AnsiDoc.annotate(Ansi.italicized)),
    Colorscheme.logLevel,
  );
  export const message = apply(
    (self, options, colorscheme) => pipe(colorscheme[options.logLevel.label](self)),
    Colorscheme.message,
  );

  // theme.style.annotations.metrics.distance.apply(distance),
  // AnsiDoc.annotate(Ansi.bold),
}

namespace format {
  export const logLevel: (options: { logLevel: LogLevel.LogLevel }) => AnsiDoc.Doc<never> = (options) =>
    AnsiDoc.text(options.logLevel.label);
  export const timestamp: (options: { date: Date }) => AnsiDoc.Doc<never> = (options) =>
    pipe(options.date, DateTime.unsafeFromDate, DateTime.formatIso, AnsiDoc.text);
  export const message: (options: { message: string }) => AnsiDoc.Doc<never> = (options) =>
    pipe(options.message, AnsiDoc.text);

  export namespace annotations {
    export namespace logger {
      export namespace metrics {
        export namespace distance {
          export const format = (options: {
            metrics: { distance: Option.Option<Duration.Duration> };
          }): AnsiDoc.AnsiDoc =>
            pipe(
              Option.map(options.metrics.distance, (distance) =>
                pipe(
                  // default effect formatter excludes the ms on 0
                  Option.liftPredicate(distance, Predicate.not(Duration.isZero)),
                  Option.map(flow(Duration.format, AnsiDoc.text)),
                  Option.getOrElse(() => AnsiDoc.text('0ms')),
                  (_) => AnsiDoc.hcat([AnsiDoc.text('+'), _]),
                  AnsiDoc.parenthesized,
                ),
              ),
              Option.getOrElse(() => AnsiDoc.empty),
            );
        }
      }
    }
  }
}

export class LogTheme extends Effect.Service<LogTheme>()('LogTheme', {
  accessors: true,
  effect: Effect.gen(function* () {
    return {
      format,
      style: yield* Effect.all({
        logLevel: style.logLevel,
        message: style.message,
        timestamp: style.timestamp,
      }),
    };
  }),
}) {}

//
//
//   // export namespace annotations {
//   //   export namespace metrics {
//   //     export namespace distance {
//   //       export const fast = palette.yellow;
//   //       export const slow = palette.peach;
//   //       export const fastest = palette.green;
//   //       export const slowest = palette.red;
//   //       export const zero = palette.surface1;
//   //       export const apply: (duration: Duration.Duration) => Annotate = Match.type<Duration.Duration>().pipe(
//   //         Match.when(Duration.isZero, (_) => zero),
//   //         Match.when(Duration.lessThan(4), () => fastest),
//   //         Match.when(Duration.lessThan(8), () => fast),
//   //         Match.when(Duration.lessThan(12), () => slow),
//   //         Match.when(Duration.greaterThanOrEqualTo(12), () => slowest),
//   //         Match.orElse((): Annotate => (doc) => doc),
//   //       );
//   //     }
//   //   }
//   // }
// }
//
// ////  export const LoggerAnnotations = S.Struct({ metrics: S.Struct({ distance: S.OptionFromSelf(S.DurationFromSelf) }) });
// ////
// ////  export type LoggerAnnotations = S.Schema.Type<typeof LoggerAnnotations>;
// ////
// ////  export const parseLoggerAnnotations: <K, V>(self: HashMap.HashMap<K, V>) => Option.Option<LoggerAnnotations> = flow(
// ////    HashMap.get('logging'),
// ////    Option.flatMap(S.decodeUnknownOption(LoggerAnnotations)),
// ////  );
//
// //
