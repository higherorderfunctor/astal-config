import type { LogLevel } from 'effect';
import {
  DateTime,
  Duration,
  Effect,
  FiberRef,
  FiberRefs,
  Layer,
  Logger,
  Option,
  pipe,
  Runtime,
  Stream,
  Tuple,
} from 'effect';

export interface Message {
  level: LogLevelLabel<LogLevel.LogLevel>;
  message: string;
}

type LogLevelLabel<T extends LogLevel.LogLevel> = T['label'];

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
