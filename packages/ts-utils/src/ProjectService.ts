/* eslint-disable max-classes-per-file */

import type { Layer } from 'effect';
import { Array, Data, Schema as S, Effect, flow, Function, pipe, Record, Runtime } from 'effect';
import ts from 'typescript';

import * as ServerHost from './ServerHost.js';

/**
 * TSServer setup.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-function
const doNothing = (): void => {};

const makeLogger: (runSync: <A, E>(effect: Effect.Effect<A, E, never>) => A) => ts.server.Logger = (runSync) => ({
  close: doNothing,
  endGroup: doNothing,
  getLogFileName: (): undefined => undefined,
  hasLevel: (): boolean => true,
  info(s) {
    this.msg(s, ts.server.Msg.Info);
  },
  loggingEnabled: (): boolean => true,
  msg: (s, type) => {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (type) {
      case ts.server.Msg.Err:
        pipe(Effect.logError(s, { type }), runSync);
        break;
      case ts.server.Msg.Perf:
        pipe(Effect.logDebug(s, { type }), runSync);
        break;
      default:
        pipe(Effect.logInfo(s, { type }), runSync);
        break;
    }
  },
  perftrc(s) {
    this.msg(s, ts.server.Msg.Perf);
  },
  startGroup: doNothing,
});

export type ProjectServiceError = NoProgramFound | NoProjectFound | NoSourceFileFound | NotConfigured | ParseError;

export class DiagnosticError extends Data.TaggedClass('NotConfigured')<{
  diagnostic: Array.NonEmptyReadonlyArray<ts.Diagnostic>;
}> {
  message = 'Diagnostic error occurred';
}

export class NoProgramFound extends Data.TaggedClass('NoProgramFound')<
  Readonly<{
    file: string;
    projectName: string;
    tsconfigPath: string;
  }>
> {
  message = 'No program found';
}

export class NoProjectFound extends Data.TaggedClass('NoProjectFound')<
  Readonly<{
    file: string;
    tsconfigPath: string;
  }>
> {
  message = 'No project found';
}

export class NoSourceFileFound extends Data.TaggedClass('NoSourceFileFound')<
  Readonly<{
    file: string;
    projectName: string;
    tsconfigPath: string;
  }>
> {
  message = 'No source file found';
}

export class ParseError extends Data.TaggedClass('ParseError')<{
  reason: string
}> {
  message = 'Parsing error occurred';
}

export class NotConfigured extends Data.TaggedClass('NotConfigured')<{}> {
  message = 'Project service not configured';
}

const getRootTsConfig: (
  projectService: ts.server.ProjectService,
) => Effect.Effect<ts.server.NormalizedPath, ProjectServiceError> = Effect.functionWithSpan({
  body: (projectService: ts.server.ProjectService) =>
    Effect.Do.pipe(
      Effect.bind('configuredProjects', () => Effect.succeed(projectService.configuredProjects)),
      Effect.bind('rootProject', ({ configuredProjects }) => Effect.succeed(configuredProjects.values().next().value)),
      Effect.flatMap(({ rootProject }) => Effect.fromNullable(rootProject)),
      Effect.mapError(() => new NotConfigured()),
      Effect.map((rootProject) => rootProject.getConfigFilePath()),
    ),
  captureStackTrace: true,
  options: () => ({ name: 'projectService-getRootTsConfig' }),
});

/**
 * Open's the file with tsserver so it loads the project that includes the file.
 */
const openClientFile: {
  (options: {
    directory?: string | undefined;
    file: string;
  }): (
    projectService: ts.server.ProjectService,
  ) => Effect.Effect<ts.server.OpenConfiguredProjectResult, ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory?: string | undefined; file: string },
  ): Effect.Effect<ts.server.OpenConfiguredProjectResult, ProjectServiceError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (
      projectService: ts.server.ProjectService,
      { directory, file }: { directory?: string | undefined; file: string },
    ) =>
      pipe(
        Effect.logDebug('Opening client file', { directory, file }),
        Effect.flatMap(() =>
          pipe(
            Effect.sync(() => projectService.openClientFile(file, undefined, undefined, directory ?? process.cwd())),
            Effect.flatMap((configuredProject) => {
              const { configFileErrors } = configuredProject;
              if (configFileErrors && Array.isNonEmptyReadonlyArray(configFileErrors)) {
                return Effect.fail(new DiagnosticError({ diagnostic: configFileErrors }));
              }
              return Effect.succeed(configuredProject);
            }),
          ),
        ),
      ),
    captureStackTrace: true,
    options: (_, { file }) => ({ name: `projectService-openClientFile-${file}` }), // TODO: relative
  }),
);

