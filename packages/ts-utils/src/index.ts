/* eslint-disable max-classes-per-file */

import debug from 'debug';
import { Array, Data, Effect, flow, pipe } from 'effect';
import ts from 'typescript';

import * as ServerHost from './ServerHost.js';

/**
 * TSServer setup.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-function
const doNothing = (): void => {};

const logTsserverErr = debug('tsserver-resolver:tsserver:err');
const logTsserverInfo = debug('tsserver-resolver:tsserver:info');
const logTsserverPerf = debug('tsserver-resolver:tsserver:perf');
const logTsserverEvent = debug('tsserver-resolver:tsserver:event');

const logger: ts.server.Logger = {
  close: doNothing,
  endGroup: doNothing,
  getLogFileName: (): undefined => undefined,
  hasLevel: (): boolean => true,
  info(s) {
    this.msg(s, ts.server.Msg.Info);
  },
  loggingEnabled: (): boolean => logTsserverInfo.enabled || logTsserverErr.enabled || logTsserverPerf.enabled,
  msg: (s, type) => {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (type) {
      case ts.server.Msg.Err:
        logTsserverErr(s);
        break;
      case ts.server.Msg.Perf:
        logTsserverPerf(s);
        break;
      default:
        logTsserverInfo(s);
        break;
    }
  },
  perftrc(s) {
    this.msg(s, ts.server.Msg.Perf);
  },
  startGroup: doNothing,
};

export type ProjectServiceError = NoProgramFound | NotConfigured | NoProjectFound | NoSourceFileFound;

export class NoProjectFound extends Data.TaggedClass('NoProjectFound')<
  Readonly<{
    file: string;
    tsconfigPath: string;
  }>
> {
  message = 'No project found';
}

export class NoProgramFound extends Data.TaggedClass('NoProgramFound')<
  Readonly<{
    file: string;
    tsconfigPath: string;
    projectName: string;
  }>
> {
  message = 'No program found';
}

export class NoSourceFileFound extends Data.TaggedClass('NoSourceFileFound')<
  Readonly<{
    file: string;
    tsconfigPath: string;
    projectName: string;
  }>
> {
  message = 'No source file found';
}

export class NotConfigured extends Data.TaggedClass('NotConfigured')<{}> {
  message = 'Project service not configured';

  // constructor() {
  //   super();
  // }
}

const getRootTsConfig: (options: {
  projectService: ts.server.ProjectService;
}) => Effect.Effect<ts.server.NormalizedPath, ProjectServiceError> = flow(
  Effect.succeed,
  Effect.bind('configuredProjects', ({ projectService }) => Effect.succeed(projectService.configuredProjects)),
  Effect.bind('rootProject', ({ configuredProjects }) => Effect.succeed(configuredProjects.values().next().value)),
  Effect.flatMap(({ rootProject }) => Effect.fromNullable(rootProject)),
  Effect.mapError(() => new NotConfigured()),
  Effect.map((rootProject) => rootProject.getConfigFilePath()),
);

const getProject: (
  projectService: ts.server.ProjectService,
) => (options: { file: string }) => Effect.Effect<ts.server.Project, ProjectServiceError> =
  (projectService) =>
  ({ file }) =>
    pipe(
      Effect.fromNullable(projectService.getDefaultProjectForFile(ts.server.toNormalizedPath(file), false)),
      Effect.catchAll(() =>
        getRootTsConfig({ projectService }).pipe(Effect.flatMap((tsconfigPath) => Effect.fail(new NoProjectFound({ file, tsconfigPath })))),
      ),
    );

const getProgram: (
  projectService: ts.server.ProjectService,
) => (options: { file: string }) => Effect.Effect<ts.Program, ProjectServiceError> =
  (projectService) => ({ file }) =>
    pipe(
      { file },
      getProject(projectService),
      Effect.flatMap((project) => pipe(
        Effect.fromNullable(project.getLanguageService().getProgram()),
        Effect.catchAll(() =>
          getRootTsConfig({ projectService }).pipe(Effect.flatMap((tsconfigPath) => Effect.fail(new NoProgramFound({ file, tsconfigPath, projectName: project.getProjectName() })))),
        ),
      )),
    );

const getSourceFile: (
  projectService: ts.server.ProjectService,
) => (options: { file: string }) => Effect.Effect<ts.SourceFile, ProjectServiceError> =
  (projectService) => ({ file }) =>
    pipe(
      Effect.succeed({ file }),
      Effect.bind('project', getProject(projectService)),
      Effect.bind('program', getProgram(projectService)),
      Effect.flatMap(({ file, project, program }) => pipe(
        Effect.fromNullable(program.getSourceFile(file)),
        Effect.catchAll(() =>
          getRootTsConfig({ projectService }).pipe(Effect.flatMap((tsconfigPath) => Effect.fail(new NoSourceFileFound({ file, tsconfigPath, projectName: project.getProjectName() })))),
        ),
      )),
    );

const getTypeChecker: (
  projectService: ts.server.ProjectService,
) => (options: { file: string }) => Effect.Effect<ts.TypeChecker, ProjectServiceError> =
  (projectService) => ({ file }) =>
    pipe(
      Effect.succeed({ file }),
      Effect.bind('project', getProject(projectService)),
      Effect.bind('program', getProgram(projectService)),
      Effect.flatMap(({ file, project, program }) => pipe(
        Effect.fromNullable(program.getTypeChecker()),
        Effect.catchAll(() =>
          getRootTsConfig({ projectService }).pipe(Effect.flatMap((tsconfigPath) => Effect.fail(new NoSourceFileFound({ file, tsconfigPath, projectName: project.getProjectName() })))),
        ),
      )),
    );

const getAmbientModules: (
  projectService: ts.server.ProjectService,
) => (options: { file: string }) => Effect.Effect<string[], ProjectServiceError> =
  (projectService) => ({ file }) =>
    pipe(
      Effect.succeed({ file }),
      Effect.bind('typeChecker', getTypeChecker(projectService)),
      Effect.map(({ typeChecker }) => pipe(
        typeChecker.getAmbientModules(),
        Array.flatMap((module) => module.getDeclarations() ?? []),
        Array.map((declaration) => declaration.getSourceFile().fileName,
      )),
    ));

export class ProjectService extends Effect.Service<ProjectService>()("ProjectService", {
  accessors: true,
  effect: Effect.gen(function* () {
     const host: ts.server.ServerHost = yield* ServerHost.ServerHost;
    const projectService = new ts.server.ProjectService({
      cancellationToken: { isCancellationRequested: (): boolean => false },
      eventHandler: (e): void => {
        if (logTsserverEvent.enabled) logTsserverEvent(e);
      },
      host,
      jsDocParsingMode: ts.JSDocParsingMode.ParseNone,
      logger,
      session: undefined,
      useInferredProjectPerProjectRoot: false,
      useSingleInferredProject: false,
    });

    return {
      getProject: (file: string) => getProject(projectService)({ file }),
      getProgram: (file: string) => getProgram(projectService)({ file }),
      getSourceFile: (file: string) => getSourceFile(projectService)({ file }),
      getTypeChecker: (file: string) => getTypeChecker(projectService)({ file }),
      getAmbientModules: (file: string) => getAmbientModules(projectService)({ file }),

   };
 })
}) {}
//
// // /**
// //  * Implementation.
// //  */
// //
// // const logInfo = debug('tsserver-resolver:resolver:info');
// // const logError = debug('tsserver-resolver:resolver:error');
// // const logTrace = debug('tsserver-resolver:resolver:trace');
// //
// // const logRight: <R>(
// //   message: (args: NoInfer<R>) => Parameters<Debugger>,
// //   log?: Debugger,
// // ) => <L = never>(self: Effect.Effect<R, L>) => Effect.Effect<R, L> =
// //   (message, log = logInfo) =>
// //   (self) =>
// //     Effect.map(self, (args) => {
// //       log(...message(args));
// //       return args;
// //     });
// //
// // const logLeft: <L>(
// //   message: (args: NoInfer<L>) => Parameters<Debugger>,
// //   log?: Debugger,
// // ) => <R>(self: Effect.Effect<R, L>) => Effect.Effect<R, L> =
// //   (message, log = logError) =>
// //   (self) =>
// //     Effect.mapLeft(self, (args) => {
// //       log(...message(args));
// //       return args;
// //     });
// //
// // const NOT_FOUND: importX.ResultNotFound = { found: false };
// //
// // const fail: <T extends Array<unknown>>(
// //   message: (...value: NoInfer<T>) => Parameters<Debugger>,
// //   log?: Debugger,
// // ) => (...value: T) => importX.ResultNotFound =
// //   (message, log = logError) =>
// //   (...value) => {
// //     log(...message(...value));
// //     return NOT_FOUND;
// //   };
// //
// // export const success: (path: string) => importX.ResultFound = (path) => ({ found: true, path });
// //
// // /**
// //  * Get a `ProjectService` instance.
// //  */
// // const getProjectService: () => Effect.Effect<ts.server.ProjectService, importX.ResultNotFound> = () =>
// //   Effect.right(projectService);
// //
// // /**
// //  * Open's the file with tsserver so it loads the project that includes the file.
// //  *
// //  * @remarks Not necessary if using the `projectService` from `typescript-eslint`.
// //  */
// // export const openClientFile: (options: {
// //   file: string;
// // }) => Effect.Effect<ts.server.OpenConfiguredProjectResult, importX.ResultNotFound> = flow(
// //   Effect.right,
// //   logRight(({ file }) => ['Opening client file:', { file }], logTrace),
// //   Effect.bind('projectService', getProjectService),
// //   Effect.flatMap(({ file, projectService }) =>
// //     Effect.liftPredicate(
// //       projectService.openClientFile(file, undefined, undefined, process.cwd()),
// //       ({ configFileErrors }) => configFileErrors === undefined || configFileErrors.length === 0,
// //       fail(({ configFileErrors }) => ['Failed to open:', { diagnostics: configFileErrors, file }], logTrace),
// //     ),
// //   ),
// //   logRight(({ configFileName }) => ['Opened client file:', { clientFile: configFileName }], logTrace),
// // );
// //
