import * as catppuccin from '@catppuccin/palette';
import { Ansi, AnsiDoc } from '@effect/printer-ansi';
import { color } from 'bun';
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
import type { ReadonlyRecord } from 'effect/Record';

/**
 * Re-types effect's log level's to more specific types instead of the sum type.
 */

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
  export const All = _LogLevel.Fatal as _LogLevel.All;
  export const Fatal = _LogLevel.Fatal as _LogLevel.Fatal;
  export const Error = _LogLevel.Error as _LogLevel.Error;
  export const Warning = _LogLevel.Warning as _LogLevel.Warning;
  export const Info = _LogLevel.Info as _LogLevel.Info;
  export const Debug = _LogLevel.Debug as _LogLevel.Debug;
  export const Trace = _LogLevel.Trace as _LogLevel.Trace;
  export const None = _LogLevel.Trace as _LogLevel.None;
}

export namespace style {
  export const reset = AnsiDoc.text(`\u001B[39m`);
}

const hsl = ({ h, l, s }: { h: number; l: number; s: number }): ((doc: AnsiDoc.AnsiDoc) => AnsiDoc.AnsiDoc) =>
  pipe(
    Option.fromNullable(
      color(`hsl(${h.toString(10)}, ${(s * 100).toString(10)}%, ${(l * 100).toString(10)}%)`, 'ansi'),
    ),
    Option.map((left) => AnsiDoc.surround<never, never, Ansi.Ansi>(AnsiDoc.text(left), style.reset)),
    Option.getOrElse(() => (doc: AnsiDoc.AnsiDoc) => doc),
  );

export type Annotate = (doc: AnsiDoc.AnsiDoc) => AnsiDoc.AnsiDoc;

export const palette: catppuccin.Colors<Annotate> = pipe(
  catppuccin.flavors.mocha.colors,
  Record.map((color) => hsl(color.hsl)),
);

export namespace style {
  export const { text } = palette;

  export const timestamp: (options: { date: Date }) => AnsiDoc.AnsiDoc = flow(
    Struct.get('date'),
    DateTime.unsafeFromDate,
    DateTime.formatIsoDateUtc,
    AnsiDoc.text,
    AnsiDoc.annotate(Ansi.bold),
  );

  const logLevelMapping: Record<LogLevel.LogLevel['label'], Annotate> = {
    [LogLevel.All.label]: palette.red,
    [LogLevel.Debug.label]: palette.subtext1,
    [LogLevel.Error.label]: palette.pink,
    [LogLevel.Fatal.label]: palette.red,
    [LogLevel.Info.label]: palette.green,
    [LogLevel.None.label]: palette.subtext0,
    [LogLevel.Trace.label]: palette.subtext0,
    [LogLevel.Warning.label]: palette.yellow,
  };

  export const logLevel: (options: { logLevel: LogLevel.LogLevel }) => AnsiDoc.AnsiDoc = flow(
    Struct.get('logLevel'),
    (logLevel) => logLevelMapping[logLevel.label](AnsiDoc.text(logLevel.label)),
    AnsiDoc.annotate(Ansi.bold),
    AnsiDoc.annotate(Ansi.italicized),
  );

  export const message: {
    (options: { logLevel: LogLevel.LogLevel }): (message: string) => AnsiDoc.AnsiDoc;
    (message: string, options: { logLevel: LogLevel.LogLevel }): AnsiDoc.AnsiDoc;
  } = Function.dual(
    2,
    (message: string, { logLevel }: { logLevel: LogLevel.LogLevel }): AnsiDoc.AnsiDoc =>
      pipe(logLevelMapping[logLevel.label](AnsiDoc.text(message))),
  );

  export namespace annotations {
    export namespace metrics {
      export namespace distance {
        export const fast = palette.yellow;
        export const slow = palette.peach;
        export const fastest = palette.green;
        export const slowest = palette.red;
        export const zero = palette.surface1;
        export const apply: (duration: Duration.Duration) => Annotate = Match.type<Duration.Duration>().pipe(
          Match.when(Duration.isZero, (_) => zero),
          Match.when(Duration.lessThan(4), () => fastest),
          Match.when(Duration.lessThan(8), () => fast),
          Match.when(Duration.lessThan(12), () => slow),
          Match.when(Duration.greaterThanOrEqualTo(12), () => slowest),
          Match.orElse((): Annotate => (doc) => doc),
        );
      }
    }
  }
}

// export const LoggerAnnotations = S.Struct({ metrics: S.Struct({ distance: S.OptionFromSelf(S.DurationFromSelf) }) });
//
// export type LoggerAnnotations = S.Schema.Type<typeof LoggerAnnotations>;
//
// export const parseLoggerAnnotations: <K, V>(self: HashMap.HashMap<K, V>) => Option.Option<LoggerAnnotations> = flow(
//   HashMap.get('logging'),
//   Option.flatMap(S.decodeUnknownOption(LoggerAnnotations)),
// );

//