const getProject: {
  (options: {
    directory?: string | undefined;
    file: string;
  }): (projectService: ts.server.ProjectService) => Effect.Effect<ts.server.Project, ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory?: string | undefined; file: string },
  ): Effect.Effect<ts.server.Project, ProjectServiceError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (
      projectService: ts.server.ProjectService,
      { directory, file }: { directory?: string | undefined; file: string },
    ) =>
      pipe(
        openClientFile(projectService, { directory, file }),
        Effect.flatMap(() =>
          pipe(
            Effect.fromNullable(projectService.getDefaultProjectForFile(ts.server.toNormalizedPath(file), false)),
            Effect.catchAll(() =>
              getRootTsConfig(projectService).pipe(
                Effect.flatMap((tsconfigPath) => Effect.fail(new NoProjectFound({ file, tsconfigPath }))),
              ),
            ),
          ),
        ),
      ),
    captureStackTrace: true,
    options: (_, { file }) => ({ name: `projectService-getProject-${file}` }), // TODO: relative
  }),
);

const getProgram: {
  (options: {
    directory?: string | undefined;
    file: string;
  }): (projectService: ts.Program) => Effect.Effect<ts.server.Project, ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory?: string | undefined; file: string },
  ): Effect.Effect<ts.Program, ProjectServiceError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (projectService, { directory, file }: { directory?: string | undefined; file: string }) =>
      pipe(
        getProject(projectService, { directory, file }),
        Effect.flatMap((project) =>
          pipe(
            Effect.fromNullable(project.getLanguageService().getProgram()),
            Effect.catchAll(() =>
              getRootTsConfig(projectService).pipe(
                Effect.flatMap((tsconfigPath) =>
                  Effect.fail(new NoProgramFound({ file, projectName: project.getProjectName(), tsconfigPath })),
                ),
              ),
            ),
          ),
        ),
      ),
    captureStackTrace: true,
    options: (_, { file }) => ({ name: `projectService-getProgram-${file}` }), // TODO: relative
  }),
);

const getSourceFile: {
  (options: {
    directory?: string | undefined;
    file: string;
  }): (projectService: ts.Program) => Effect.Effect<ts.SourceFile, ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory?: string | undefined; file: string },
  ): Effect.Effect<ts.SourceFile, ProjectServiceError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (
      projectService: ts.server.ProjectService,
      { directory, file }: { directory?: string | undefined; file: string },
    ) =>
      Effect.Do.pipe(
        Effect.bind('project', () => getProject(projectService, { directory, file })),
        Effect.bind('program', () => getProgram(projectService, { directory, file })),
        Effect.flatMap(({ program, project }) =>
          pipe(
            Effect.fromNullable(program.getSourceFile(file)),
            Effect.catchAll(() =>
              getRootTsConfig(projectService).pipe(
                Effect.flatMap((tsconfigPath) =>
                  Effect.fail(new NoSourceFileFound({ file, projectName: project.getProjectName(), tsconfigPath })),
                ),
              ),
            ),
          ),
        ),
      ),
    captureStackTrace: true,
    options: (_, { file }) => ({ name: `projectService-getSourceFile-${file}` }), // TODO: relative
  }),
);

/**
 * Get a type check from a project file.
 */
