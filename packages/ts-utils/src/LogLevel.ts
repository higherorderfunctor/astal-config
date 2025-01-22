import { LogLevel as _LogLevel, Schema as S } from 'effect';

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
  [All.label]: T;
  [Debug.label]: T;
  [Error.label]: T;
  [Fatal.label]: T;
  [Info.label]: T;
  [None.label]: T;
  [Trace.label]: T;
  [Warning.label]: T;
}
