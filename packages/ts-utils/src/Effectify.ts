import { Path } from '@effect/platform';
import { Effect, Function, pipe } from 'effect';
import type ts from 'typescript';

export namespace Options {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export interface Result<A = any> {
      result: A;
    }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface Effectify<in Args extends Array<any>, out E, out R, in out Res extends Result> {
    body: (projectService: ts.server.ProjectService, path: Path.Path, ...args: Args) => Effect.Effect<Res, E, R>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logEnd: (fields: NoInfer<Res>, path: Path.Path, ...args: NoInfer<Args>) => [string, ...Array<any>];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logStart: (path: Path.Path, ...args: NoInfer<Args>) => [string, ...Array<any>];
    name: (path: Path.Path, ...args: NoInfer<Args>) => string;
  }
}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Effectify = <Args extends Array<any>, E, R, Res extends Options.Result>
  (options: Options.Effectify<Args, E, R, Res>)=> {
  (
    ...args: Args
  ): (projectService: ts.server.ProjectService) => Effect.Effect<Res extends Options.Result<infer A> ? A : never, E, R>;
  (
    projectService: ts.server.ProjectService,
    ...args: Args
  ): Effect.Effect<Res extends Options.Result<infer A> ? A : never, E, R>;
}

/**
 * Effectify typescript methods.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const effectify: Effectify =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <Args extends Array<any>, A, E, R, Res extends Options.Result<A>>({
    body,
    logEnd,
    logStart,
    name,
  }: Options.Effectify<Args, E, R, Res>) =>
    Function.dual(2, (projectService: ts.server.ProjectService, ...args: Args) =>
      Effect.flatMap(Path.Path, (path) =>
        Effect.functionWithSpan({
          body: () =>
            pipe(
              Effect.logInfo(...logStart(path, ...args)),
              Effect.flatMap(() => body(projectService, path, ...args)),
              Effect.tap((fields) => Effect.logTrace(...logEnd(fields, path, ...args))),
              Effect.map(({ result }) => result),
            ),
          captureStackTrace: true,
          options: () => ({ name: name(path, ...args) }),
        })(),
      ),
    );
