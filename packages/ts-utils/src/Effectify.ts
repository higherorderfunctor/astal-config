import type { Predicate } from 'effect';
import { Effect, Function } from 'effect';

export namespace Options {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface Body<in Args extends Array<any>, out A, out E, out R> {
    // eslint-disable-next-line @typescript-eslint/prefer-function-type
    (...args: Args): Effect.Effect<A, E, R>;
  }

  export interface Effectify<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    in Args extends Array<any>,
    in out A,
    out E,
    out R1,
    out R2,
    // out R3,
    // out R4,
  > {
    body: Body<Args, A, E, R1>;
    options: (...args: Args) => Effect.Effect<Effect.FunctionWithSpanOptions, never, R2>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Name<in Args extends Array<any>, out R> = (...args: Args) => Effect.Effect<string, never, R>;
}

/**
 * Effectify typescript methods.
 */
export const effectify =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <Args extends Array<any>, A, E, R1, R2>({ body, options }: Options.Effectify<Args, A, E, R1, R2>) =>
    (...args: Args): Effect.Effect<A, E, R1 | R2> =>
      Effect.succeed({ args }).pipe(
        Effect.bind('options', () => options(...args)),
        Effect.flatMap(({ args, options }) =>
          Effect.functionWithSpan({
            body: () => body(...args),
            captureStackTrace: true,
            options: () => options,
          })(),
        ),
      );

export const liftFailure: {
  <A, B extends A, C>(refinement: Predicate.Refinement<A, B>, onFailure: (b: B) => C): (a: A) => Effect.Effect<A, C>;
  <A, B extends A, C>(a: A, refinement: Predicate.Refinement<A, B>, onFailure: (b: B) => C): Effect.Effect<A, C>;
} = Function.dual(
  3,
  <A, B extends A, C>(a: A, refinement: Predicate.Refinement<A, B>, onFailure: (b: B) => C): Effect.Effect<A, C> => {
    if (refinement(a)) {
      return Effect.fail(onFailure(a));
    }
    return Effect.succeed(a);
  },
);
