import type { Layer } from 'effect';
import { Array, Effect, Function, Match, pipe, Record, Runtime, Schema as S } from 'effect';
import ts from 'typescript';

import * as ProjectServiceError from './ProjectServiceError/index.js';
import * as ServerHost from './ServerHost.js';

/**
 * Noop helper.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
const doNothing = (): void => {};

/**
 * Logger function for `ts.server.Msg`'s in a specific Effect runtime.
 */
const log = (runSync: <A, E>(effect: Effect.Effect<A, E>) => A): {
  (type: ts.server.Msg): (s: string) =>void;
  (s: string, type: ts.server.Msg): void;
} => Function.dual(
  2,
  (s: string, type: ts.server.Msg) => Match.value(type).pipe(
  Match.when(ts.server.Msg.Err, (type) => pipe(Effect.logError(s, { type }), runSync)),
  Match.when(ts.server.Msg.Perf, (type) => pipe(Effect.logError(s, { type }), runSync)),
  Match.orElse((type) => pipe(Effect.logInfo(s, { type }), runSync)),
));

/**
 * `ts.server.ProjectService` logger in a specific Effect runtime.
 */
const makeLogger: (runSync: <A, E>(effect: Effect.Effect<A, E>) => A) => ts.server.Logger = (runSync) => ({
  close: doNothing,
  endGroup: doNothing,
  getLogFileName: (): undefined => undefined,
  hasLevel: (): boolean => true,
  info: log(runSync)(ts.server.Msg.Info),
  loggingEnabled: (): boolean => true,
  msg: log(runSync),
  perftrc: log(runSync)(ts.server.Msg.Perf),
  startGroup: doNothing,
});

/**
 * Get the root most `tsconfig.json` for the first configured project.
 */
const getRootTsConfig: (
  projectService: ts.server.ProjectService,
) => Effect.Effect<ts.server.NormalizedPath, ProjectServiceError.ProjectServiceError> = Effect.functionWithSpan({
  body: (projectService: ts.server.ProjectService) =>
    Effect.Do.pipe(
      Effect.bind('configuredProjects', () => Effect.succeed(projectService.configuredProjects)),
      Effect.bind('rootProject', ({ configuredProjects }) => Effect.succeed(configuredProjects.values().next().value)),
      Effect.flatMap(({ rootProject }) => Effect.fromNullable(rootProject)),
      Effect.mapError(() => new ProjectServiceError.NotConfigured()),
      Effect.map((rootProject) => rootProject.getConfigFilePath()),
    ),
  captureStackTrace: true,
  options: () => ({ name: 'projectService-getRootTsConfig' }),
});

/**
 * Open's the file in the `ts.server.ProjectService` so it loads the project(s) that includes the file.
 *
 * @paramm options.file The file to get the project for.
 * @paramm options.directory The directory of the root project.  Defaults to `process.cwd()`.
 */
const openClientFile: {
  (options: {
    directory?: string | undefined;
    file: string;
  }): (
    projectService: ts.server.ProjectService,
  ) => Effect.Effect<ts.server.OpenConfiguredProjectResult, ProjectServiceError.ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory?: string | undefined; file: string },
  ): Effect.Effect<ts.server.OpenConfiguredProjectResult, ProjectServiceError.ProjectServiceError>;
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
                return Effect.fail(new ProjectServiceError.DiagnosticError({ diagnostic: configFileErrors }));
              }
              return Effect.succeed(configuredProject);
            }),
          ),
        ),
        Effect.tap((result) => Effect.logDebug('Opened client file', { directory, file, tsconfig: result.configFileName })),
      ),
    captureStackTrace: true,
    options: (_, { file }) => ({ name: `projectService-openClientFile-${file}` }), // TODO: relative
  }),
);

/**
 * Get the `ts.server.Project` for a given file.
 *
 * @paramm options.file The file to get the project for.
 * @paramm options.directory The directory of the root project.  Defaults to `process.cwd()`.
 */
