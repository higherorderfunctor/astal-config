import * as catppuccin from '@catppuccin/palette';
import { Ansi, AnsiDoc, Color } from '@effect/printer-ansi';
import { color, ColorInput } from 'bun';
import {
  Array,
  Chunk,
  Console,
  Context,
  DateTime,
  DefaultServices,
  Duration,
  Effect,
  FiberRef,
  FiberRefs,
  HashMap,
  Inspectable,
  Layer,
  Logger,
  LogLevel,
  Match,
  Metric,
  Option,
  pipe,
  Predicate,
  Record,
  Stream,
} from 'effect';
import type { ReadonlyRecord } from 'effect/Record';

export interface Message {
  level: LogLevelLabel<LogLevel.LogLevel>;
  message: string;
}

type LogLevelLabel<T extends LogLevel.LogLevel> = T['label'];

const rgb = ({ h, l, s }: { h: number; l: number; s: number }) => {
  console.log(`hsl(${h}, ${s * 100}%, ${l * 100}%)`);
  const resetCode = `\u001B[39m`; // Reset color

  return (str: AnsiDoc.AnsiDoc) =>
    AnsiDoc.hcat([AnsiDoc.text(color(`hsl(${h}, ${s * 100}%, ${l * 100}%)`, 'ansi')), str, AnsiDoc.text(resetCode)]);
};

const levelStyle: (level: LogLevel.LogLevel) => { h: number; l: number; s: number } = pipe(
  HashMap.empty(),
  // catpuccin mocha
  HashMap.set(LogLevel.Trace, catppuccin.flavors.mocha.colors.subtext0.hsl),
  HashMap.set(LogLevel.Debug, catppuccin.flavors.mocha.colors.subtext1.hsl),
  HashMap.set(LogLevel.Info, catppuccin.flavors.mocha.colors.green.hsl),
  HashMap.set(LogLevel.Warning, catppuccin.flavors.mocha.colors.yellow.hsl),
  HashMap.set(LogLevel.Error, catppuccin.flavors.mocha.colors.pink.hsl),
  HashMap.set(LogLevel.Fatal, catppuccin.flavors.mocha.colors.red.hsl),
  (map) => (level: LogLevel.LogLevel) =>
    HashMap.get(map, level).pipe(Option.getOrElse(() => catppuccin.flavors.mocha.colors.text.hsl)),
);

// const timer = Metric.timer("timer");
// Metric.trackAll
// const up = Metric.update(timer, Duration.seconds(5))
// const v = Stream.asyncEffect((emit) => Effect.sync(() => Logger.make((ops) => emit(pipe(Console.log(''), Effect.map(Chunk.make))))));

// const consoleTimerRef = FiberRef.unsafeMake(DateTime.unsafeMake(Number.NaN));

export const structuredLogger = Logger.make<unknown, string>((options) => {
  const { annotations, cause, context, date, fiberId, logLevel, spans } = options;

  const timer = pipe(FiberRefs.get(context, startTimeMillisRef), Option.getOrThrow);
  // .pipe(Option.flatMap(Context.getOption(Tracer.ParentSpan)))
  // format the span info (if any)
  // .pipe(Option.map(getSpanInfo));
  const [message, extra] = Match.value<[string, ReadonlyRecord<string, unknown>] | string>(options.message).pipe(
    Match.when(Predicate.isString, (message) => [message, Option.none()]),
    Match.when([Predicate.isString], ([message, extra]) => [message, Option.none()]),
    Match.when([Predicate.isString, Predicate.isRecord], ([message, extra]) => [message, Option.some(extra)]),
    Match.orElse((_) => [Inspectable.stringifyCircular(_), Option.none()]),
  );
  return pipe(
    AnsiDoc.hsep([
      pipe(AnsiDoc.text(date.toISOString()), AnsiDoc.annotate(Ansi.bold)),
      pipe(
        AnsiDoc.text(logLevel.label),
        pipe(levelStyle(logLevel), rgb),
        AnsiDoc.annotate(Ansi.bold),
        AnsiDoc.annotate(Ansi.italicized),
      ),
      pipe(
        AnsiDoc.text(message),
        pipe(
          levelStyle(logLevel),
          // ({h, s, l}) => ({h, s, l: l - l * .1}),
          rgb,
        ),
      ),
      AnsiDoc.text(timer.toString()),
    ]),
    AnsiDoc.render({ style: 'pretty' }),
  );

  // return Record.getSomes({
  //   extra,
  //   level: Option.some(logLevel.label),
  //   message,
  //   timestamp: Option.some(date),
  //   service: HashMap.get(annotations, 'service'),
  // });
});

export const structured = Logger.replace(Logger.defaultLogger, structuredLogger);

export const jsonLinesConsoleLogger: Logger.Logger<string, void> = Logger.make((options) => {
  const { log } = pipe(
    FiberRefs.get(options.context, DefaultServices.currentServices),
    Option.flatMap(Context.getOption(Console.Console)),
    Option.map((console) => console.unsafe),
    Option.getOrElse((): Console.UnsafeConsole => globalThis.console),
  );
  log(structuredLogger.log(options));
});

export const jsonLinesConsole = Logger.replace(Logger.defaultLogger, jsonLinesConsoleLogger);

export const startTimeMillisRef = FiberRef.unsafeMake(DateTime.unsafeMake(0));

export const withStartTimeMillis = <Rin, E, Rout>(layer: Layer.Layer<Rin, E, Rout>) =>
  Effect.withFiberRuntime<Layer.Layer<Rin, E, Rout>>((fiber) => {
    const fiberId = fiber.id();
    console.log(fiberId.startTimeMillis, '!!!');
    const locally = Layer.locally(startTimeMillisRef, Option.getOrThrow(DateTime.make(fiberId.startTimeMillis)));
    const z = locally(layer);
    const u = Effect.succeed(z);
    return u;
  });

// export const jsonLinesConsoleLogger: Logger.Logger<unknown, void> = Logger.make((options) => {
//   const { log } = pipe(
//     FiberRefs.get(options.context, DefaultServices.currentServices),
//     Option.flatMap(Context.getOption(Console.Console)),
//     Option.map((console) => console.unsafe),
//     Option.getOrElse((): Console.UnsafeConsole => globalThis.console),
//   );
//       log(Inspectable.stringifyCircular(jsonLinesLogger.log(options)));
// });
//
// export const jsonLinesConsole = Logger.replace(Logger.defaultLogger, jsonLinesConsoleLogger);

// export const jsonLinesLogger = Logger.make<unknown, Message>((options) => {
//   const { annotations, cause, context, date, fiberId, logLevel, spans } = options;
//   const [message, extra] = Match.value<[string, ReadonlyRecord<string, unknown>] | string>(options.message).pipe(
//     Match.when(Predicate.isString, (message) => [Option.some(message), Option.none()]),
//     Match.when([Predicate.isString], ([message, extra]) => [Option.some(message), Option.none()]),
//     Match.when([Predicate.isString, Predicate.isRecord], ([message, extra]) => [
//       Option.some(message),
//       Option.some(extra),
//     ]),
//     Match.orElse((_) => [Option.some(Inspectable.stringifyCircular(_)), Option.none()]),
//   );
//   return Record.getSomes({
//     extra,
//     level: Option.some(logLevel.label),
//     message,
//     timestamp: Option.some(date),
//     service: HashMap.get(annotations, 'service'),
//   });
// });
//
// export const jsonLines = Logger.replace(Logger.defaultLogger, jsonLinesLogger);
