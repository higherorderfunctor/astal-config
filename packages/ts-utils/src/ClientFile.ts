import { Path } from '@effect/platform';
import type { Scope } from 'effect';
import { Array, Data, Effect, Equal, Hash, Inspectable, Option, pipe, Struct } from 'effect';
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

export const open = Effectify.effectify({
  body: (options: Options.OpenClientFile) =>
    Effect.acquireRelease(
      Effect.gen(function* () {
        const projectService = yield* TsProjectService.TsProjectService;
        const filePath = yield* NormalizedPath.normalize(options.filePath);
        const workspacePath = yield* pipe(
          Effect.fromNullable(options.workspacePath),
          Effect.flatMap(NormalizedPath.normalize),
          Effect.option,
        );
        const hasMixedContent = options.hasMixedContent ?? false;
        const scriptKind = Option.fromNullable(options.scriptKind);

        // openClientFileWithNormalizedPath(
        //  fileName: NormalizedPath,
        //  fileContent?: string,
        //  scriptKind?: ScriptKind,
        //  hasMixedContent?: boolean,
        //  projectRootPath?: NormalizedPath): OpenConfiguredProjectResult;
        // );
        const { configFileErrors, configFileName } = projectService.openClientFileWithNormalizedPath(
          filePath[NormalizedPath.TsNormalizedPath],
          options.fileContent,
          options.scriptKind,
          hasMixedContent,
          pipe(
            Option.map(workspacePath, (_) => _[NormalizedPath.TsNormalizedPath]),
            Option.getOrUndefined,
          ),
        );

        const tsconfig = yield* pipe(
          Effect.fromNullable(configFileName),
          Effect.flatMap(NormalizedPath.normalize),
          Effect.option,
        );

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
        return {
          result: new ClientFile({
            filePath,
            hasMixedContent,
            scriptKind,
            tsconfig,
            workspacePath,
          }),
        };
      }),
      ({ result }) =>
        Effect.map(TsProjectService.TsProjectService, (projectService) => {
          projectService.closeClientFile(result.filePath);
        }),
    ).pipe((v) => v),
  logEnd: ({ result }) => Effect.succeed(['Opened client file', result]),
  logStart: (options) => Effect.succeed(['Opening client file', Struct.omit(options, 'fileContent')]),
  name: ({ filePath, workspacePath }) =>
    Effect.map(
      Path.Path,
      (path) => `projectService-openClientFile-${path.relative(workspacePath ?? process.cwd(), filePath)}`,
    ),
});
