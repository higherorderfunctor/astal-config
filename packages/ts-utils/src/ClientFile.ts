import { Path } from '@effect/platform';
import type { Scope } from 'effect';
import { Array, Data, Effect, Equal, flow, Hash, Inspectable, Option, pipe, Predicate, Struct } from 'effect';
import ts from 'typescript';

import * as Effectify from './Effectify.js';
import * as NormalizedPath from './NormalizedPath.js';
import * as ProjectServiceError from './ProjectServiceError/index.js';
import * as TsProjectService from './TsProjectService.js';

// Unknown = 0,
// JS = 1,
// JSX = 2,
// TS = 3,
// TSX = 4,
// External = 5,
// JSON = 6,
/// **
// * Used on extensions that doesn't define the ScriptKind but the content defines it.
// * Deferred extensions are going to be included in all project contexts.
// */
// Deferred = 7,
export const { ScriptKind } = ts;
export type ScriptKind = ts.ScriptKind;

export namespace Options {
  export interface OpenClientFile {
    fileContent?: string;
    filePath: string;
    hasMixedContent?: boolean;
    scriptKind?: ScriptKind;
    workspacePath?: string;
  }
}

export class ClientFile
  extends Data.TaggedClass('ClientFile')<{
    filePath: NormalizedPath.NormalizedPath;
    hasMixedContent: boolean;
    scriptKind: Option.Option<ScriptKind>; // TODO: remove
    tsconfig: Option.Option<NormalizedPath.NormalizedPath>;
    workspacePath: Option.Option<NormalizedPath.NormalizedPath>;
  }>
  implements Equal.Equal, Inspectable.Inspectable
{
  [Equal.symbol](that: unknown): boolean {
    return that instanceof ClientFile && Equal.equals(Hash.hash(this), Hash.hash(that));
  }

  [Hash.symbol](): number {
    return Hash.cached(this, Hash.hash(this.filePath));
  }

  [Inspectable.NodeInspectSymbol]() {
    return this.toJSON();
  }

  toJSON() {
    return {
      _tag: this._tag,
      filePath: this.filePath,
      hasMixedContent: this.hasMixedContent,
      scriptKind: this.scriptKind,
      tsconfig: this.tsconfig,
      workspacePath: this.workspacePath,
    };
  }

  toString() {
    return Inspectable.format(this.toJSON());
  }
}

export const checkErrors: Predicate.Refinement<
  ReadonlyArray<ts.Diagnostic> | undefined,
  Array.NonEmptyReadonlyArray<ts.Diagnostic>
> = //(diagnostics?: ReadonlyArray<ts.Diagnostic> | undefined): diagnostics is Array.NonEmptyReadonlyArray<ts.Diagnostic> =>
  Predicate.compose(Predicate.isUndefined, v=>v,Array.isNonEmptyReadonlyArray);

export const handleOpenConfiguredProjectResultError: (
  openConfiguredProjectResult: ts.server.OpenConfiguredProjectResult,
) => (options: {
  fileContent: Option.Option<string>;
  filePath: NormalizedPath.NormalizedPath;
  hasMixedContent: boolean;
  scriptKind: Option.Option<ScriptKind>;
  workspacePath: Option.Option<NormalizedPath.NormalizedPath>;
}) => Effect.Effect<readonly ts.Diagnostic[] | undefined, ProjectServiceError.DiagnosticError, never> =
  ({ configFileErrors }) =>
  (options) =>
    Effectify.liftFailure(
      configFileErrors,
      checkErrors,//Predicate.and(Array.isNonEmptyReadonlyArray, Predicate.isNotUndefined),
      (configFileErrors) =>
        new ProjectServiceError.DiagnosticError({
          diagnostic: configFileErrors,
          ...options,
          tsconfig: Option.none()
        }),
    ).pipe(v=>v);

