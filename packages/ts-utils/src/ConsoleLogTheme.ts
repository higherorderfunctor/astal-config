import * as catppuccin from '@catppuccin/palette';
import { Ansi, AnsiDoc } from '@effect/printer-ansi';
import { color } from 'bun';
import type { Types } from 'effect';
import {
  DateTime,
  Duration,
  Effect,
  flow,
  Function,
  HashMap,
  Inspectable,
  Layer,
  Logger,
  LogLevel as _LogLevel,
  Match,
  Option,
  pipe,
  Predicate,
  Record,
  Schema as S,
  Struct,
} from 'effect';
import { functionWithSpan } from 'effect/Effect';

import * as Palette from './Palette.js';
import type * as PaletteError from './PaletteError/index.js';

export namespace LogLevel {
  export type LogLevel =
    | _LogLevel.All
    | _LogLevel.Debug
    | _LogLevel.Error
    | _LogLevel.Fatal
    | _LogLevel.Info
    | _LogLevel.None
    | _LogLevel.Trace
    | _LogLevel.Warning;

  /**
   * Re-types effect's log level's to more specific types instead of the sum type.
   */
  export const All = _LogLevel.Fatal as _LogLevel.All;
  export const Fatal = _LogLevel.Fatal as _LogLevel.Fatal;
  export const Error = _LogLevel.Error as _LogLevel.Error;
  export const Warning = _LogLevel.Warning as _LogLevel.Warning;
  export const Info = _LogLevel.Info as _LogLevel.Info;
  export const Debug = _LogLevel.Debug as _LogLevel.Debug;
  export const Trace = _LogLevel.Trace as _LogLevel.Trace;
  export const None = _LogLevel.Trace as _LogLevel.None;

  export interface LogLevels<T> {
    [LogLevel.All.label]: T;
    [LogLevel.Debug.label]: T;
    [LogLevel.Error.label]: T;
    [LogLevel.Fatal.label]: T;
    [LogLevel.Info.label]: T;
    [LogLevel.None.label]: T;
    [LogLevel.Trace.label]: T;
    [LogLevel.Warning.label]: T;
  }
}

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

  export namespace Mapping {
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

  type Apply<Options = {}> = Effect.Effect<
    {
      (
        ...args: [Types.Equals<Options, {}>] extends [true] ? [options?: Options] : [options: Options]
      ): (self: AnsiDoc.AnsiDoc) => AnsiDoc.AnsiDoc;
      (
        self: AnsiDoc.AnsiDoc,
        ...args: [Types.Equals<Options, {}>] extends [true] ? [options?: Options] : [options: Options]
      ): AnsiDoc.AnsiDoc;
    },
    PaletteError.PaletteColorError
  >;

  export const timestamp: Apply = Effect.succeed(
    Function.dual(2, (self: AnsiDoc.AnsiDoc, _options?: {}): AnsiDoc.AnsiDoc => AnsiDoc.annotate(self, Ansi.bold)),
  );

  export const logLevel: Apply<{ logLevel: LogLevel.LogLevel }> = pipe(
    Mapping.logLevel,
    Effect.map(
      (colorscheme): Effect.Effect.Success<Apply<{ logLevel: LogLevel.LogLevel }>> =>
        Function.dual(2, (self: AnsiDoc.AnsiDoc, options: { logLevel: LogLevel.LogLevel }) =>
          pipe(
            colorscheme[options.logLevel.label](self),
            AnsiDoc.annotate(Ansi.bold),
            AnsiDoc.annotate(Ansi.italicized),
          ),
        ),
    ),
  );

  export const message: Apply<{ logLevel: LogLevel.LogLevel }> = pipe(
    Mapping.message,
    Effect.map(
      (colorscheme): Effect.Effect.Success<Apply<{ logLevel: LogLevel.LogLevel }>> =>
        Function.dual(
          2,
          (message: string, { logLevel }: { logLevel: LogLevel.LogLevel }): AnsiDoc.AnsiDoc =>
            pipe(colorscheme[logLevel.label](AnsiDoc.text(message))),
        ),
    ),
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

  export namespace metrics {
    export namespace distance {
      export const format = (options: { metrics: { distance: Option.Option<Duration.Duration> } }): AnsiDoc.AnsiDoc =>
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


export class LogTheme extends Effect.Service<LogTheme>()('LogTheme', {
  accessors: true,
  effect: Effect.gen(function* () {
    return {
      colorscheme: yield* Effect.all({
        logLevel: Colorscheme.logLevel,
        message: Colorscheme.message,
        timestamp: Colorscheme.timestamp,
      }),
      format,
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
