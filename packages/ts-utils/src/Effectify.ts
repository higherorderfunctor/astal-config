import { Effect } from 'effect';

type Contains<R, U> = [U] extends [R] ? U : never;
type A = Contains<'a' | 'b', 'b'>
type B = Contains<'a' | 'b', 'b' | 'c'>

export namespace Options {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface Body<in Args extends Array<any>, out A extends Result<any>, out E, out R> {
    // eslint-disable-next-line @typescript-eslint/prefer-function-type
    (...args: Args): Effect.Effect<A, E, R>
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface LogEnd<in Args extends Array<any>, A extends Result<any>, out R> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any @typescript-eslint/prefer-function-type
    (...args: [A, ...Args]): Effect.Effect<[string, ...Array<any>], never, R>
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface LogStart<in Args extends Array<any>, out R> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any @typescript-eslint/prefer-function-type
    (...args: Args): Effect.Effect<[string, ...Array<any>], never, R>
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface Name<in Args extends Array<any>, out R> {
    // eslint-disable-next-line @typescript-eslint/prefer-function-type
    (...args: Args): Effect.Effect<string, never, R>
  }

  export interface Effectify<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    in Args extends Array<any>, in out A extends Result<any>, out E, out R
  > {
    body: Body<Args, A, E, R extends infer R1 | infer R2 ? Exclude<R, R2> : never>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEnd: LogEnd<Args, A, R extends infer R1 | infer R2 ? Exclude<R, R2> : never>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logStart: LogStart<Args, R extends infer R1 | infer R2 ? Exclude<R, R2> : never>;
    name: Name<Args, R extends infer R1 | infer R2 ? Exclude<R, R1> : never>;
  }

  export interface Result<A> {
    result: A;
  }
}

 type ExtractResult<T> = T extends Options.Result<infer A> ? A : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Effectify = <Args extends Array<any>, A extends Options.Result<any>, E, R>(
  options: Options.Effectify<Args, A, E, R>,
) => (...args: Args) => Effect.Effect<ExtractResult<A>, E, R>;

/**
 * Effectify typescript methods.
 */

export const effectify: Effectify =
  ({ body, logEnd, logStart, name }) =>
  (...args) =>
    Effect.succeed({ args }).pipe(
      Effect.tap(({ args }) => logStart(...args)),
      Effect.bind('name', ({ args }) => name(...args)),
      Effect.flatMap(({ args, name }) =>
        Effect.functionWithSpan({
          body: () =>
            Effect.logInfo(...logStart(...args)).pipe(
              Effect.flatMap(() => body(...args)),
              Effect.tap((fields) => Effect.logTrace(...logEnd(fields, ...args))),
              Effect.map(({ result }) => result),
            ),
          captureStackTrace: true,
          options: () => ({ name }),
        })(),
      ),
      (v) => v,
    );

// export interface Result<A> {
//   result: A
// }
//
// export type Body<Args extends Array<any>, Res extends Result<A>,  A> =
//   (...args: Args) => Res
//
// export interface Options<Args extends any[], Res extends Result<A>, A> {
//   body: Body<Args, Res, A>
// }
//
// export type F = <Args extends any[], Res extends Result<A>, A>
//   (options: Options<Args, Res, A>) => (...args: Args) => A;
//
// export const make: F = ({ body }) => (...args) => body(...args).result
//
// // <[a: number], {
// //     result: string;
// // }, unknown>(options: Options<[a: number], {
// //     result: string;
// // }, unknown>) => (a: number) => unknown
// export const f = make({
//   body: (a: number) => ({ result: a.toString(10) }),
// })
//
// // export const f = make<[a: number], { result: string }, string>({
