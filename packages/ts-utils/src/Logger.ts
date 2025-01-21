import { Ansi, AnsiDoc } from '@effect/printer-ansi';
import type { Record } from 'effect';
import {
  DateTime,
  Duration,
  Effect,
  flow,
  HashMap,
  Inspectable,
  Logger,
  Match,
  Option,
  pipe,
  Predicate,
  Schema as S,
} from 'effect';
import type { ReadonlyRecord } from 'effect/Record';

import * as theme from './LoggerConsoleTheme.js';

export interface Message {
  level: theme.LogLevel.LogLevel['label'];
  message: string;
}

export const parseMessage: (
  message: [string, ReadonlyRecord<string, unknown>] | [string] | string,
) => [string, Option.Option<ReadonlyRecord<string, unknown>>] = flow(
  Match.value,
  Match.when([Predicate.isString], ([message]) => [message, Option.none()]),
  Match.when([Predicate.isString, Predicate.isRecord], ([message, extra]) => [message, Option.some(extra)]),
  Match.when(Predicate.isString, ([message]) => [message, Option.none()]),
  Match.orElse((_) => [Inspectable.stringifyCircular(_), Option.none()]),
);

export class LoggerAnnotations extends S.Class<LoggerAnnotations>('LoggerAnnotations')({
  metrics: S.Struct({ distance: S.OptionFromSelf(S.DurationFromSelf) }),
}) {}

export namespace LoggerAnnotations {
  export const parse: <K, V>(self: HashMap.HashMap<K, V>) => Option.Option<LoggerAnnotations> = flow(
    HashMap.get('logging'),
    Option.flatMap(S.decodeUnknownOption(LoggerAnnotations)),
  );
  export namespace metrics {
    export namespace distance {
      export const format: (loggerAnnotations: Option.Option<LoggerAnnotations>) => AnsiDoc.AnsiDoc = flow(
        Option.flatMap(({ metrics: { distance } }) => distance),
        Option.map((distance) =>
          pipe(
            // default effect formatter excludes the ms on 0
            Option.liftPredicate(distance, Predicate.not(Duration.isZero)),
            Option.map(flow(Duration.format, AnsiDoc.text)),
            Option.getOrElse(() => AnsiDoc.text('0ms')),
            (_) => AnsiDoc.hcat([AnsiDoc.text('+'), _]),
            AnsiDoc.parenthesized,
            theme.style.annotations.metrics.distance.apply(distance),
            AnsiDoc.annotate(Ansi.bold),
          ),
        ),
        Option.getOrElse(() => AnsiDoc.empty),
      );
    }
  }
}

export const prettyLogger = Logger.make<unknown, string>((options) => {
  const [message, extra] = parseMessage(options.message as any);

  const loggerAnnotations = LoggerAnnotations.parse(options.annotations);

  return pipe(
    AnsiDoc.hsep([
      theme.style.timestamp(options),
      theme.style.logLevel(options),
      theme.style.message(message, options),
      LoggerAnnotations.metrics.distance.format(loggerAnnotations),
    ]),
    AnsiDoc.render({ style: 'pretty' }),
  );
});

export const pretty = (() => {
  let lastMessageAt = Option.none<DateTime.Utc>();
  return Logger.replace(
    Logger.defaultLogger,
    Logger.mapInputOptions(Logger.withConsoleLog(prettyLogger), (opts) => {
      const currentMessageAt = DateTime.unsafeMake(opts.date);
      const annotations = HashMap.set(opts.annotations, 'logging', {
        metrics: { distance: Option.map(lastMessageAt, DateTime.distanceDuration(currentMessageAt)) },
      });
      lastMessageAt = Option.some(currentMessageAt);
      return {
        ...opts,
        annotations,
      };
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