const getTypeChecker: {
  (options: {
    directory?: string | undefined;
    file: string;
  }): (projectService: ts.server.ProjectService) => Effect.Effect<ts.TypeChecker, ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory?: string | undefined; file: string },
  ): Effect.Effect<ts.TypeChecker, ProjectServiceError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (
      projectService: ts.server.ProjectService,
      { directory, file }: { directory?: string | undefined; file: string },
    ) =>
      Effect.Do.pipe(
        Effect.bind('project', () => getProject(projectService, { directory, file })),
        Effect.bind('program', () => getProgram(projectService, { directory, file })),
        Effect.flatMap(({ program, project }) =>
          pipe(
            Effect.fromNullable(program.getTypeChecker()),
            Effect.catchAll(() =>
              getRootTsConfig(projectService).pipe(
                Effect.flatMap((tsconfigPath) =>
                  Effect.fail(new NoSourceFileFound({ file, projectName: project.getProjectName(), tsconfigPath })),
                ),
              ),
            ),
          ),
        ),
      ),
    captureStackTrace: true,
    options: (_, { file }) => ({ name: `projectService-getTypeChecker-${file}` }), // TODO: relative
  }),
);

/**
 * Get ambient modules from a project file.
 */
const getAmbientModules: {
  (options: {
    directory?: string | undefined;
    file: string;
  }): (projectService: ts.server.ProjectService) => Effect.Effect<Readonly<Record<string, ReadonlyArray<string>>>, ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory: string | undefined; file: string },
  ): Effect.Effect<Readonly<Record<string, ReadonlyArray<string>>>, ProjectServiceError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (
      projectService: ts.server.ProjectService,
      { directory, file }: { directory?: string | undefined; file: string },
    ): Effect.Effect<Readonly<Record<string, ReadonlyArray<string>>>, ProjectServiceError> =>
      Effect.Do.pipe(
        Effect.bind('typeChecker', () => getTypeChecker(projectService, { directory, file })),
        Effect.flatMap(({ typeChecker }) => {
          const t = pipe(
            typeChecker.getAmbientModules(),
            Array.map((module) => Effect.all([
                S.decode(S.parseJson(S.String))(module.getName()),
                pipe(
                  (module.getDeclarations() ?? []),
                  Array.map((declaration) => declaration.getSourceFile().fileName),
                  Effect.succeed,
                ),
            ])),
            Effect.all,
            v=>v,
            Effect.map(Record.fromEntries),
            Effect.mapError((error) => new ParseError({ reason: error.toString() })),
          );
          return t;
        }
        ),
      ),
    captureStackTrace: true,
    options: (_, { file }) => ({ name: `projectService-gettAmbientModules-${file}` }), // TODO: relative
  }),
);

export class ProjectService extends Effect.Service<ProjectService>()('ProjectService', {
  accessors: true,
  dependencies: [ServerHost.layer],
  effect: Effect.gen(function* () {
    const runSync = Runtime.runSync(yield* Effect.runtime());
    const host: ts.server.ServerHost = yield* ServerHost.ServerHost;
    const projectService = new ts.server.ProjectService({
      cancellationToken: { isCancellationRequested: (): boolean => false },
      eventHandler: (e): void => {
        pipe(Effect.logInfo(e), runSync);
      },
      host,
      jsDocParsingMode: ts.JSDocParsingMode.ParseNone,
      logger: makeLogger(runSync),
      session: undefined,
      useInferredProjectPerProjectRoot: false,
      useSingleInferredProject: false,
    });

    return {
      getAmbientModules: (file: string, directory?: string) => getAmbientModules(projectService, { directory, file }),
      getProgram: (file: string, directory?: string) => getProgram(projectService, { directory, file }),
      getProject: (file: string, directory?: string) => getProject(projectService, { directory, file }),
      getSourceFile: (file: string, directory?: string) => getSourceFile(projectService, { directory, file }),
      getTypeChecker: (file: string, directory?: string) => getTypeChecker(projectService, { directory, file }),
      openClientFile: (file: string, directory?: string) => openClientFile(projectService, { directory, file }),
    };
  }),
}) {}

export const layer: Layer.Layer<ProjectService> = ProjectService.Default;

export const layerNoDeps: Layer.Layer<ProjectService, never, ServerHost.ServerHost> =
  ProjectService.DefaultWithoutDependencies;
