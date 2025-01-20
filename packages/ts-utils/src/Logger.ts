import * as catppuccin from '@catppuccin/palette';
import { Ansi, AnsiDoc } from '@effect/printer-ansi';
import { color } from 'bun';
import {
  Chunk,
  Console,
  DateTime,
  Duration,
  Effect,
  FiberRef,
  FiberRefs,
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
  Scope,
  Stream,
  SynchronizedRef,
} from 'effect';
import { defaultLogger } from 'effect/Logger';
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

// const timer = pipe(
//   FiberRefs.get(context, startTimeMillisRef),
//   Option.map((a) => DateTime.distanceDuration(a, DateTime.unsafeFromDate(date))),
//   (v) => v,
//   Option.map(Duration.format),
//   (v) => v,
//   // Option.map(Duration.toMillis),
//   // Option.map((a) => `(${a} ${a.toString(10)} ns, ${DateTime.toEpochMillis(a)}, ${date}, ${date.getMilliseconds()})`)
// );
// .pipe(Option.flatMap(Context.getOption(Tracer.ParentSpan)))
// format the span info (if any)
// .pipe(Option.map(getSpanInfo));

export const startTimeMillisRef = FiberRef.unsafeMake(DateTime.unsafeMake(0));

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

  // return Record.getSomes({
  //   extra,
  //   level: Option.some(logLevel.label),
  //   message,
  //   timestamp: Option.some(date),
  //   service: HashMap.get(annotations, 'service'),
  // });
});

// Logger.replaceEffect(Logger.defaultLogger, Effect.map(z, Logger.withConsoleLog));
export const pretty = Effect.gen(function* () {
  const ref = yield* SynchronizedRef.make(Logger.defaultLogger);
  const latch = yield* Effect.makeLatch(false);
  const scope = yield* Effect.scope;
  const stream = Stream.asyncEffect<void>((emit) =>
    Effect.gen(function* () {
      yield* SynchronizedRef.set(
        ref,
        pipe(
          Logger.map(Logger.withConsoleLog(prettyLogger), () => {
            emit(
              Effect.gen(function* () {
                yield* Effect.withFiberRuntime((fiberId) =>
                  Effect.locallyScopedWith(startTimeMillisRef, (start) =>
                    Option.getOrThrow(DateTime.make(fiberId.id().startTimeMillis)),
                  ),
                );
              }).pipe(Effect.provideService(Scope.Scope, scope)),
            );
            // const locally =             console.log('emit');
            // // eslint-disable-next-line no-void
            // void emit(pipe(Console.log('!!', output), Effect.map(Chunk.make), (v) => v));
            // // return 'asdf'; // output;
          }),
        ),
      );
      yield* latch.open;
    }),
  );

  const v = yield* pipe(stream, Stream.runDrain, Effect.fork);

  const v = pipe(SynchronizedRef.get(ref), latch.whenOpen, (logger) =>
    Logger.replaceEffect(Logger.defaultLogger, logger),
  );
  return v;
  // ),
  // Effect.flatMap((ref) => Effect.suspend(() => SynchronizedRef.get(ref))),
  // (x) => Logger.replace(Logger.defaultLogger, x),
  // (v) => v,
  // Layer.unwrapEffect,
  // (v) => v,
}).pipe(Layer.unwrapScoped, (v) => v);
// // export const jsonLinesConsole = Logger.replace(Logger.defaultLogger, pipe(structuredLogger, Logger.withConsoleLog));
// const z = pipe(
//   SynchronizedRef.make(structuredLogger),
//   Effect.tap((ref) =>
//     pipe(
//       SynchronizedRef.get(ref),
//       Effect.tap((log) => {
//         const z = Stream.asyncEffect((emit) =>
//           SynchronizedRef.set(
//             ref,
//             Logger.mapInputOptions(log, (opts) => {
//               // console.log('@@@@@', 'here');
//               emit(
//                 pipe(
//                   DateTime.make(opts.date),
//                   Chunk.make,
//                   Effect.succeed,
//                   Effect.tap((d) => Console.log('!!!!!', d)),
//                   (v) => v,
//                   (d) => {
//                     console.log('!!!!!', d);
//                     return d;
//                   },
//                   (v) => v,
//                   // Effect.succeed
//                 ),
//               );
//               return opts;
//             }),
//           ),
//         );
//         return pipe(
//           Stream.runDrain(z),
//           (v) => v,
//           Effect.fork,
//           (v) => v,
//         );
//       }),
//     ),
//   ),
//   // Logger.addEffect,
//   Effect.flatMap(SynchronizedRef.get),
//   (v) => v,
// );
// const v = Stream.asyncEffect((emit) => Effect.sync(() => Logger.make((ops) => emit(pipe(Console.log(''), Effect.map(Chunk.make))))));

