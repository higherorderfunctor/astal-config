import type { LogLevel } from 'effect';
import { Console, Context, DefaultServices, Effect, FiberRefs, Logger, Option, pipe } from 'effect';
import { stringifyCircular } from 'effect/Inspectable';

export interface Message {
  level: LogLevelLabel<LogLevel.LogLevel>;
  message: string;
}

type LogLevelLabel<T extends LogLevel.LogLevel> = T['label'];

// declare module 'effect/Effect' {
//  export const logError: (message: string, annotations?: Record<string, unknown>) => Effect<void>;
// }
Effect.logError('sdaf', 'asdf');
Effect.logError('sdaf', 'asdf');
Effect.logError2('sdaf', 'asdf');
export const prettyLogger = Logger.make<unknown, Message>(
  ({ annotations, cause, context, date, fiberId, logLevel, message, spans }) =>
    // const console = pipe(
    //   FiberRefs.get(context, DefaultServices.currentServices),
    //   Option.flatMap(Context.getOption(Console.Console)),
    //   Option.map((console) => console.unsafe),
    //   Option.getOrElse((): Console.UnsafeConsole => globalThis.console),
    // );
    ({
      level: logLevel.label,
      message,
    }),
);

export const pretty = Logger.replace(Logger.defaultLogger, pipe(prettyLogger, Logger.withConsoleLog));
