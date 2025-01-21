import * as catppuccin from '@catppuccin/palette';
import { Ansi, AnsiDoc } from '@effect/printer-ansi';
import { color } from 'bun';
import {
  DateTime,
  Duration,
  Effect,
  flow,
  HashMap,
  Inspectable,
  Layer,
  Logger,
  LogLevel,
  Match,
  Option,
  pipe,
  Predicate,
  Schema as S,
} from 'effect';
import type { ReadonlyRecord } from 'effect/Record';

type LogLevelLabel<T extends LogLevel.LogLevel> = T['label'];

const reset = AnsiDoc.text(`\u001B[39m`);

export const hsl = ({ h, l, s }: { h: number; l: number; s: number }): ((doc: AnsiDoc.AnsiDoc) => AnsiDoc.AnsiDoc) =>
  pipe(
    Option.fromNullable(
      color(`hsl(${h.toString(10)}, ${(s * 100).toString(10)}%, ${(l * 100).toString(10)}%)`, 'ansi'),
    ),
    Option.map((left) => AnsiDoc.surround<never, never, Ansi.Ansi>(AnsiDoc.text(left), reset)),
    Option.getOrElse(() => (doc: AnsiDoc.AnsiDoc) => doc),
  );

export interface Message {
  level: LogLevelLabel<LogLevel.LogLevel>;
  message: string;
}

const theme = catppuccin.flavors.mocha.colors;
const defaultStyle = hsl(theme.text.hsl);

const levelStyle: (level: LogLevel.LogLevel) => (doc: AnsiDoc.AnsiDoc) => AnsiDoc.AnsiDoc = pipe(
  HashMap.fromIterable([
    [LogLevel.Trace, hsl(theme.subtext0.hsl)],
    [LogLevel.Debug, hsl(theme.subtext1.hsl)],
    [LogLevel.Info, hsl(theme.green.hsl)],
    [LogLevel.Warning, hsl(theme.yellow.hsl)],
    [LogLevel.Error, hsl(theme.pink.hsl)],
    [LogLevel.Fatal, hsl(theme.red.hsl)],
  ]),
  (ref) => (level) =>
    pipe(
      HashMap.get(ref, level),
      Option.getOrElse(() => defaultStyle),
    ),
);

export const parseMessage: (
  message: [string, ReadonlyRecord<string, unknown>] | [string] | string,
) => [string, Option.Option<ReadonlyRecord<string, unknown>>] = flow(
  Match.value,
  Match.when([Predicate.isString], ([message]) => [message, Option.none()]),
  Match.when([Predicate.isString, Predicate.isRecord], ([message, extra]) => [message, Option.some(extra)]),
  Match.when(Predicate.isString, ([message]) => [message, Option.none()]),
  Match.orElse((_) => [Inspectable.stringifyCircular(_), Option.none()]),
);

export const prettyLogger = Logger.make<unknown, string>((options) => {
  const { date, logLevel /* annotations, cause, context, fiberId, spans */ } = options;
  const [message, extra] = parseMessage(options.message as any);
  const metrics = HashMap.get(options.annotations, 'metrics');

  const dur = pipe(
    Option.flatMap(
      metrics,
      S.decodeUnknownOption(S.Struct({ sinceLast: S.OptionFromSelf(S.DurationFromSelf) })),
    ),
    Option.flatMap(({ sinceLast }) => sinceLast),
    Option.map((sinceLast) => `(+${Duration.format(sinceLast) ?? 0})`),
    Option.getOrElse(() => '()'),
  );
  console.log(dur);
  return pipe(
    AnsiDoc.hsep([
      pipe(AnsiDoc.text(date.toISOString()), AnsiDoc.annotate(Ansi.bold)),
      pipe(
        AnsiDoc.text(logLevel.label),
        levelStyle(logLevel),
        AnsiDoc.annotate(Ansi.bold),
        AnsiDoc.annotate(Ansi.italicized),
      ),
      pipe(AnsiDoc.text(message), levelStyle(logLevel)),
      // AnsiDoc.text(Inspectable.stringifyCircular(timer)),
    ]),
    AnsiDoc.render({ style: 'pretty' }),
  );
});

// export const pretty = Logger.replace(Logger.defaultLogger, pipe(prettyLogger, Logger.withConsoleLog));

export const pretty = (() => {
  let last = Option.none<DateTime.Utc>();
  return Logger.replace(
    Logger.defaultLogger,
    Logger.mapInputOptions(Logger.withConsoleLog(prettyLogger), (opts) => {
      const curr = DateTime.unsafeMake(opts.date);
      const metrics = {
        sinceLast: Option.map(last, (last) => DateTime.distanceDuration(last, curr)),
      };
      last = Option.some(curr);
      return { ...opts, annotations: HashMap.set(opts.annotations, 'metrics', metrics) };
    }),
  );
})();

export const trace: (service: string, message: string, annotations?: Record<string, unknown>) => Effect.Effect<void> = (
  service,
  message,
  annotations,
) => Effect.logTrace(message, { ...annotations, service });

export const debug: (service: string, message: string, annotations?: Record<string, unknown>) => Effect.Effect<void> = (
  service,
  message,
  annotations,
) => Effect.logDebug(message, { ...annotations, service });

export const info: (service: string, message: string, annotations?: Record<string, unknown>) => Effect.Effect<void> = (
  service,
  message,
  annotations,
) => Effect.logInfo(message, { ...annotations, service });

export const warn: (service: string, message: string, annotations?: Record<string, unknown>) => Effect.Effect<void> = (
  service,
  message,
  annotations,
) => Effect.logWarning(message, { ...annotations, service });

export const error: (service: string, message: string, annotations?: Record<string, unknown>) => Effect.Effect<void> = (
  service,
  message,
  annotations,
) => Effect.logError(message, { ...annotations, service });

export const fatal: (service: string, message: string, annotations?: Record<string, unknown>) => Effect.Effect<void> = (
  service,
  message,
  annotations,
) => Effect.logFatal(message, { ...annotations, service });