// const consoleTimerRef = FiberRef.unsafeMake(DateTime.unsafeMake(Number.NaN));

// export const structured = Logger.replaceEffect(Logger.defaultLogger, pipe(z, Logger.withConsoleLog, v=>v));
//
// export const jsonLinesConsoleLogger: Logger.Logger<string, void> = Logger.make((options) => {
//  const { log } = pipe(
//    FiberRefs.get(options.context, DefaultServices.currentServices),
//    Option.flatMap(Context.getOption(Console.Console)),
//    Option.map((console) => console.unsafe),
//    Option.getOrElse((): Console.UnsafeConsole => globalThis.console),
//  );
//  log(structuredLogger.log(options));
// });

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

// export const withStartTimeMillis = <Rin, E, Rout>(layer: Layer.Layer<Rin, E, Rout>) =>
//  Effect.withFiberRuntime<Layer.Layer<Rin, E, Rout>>((fiber) => {
//    const fiberId = fiber.id();
//    console.log(fiberId.startTimeMillis, '!!!', DateTime.make(fiberId.startTimeMillis));
//    const locally = Layer.fiberRefLocallyScopedWith(startTimeMillisRef, () =>
//      Option.getOrThrow(DateTime.make(fiberId.startTimeMillis)),
//    );
//    const z = layer.pipe(Layer.provide(locally));
//    const u = Effect.succeed(z);
//    return u;
//  }).pipe(Effect.orDie);

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
//

// export const startTimeMillisRef = FiberRef.unsafeMake(DateTime.unsafeMake(0));
//
// export const withStartTimeMillis = <Rin, E, Rout>(layer: Layer.Layer<Rin, E, Rout>) =>
//   pipe(
//     Effect.withFiberRuntime<Layer.Layer<Rin, E, Rout>>((fiber) => {
//       const fiberId = fiber.id();
//       const locally = Layer.locally(startTimeMillisRef, Option.getOrThrow(DateTime.make(fiberId.startTimeMillis)));
//       const z = locally(layer);
//       const u = Effect.succeed(z)
//       return u
//     }),
//     v=>v
//     // (v) => v,
//     // (f) => {
//     //   const ff = Effect.ap<Layer.Layer<never>, Layer.Layer<never>, never, never, never, never>(
//     //     f,
//     //     Logger.addEffect(Logger.defaultLogger, logger),
//     //   );
//     //   return ff;
//     // },
//     // (v) => v, // ((a) => Effect.succeed(Logger.pretty)),
//   );
// const z = Effect.ap(Effect.succeed(logger));

//  <Message>(logger: Logger.Logger<Message, Message>) =>
//  Stream.asyncEffect((emit) => {
//    const logg = Logger.mapInputOptions(logger, (opts: Logger.Logger.Options<Message>) => {
//      // const timer = pipe(
//      //   FiberRefs.get(opts.context, consoleTimerRef),
//      //   Option.getOrElse(() => initial),
//      // );
//     //  FiberRefs.updateAs(opts.context,
//     //       FiberRefs.updateAs(opts.context, ));
//     //    consoleTimerRef, ([_, prev]) => Tuple.make(prev, DateTime.unsafeFromDate(opts.date)))
//      emit(pipe(
//        Effect.withFiberRuntime((fiber) => {
//          const fiberId = fiber.id();
//        //  FiberRefs.updateAs(opts.context, fiber.id()
//          const refs = FiberRefs.updateAs(
//          opts.context,
//           {
//           fiberId,
//           fiberRef: consoleTimerRef,
//           value: DateTime.make(fiberId.startTimeMillis)
//           }
//          )
//          return { ...opts, context: refs };
//        )));
//        //FiberRef.getAndUpdate(consoleTimerRef, ([_, prev]) => Tuple.make(prev, DateTime.unsafeFromDate(opts.date))),
//          //const [,last] = fiber.id().getFiberRef(consoleTimerRef);
//
//          // const updated =fiber.id().;
//          // FiberRefs.updateAs(opts.context, {
//          // fiberId: fiber.id(),
//          // fiberRef: consoleTimerRef,
//          // value: Tuple.make(last, DateTime.unsafeFromDate(opts.date))
//          // });
//          // fiber.if
//        ),
//        Effect.andThen((refs) => ),
//        Effect.andThen(Effect.setFiberRefs(consoleTimerRef)),
//      ));
//      return opts;
//    })
//    return logg
//  })