const getProject: {
  (options: {
    directory?: string | undefined;
    file: string;
  }): (
    projectService: ts.server.ProjectService,
  ) => Effect.Effect<ts.server.Project, ProjectServiceError.ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory?: string | undefined; file: string },
  ): Effect.Effect<ts.server.Project, ProjectServiceError.ProjectServiceError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (
      projectService: ts.server.ProjectService,
      { directory, file }: { directory?: string | undefined; file: string },
    ) =>
      // TODO: log
      pipe(
        openClientFile(projectService, { directory, file }),
        Effect.flatMap(() =>
          pipe(
            Effect.fromNullable(projectService.getDefaultProjectForFile(ts.server.toNormalizedPath(file), false)),
            Effect.catchAll(() =>
              getRootTsConfig(projectService).pipe(
                Effect.flatMap((tsconfigPath) =>
                  Effect.fail(new ProjectServiceError.NoProjectFound({ file, tsconfigPath })),
                ),
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
  }): (projectService: ts.Program) => Effect.Effect<ts.server.Project, ProjectServiceError.ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory?: string | undefined; file: string },
  ): Effect.Effect<ts.Program, ProjectServiceError.ProjectServiceError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (projectService, { directory, file }: { directory?: string | undefined; file: string }) =>
      // TODO: log
      pipe(
        getProject(projectService, { directory, file }),
        Effect.flatMap((project) =>
          pipe(
            Effect.fromNullable(project.getLanguageService().getProgram()),
            Effect.catchAll(() =>
              getRootTsConfig(projectService).pipe(
                Effect.flatMap((tsconfigPath) =>
                  Effect.fail(
                    new ProjectServiceError.NoProgramFound({
                      file,
                      projectName: project.getProjectName(),
                      tsconfigPath,
                    }),
                  ),
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
  }): (projectService: ts.Program) => Effect.Effect<ts.SourceFile, ProjectServiceError.ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory?: string | undefined; file: string },
  ): Effect.Effect<ts.SourceFile, ProjectServiceError.ProjectServiceError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (
      // TODO: log
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
                  Effect.fail(
                    new ProjectServiceError.NoSourceFileFound({
                      file,
                      projectName: project.getProjectName(),
                      tsconfigPath,
                    }),
                  ),
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
      // TODO: log
  }): (
    projectService: ts.server.ProjectService,
  ) => Effect.Effect<ts.TypeChecker, ProjectServiceError.ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory?: string | undefined; file: string },
  ): Effect.Effect<ts.TypeChecker, ProjectServiceError.ProjectServiceError>;
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
                  Effect.fail(
                    new ProjectServiceError.NoSourceFileFound({
                      file,
                      projectName: project.getProjectName(),
                      tsconfigPath,
                    }),
                  ),
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
      // TODO: log
    directory?: string | undefined;
    file: string;
  }): (
    projectService: ts.server.ProjectService,
  ) => Effect.Effect<Readonly<Record<string, ReadonlyArray<string>>>, ProjectServiceError.ProjectServiceError>;
  (
    projectService: ts.server.ProjectService,
    options: { directory: string | undefined; file: string },
  ): Effect.Effect<Readonly<Record<string, ReadonlyArray<string>>>, ProjectServiceError.ProjectServiceError>;
} = Function.dual(
  2,
  Effect.functionWithSpan({
    body: (
      projectService: ts.server.ProjectService,
      { directory, file }: { directory?: string | undefined; file: string },
    ): Effect.Effect<Readonly<Record<string, ReadonlyArray<string>>>, ProjectServiceError.ProjectServiceError> =>
      Effect.Do.pipe(
        Effect.bind('typeChecker', () => getTypeChecker(projectService, { directory, file })),
        Effect.flatMap(({ typeChecker }) => {
          const t = pipe(
            typeChecker.getAmbientModules(),
            Array.map((module) =>
              Effect.all([
                S.decode(S.parseJson(S.String))(module.getName()),
                pipe(
                  module.getDeclarations() ?? [],
                  Array.map((declaration) => declaration.getSourceFile().fileName),
                  Effect.succeed,
                ),
              ]),
            ),
            Effect.all,
            (v) => v,
            Effect.map(Record.fromEntries),
            Effect.mapError((error) => new ProjectServiceError.ParseError({ reason: error.toString() })),
          );
          return t;
        }),
      ),
    captureStackTrace: true,
    options: (_, { file }) => ({ name: `projectService-gettAmbientModules-${file}` }), // TODO: relative
  }),
);

      // TODO: log
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