// export const openClientFileWithNormalizedPath: (options: {
//   fileContent: Option.Option<string>;
//   filePath: NormalizedPath.NormalizedPath;
//   hasMixedContent: boolean;
//   scriptKind: Option.Option<ScriptKind>;
//   workspacePath: Option.Option<NormalizedPath.NormalizedPath>;
// }) => Effect.Effect<ts.server.OpenConfiguredProjectResult, never, ts.server.ProjectService> =
//   /* ({
//   fileContent,
//   filePath,
//   hasMixedContent,
//   scriptKind,
//   workspacePath,
// }) => */
//   flow(
//     Effect.succeed,
//     Effect.bind('projectService', () => TsProjectService.TsProjectService),
//     Effect.bind(
//       'configuredProject',
//       ({ fileContent, filePath, hasMixedContent, projectService, scriptKind, workspacePath }) =>
//         Effect.succeed(
//           projectService.openClientFileWithNormalizedPath(
//             filePath[NormalizedPath.TsNormalizedPath],
//             Option.getOrUndefined(fileContent),
//             Option.getOrUndefined(scriptKind),
//             hasMixedContent,
//             pipe(
//               Option.map(workspacePath, (_) => _[NormalizedPath.TsNormalizedPath]),
//               Option.getOrUndefined,
//             ),
//           ),
//         ),
//     ),
//   Effect.flatMap(
//     Effect.liftPredicate(
//         ({ configuredProject }) => configuredProject.configFileErrors && Array.isNonEmptyReadonlyArray(configuredProject.configFileErrors)) {
//           return yield* Effect.fail(
//             new ProjectServiceError.DiagnosticError({
//               diagnostic: configFileErrors,
//               filePath,
//               hasMixedContent,
//               scriptKind,
//               tsconfig,
//               workspacePath,
//             }),
//           );
//         }
//   ),
//   );

export const getTsconfigPath: (
  configFileName?: string,
) => Effect.Effect<Option.Option<NormalizedPath.NormalizedPath>> = (configFileName?: string) =>
  pipe(Effect.fromNullable(configFileName), Effect.flatMap(NormalizedPath.normalize), Effect.option);

export const open: (
  options: Options.OpenClientFile,
) => Effect.Effect<
  ClientFile,
  Error | ProjectServiceError.DiagnosticError,
  Path.Path | Scope.Scope | ts.server.ProjectService
> = Effectify.effectify({
  body: (options: Options.OpenClientFile) =>
    Effect.acquireRelease(
      Effect.gen(function* () {
        const filePath = yield* NormalizedPath.normalize(options.filePath);
        const workspacePath = yield* NormalizedPath.optional(options.workspacePath);
        const hasMixedContent = options.hasMixedContent ?? false;
        const scriptKind = Option.fromNullable(options.scriptKind);
        const fileContent = Option.fromNullable(options.fileContent);

        const { configFileErrors, configFileName } = yield* openClientFileWithNormalizedPath({
          fileContent,
          filePath,
          hasMixedContent,
          scriptKind,
          workspacePath,
        });

        const tsconfig = yield* getTsconfigPath(configFileName);

        if (configFileErrors && Array.isNonEmptyReadonlyArray(configFileErrors)) {
          return yield* Effect.fail(
            new ProjectServiceError.DiagnosticError({
              diagnostic: configFileErrors,
              filePath,
              hasMixedContent,
              scriptKind,
              tsconfig,
              workspacePath,
            }),
          );
        }
        return new ClientFile({
          filePath,
          hasMixedContent,
          scriptKind,
          tsconfig,
          workspacePath,
        });
      }),
      (clientFile) =>
        Effect.map(TsProjectService.TsProjectService, (projectService) => {
          projectService.closeClientFile(clientFile.filePath);
        }),
    ).pipe((v) => v),
  // logEnd: ({ result }) => Effect.succeed(['Opened client file', result]),
  // logStart: (options) => Effect.succeed(['Opening client file', Struct.omit(options, 'fileContent')]),
  options: ({ filePath, workspacePath }) =>
    Effect.map(Path.Path, (path) => ({
      name: `projectService-openClientFile-${path.relative(workspacePath ?? process.cwd(), filePath)}`,
    })),
});
