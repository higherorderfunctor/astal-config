import { Path } from '@effect/platform';
import type { Scope, Types } from 'effect';
import { Array, Data, Effect, Equal, flow, Hash, Inspectable, Option, pipe, Struct } from 'effect';
import ts from 'typescript';

import * as Effectify from './Effectify.js';
import * as NormalizedPath from './NormalizedPath.js';
import * as ProjectService from './ProjectService.js';
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

interface Fields {
  fileContent: Option.Option<string>;
  filePath: NormalizedPath.NormalizedPath;
  hasMixedContent: boolean;
  scriptKind: Option.Option<ScriptKind>;
  tsconfigPath: Option.Option<NormalizedPath.NormalizedPath>;
  workspacePath: Option.Option<NormalizedPath.NormalizedPath>;
}

type OpenConfiguredProjectResult = OpenConfiguredProjectResult.WithErrors | OpenConfiguredProjectResult.WithoutErrors;

export class ClientFile extends Data.TaggedClass('ClientFile')<Fields> implements Equal.Equal, Inspectable.Inspectable {
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
    return Struct.pick(
      '_tag',
      'fileContent',
      'filePath',
      'hasMixedContent',
      'scriptKind',
      'tsconfigPath',
      'workspacePath',
    )(this as InstanceType<typeof ClientFile>);
  }

  toString() {
    return Inspectable.format(this.toJSON());
  }
}

namespace OpenConfiguredProjectResult {
  export interface WithErrors extends WithoutErrors {
    configFileErrors: Array.NonEmptyReadonlyArray<ts.Diagnostic>;
  }
  export interface WithoutErrors {
    configFileErrors?: ReadonlyArray<ts.Diagnostic> | undefined;
    configFileName?: ts.server.NormalizedPath;
  }

  export const hasErrors = (result: OpenConfiguredProjectResult): result is OpenConfiguredProjectResult.WithErrors =>
    result.configFileErrors !== undefined && Array.isNonEmptyReadonlyArray(result.configFileErrors);

  export const handleErrors: (
    options: Types.Simplify<
      {
        result: OpenConfiguredProjectResult;
      } & Fields
    >,
  ) => Effect.Effect<OpenConfiguredProjectResult.WithoutErrors, ProjectServiceError.DiagnosticError> = ({
    result,
    ...options
  }) =>
    Effectify.liftFailure(
      result,
      OpenConfiguredProjectResult.hasErrors,
      ({ configFileErrors }) =>
        new ProjectServiceError.DiagnosticError({
          diagnostic: configFileErrors,
          ...options,
        }),
    );

  export const getTsconfigPath: ({
    result,
  }: {
    result: OpenConfiguredProjectResult;
  }) => Effect.Effect<Option.Option<NormalizedPath.NormalizedPath>> = ({ result }) =>
    pipe(Effect.fromNullable(result.configFileName), Effect.flatMap(NormalizedPath.normalize), Effect.option);
}

const openClientFile: (
  options: Omit<Fields, 'tsconfigPath'>,
) => Effect.Effect<ClientFile, ProjectServiceError.DiagnosticError, ProjectService.ProjectService> = flow(
  Effect.succeed,
  Effect.tap(Effect.logDebug),
  Effect.bind('projectService', () => ProjectService.ProjectService),
  Effect.bind('result', ({ fileContent, filePath, hasMixedContent, projectService, scriptKind, workspacePath }) =>
    Effect.succeed(
      projectService
        .projectService()
        .openClientFileWithNormalizedPath(
          filePath,
          Option.getOrUndefined(fileContent),
          Option.getOrUndefined(scriptKind),
          hasMixedContent,
          Option.getOrUndefined(workspacePath),
        ),
    ),
  ),
  Effect.bind('tsconfigPath', OpenConfiguredProjectResult.getTsconfigPath),
  Effect.tap(OpenConfiguredProjectResult.handleErrors),
  Effect.map(
    ({ fileContent, filePath, hasMixedContent, scriptKind, tsconfigPath, workspacePath }) =>
      new ClientFile({
        fileContent,
        filePath,
        hasMixedContent,
        scriptKind,
        tsconfigPath,
        workspacePath,
      }),
  ),
);

export const open: (
  options: Options.OpenClientFile,
) => Effect.Effect<
  ClientFile,
  Error | ProjectServiceError.DiagnosticError,
  Path.Path | ProjectService.ProjectService | Scope.Scope
> = Effectify.effectify({
  body: (options: Options.OpenClientFile) =>
    Effect.acquireRelease(
      Effect.Do.pipe(
        Effect.tap(() => Effect.log('Opening client file', Struct.omit(options, 'fileContent'))), // TODO: verbose
        Effect.bind('filePath', () => NormalizedPath.normalize(options.filePath)),
        Effect.bind('workspacePath', () => NormalizedPath.optional(options.workspacePath)),
        Effect.flatMap(({ filePath, workspacePath }) =>
          openClientFile({
            fileContent: Option.fromNullable(options.fileContent),
            filePath,
            hasMixedContent: options.hasMixedContent ?? false,
            scriptKind: Option.fromNullable(options.scriptKind),
            workspacePath,
          }),
        ),
        Effect.tap((clientFile) => Effect.log('Opened client file', clientFile)), // TODO: verbose
      ),
      (clientFile) =>
        pipe(
          Effect.log('Closing client file', clientFile.filePath),
          Effect.flatMap(() => ProjectService.ProjectService),
          Effect.tap((projectService) => {
            projectService.projectService().closeClientFile(clientFile.filePath);
          }),
        ),
    ),
  options: ({ filePath, workspacePath }) =>
    Effect.map(Path.Path, (path) => ({
      name: `projectService-openClientFile-${path.relative(workspacePath ?? process.cwd(), filePath)}`,
    })),
});
