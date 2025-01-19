/* eslint-disable max-classes-per-file */
/* eslint-disable astal/max-lines-per-function */
import type { Cause, FiberId, HashSet, Layer } from 'effect';
import type { Scope } from 'effect';
import {
  Chunk,
  Effect,
  Fiber,
  flow,
  Function,
  Inspectable,
  Match,
  Option,
  pipe,
  Stream,
  SynchronizedRef,
} from 'effect';
import type { Emit } from 'effect/StreamEmit';
import ts from 'typescript';

import * as ServerHost from './ServerHost.js';
import * as Logger from './Logger.js';

// TODO: latch logs
// turn off pretty or make better default logger
/**
 * Noop helper.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
const doNothing = (): void => {};

/**
 * Log a `ts.server.Msg`'s in a specific Effect runtime.
 */
const log: {
  (type: ts.server.Msg): (s: string) => Effect.Effect<Chunk.Chunk<never>, Option.Option<never>>;
  (s: string, type: ts.server.Msg): Effect.Effect<Chunk.Chunk<never>, Option.Option<never>>;
} = Function.dual(
  2,
  (s: string, type: ts.server.Msg): Effect.Effect<Chunk.Chunk<never>, Option.Option<never>> =>
    Match.value(type).pipe(
      Match.when(ts.server.Msg.Err, (type) => Logger.error( 'tsserver:error', s, { type })),
      Match.when(ts.server.Msg.Perf, (type) => Logger.trace( 'tsserver:perf', s, { type })),
      Match.orElse((type) => Logger.info('tsserver:info', s, { type })),
      Effect.map(() => Chunk.empty()),
    ),
);

const andForget = <A>(_promise: Promise<A>): void => {};

/**
 * Create a ts.server.Logger` that logs to a specific Effect runtime.
 */
const makeLogger = <R>(f: (logger: ts.server.Logger) => Effect.Effect<void, never, R>): Stream.Stream<void, never, R> =>
  pipe(
    Stream.asyncEffect((emit: Emit<never, never, void, void>) =>
      f({
        close: doNothing, // TODO:
        endGroup: doNothing,
        getLogFileName: (): undefined => undefined,
        hasLevel: (): boolean => true,
        info: flow(log(ts.server.Msg.Info), emit, andForget),
        loggingEnabled: (): boolean => true,
        msg: flow(log, emit, andForget),
        perftrc: flow(log(ts.server.Msg.Perf), emit, andForget),
        startGroup: doNothing,
      }),
    ),
  );

export class CancellationToken {
  private readonly cancelled = SynchronizedRef.unsafeMake(false);

  interrupt(interruptors: HashSet.HashSet<FiberId.FiberId>): Effect.Effect<void> {
    return pipe(
      SynchronizedRef.set(this.cancelled, true),
      Effect.tap(() => Effect.logInfo('CancellationToken ::interrupt', { interruptors })),
    );
  }

  isCancellationRequested() {
    // console.log('isCancellationRequested');
    return Effect.runSync(
      pipe(
        SynchronizedRef.get(this.cancelled),
        Effect.tap(() => Effect.logInfo('CancellationToken ::isCancellationRequested')),
      ),
    );
  }

  reset() {
    return pipe(
      SynchronizedRef.set(this.cancelled, false),
      Effect.tap(() => Effect.logInfo('CancellationToken ::reset')),
    );
  }
}

// TODO: log
export class ProjectService extends Effect.Service<ProjectService>()('ProjectService', {
  accessors: true,
  dependencies: [ServerHost.layer],
  effect: Effect.gen(function* () {
    const host: ts.server.ServerHost = yield* ServerHost.ServerHost;
    const latch = yield* Effect.makeLatch();
    const cancellationToken = new CancellationToken();
    const projectService = yield* Effect.Do.pipe(
      Effect.bind('ref', () => SynchronizedRef.make(Option.none<ts.server.ProjectService>())),
      Effect.bind('stream', ({ ref }) =>
        Effect.sync(() =>
          makeLogger((logger) =>
            pipe(
              SynchronizedRef.set(
                ref,
                Option.some(
                  new ts.server.ProjectService({
                    // allowLocalPluginLoads?: boolean;
                    // canUseWatchEvents?: boolean;
                    // cancellationToken: HostCancellationToken;
                    cancellationToken,
                    // eventHandler?: ProjectServiceEventHandler;
                    eventHandler: (e): void => {
                      logger.info(Inspectable.stringifyCircular({ Event: e }, 2));
                    },
                    // globalPlugins?: readonly string[];
                    // host: ServerHost;
                    host,
                    // jsDocParsingMode?: JSDocParsingMode;
                    jsDocParsingMode: ts.JSDocParsingMode.ParseNone,
                    // logger: Logger;
                    logger,
                    // pluginProbeLocations?: readonly string[];
                    // serverMode?: LanguageServiceMode;
                    // session: Session<unknown> | undefined;
                    session: undefined,
                    // suppressDiagnosticEvents?: boolean;
                    // throttleWaitMilliseconds?: number;
                    // typesMapLocation?: string;
                    // typingsInstaller?: ITypingsInstaller;
                    // useInferredProjectPerProjectRoot: boolean;
                    useInferredProjectPerProjectRoot: false,
                    // useSingleInferredProject: boolean;
                    useSingleInferredProject: false,
                  }),
                ),
              ),
              Effect.andThen(() => latch.open),
            ),
          ),
        ),
      ),
      Effect.flatMap(({ ref, stream }) =>
        Effect.gen(function* () {
          yield* pipe(
            Stream.fromEffect(Effect.logInfo('Stream started')),
            Stream.concat(stream),
            Stream.ensuring(Effect.log('Stream ended')),
            Stream.runDrain,
            Effect.forkScoped,
          );

          yield* latch.whenOpen(Effect.void);
          return ref;
        }),
      ),
      Effect.flatMap((ref) => pipe(SynchronizedRef.get(ref), Effect.flatMap(Effect.flatMap(SynchronizedRef.make)))),
    );

    return {
      run: <A, E, R>(f: (projectService: ts.server.ProjectService) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
        Effect.suspend(() =>
          Effect.interruptibleMask<A, E, R>((restore) =>
            restore(
              pipe(
                Effect.logTrace('ProjectService :: latch :: whenOpen'),
                Effect.tap(() => latch.close),
                Effect.tap(() => Effect.logTrace('ProjectService :: latch :: closed')),
                Effect.flatMap(() => SynchronizedRef.get(projectService)),
                Effect.flatMap(f),
                Effect.fork,
                Effect.flatMap(Fiber.join),
                Effect.onInterrupt((interruptors) =>
                  pipe(
                    Effect.logTrace('ProjectService :: run :: onInterrupt'),
                    Effect.flatMap(() => cancellationToken.interrupt(interruptors)),
                  ),
                ),
                Effect.tap(() => cancellationToken.reset()),
                Effect.tap(() => latch.open),
                Effect.tap(() => Effect.logTrace('ProjectService :: latch :: opened')),
                latch.whenOpen,
              ),
            ),
          ),
        ),
      // getAmbientModules: (file: string, directory?: string) => getAmbientModules(projectService, { directory, file }),
      // getProgram: (file: string, directory?: string) => getProgram(projectService, { directory, file }),
      // getProject: (file: string, directory?: string) => getProject(projectService, { directory, file }),
      // getSourceFile: (file: string, directory?: string) => getSourceFile(projectService, { directory, file }),
      // getTypeChecker: (file: string, directory?: string) => getTypeChecker(projectService, { directory, file }),
    };
  }),
}) {}

// FIXME: error type
export const layer: Layer.Layer<ProjectService, Cause.NoSuchElementException, Scope.Scope> = ProjectService.Default;

/**
 * Get the root most `tsconfig.json` for the first configured project.
 */
// const getRootTsConfig: (
//   projectService: ts.server.ProjectService,
// ) => Effect.Effect<ts.server.NormalizedPath, ProjectServiceError.ProjectServiceError> = Effect.functionWithSpan({
//   body: (projectService: ts.server.ProjectService) =>
//     Effect.Do.pipe(
//       Effect.bind('configuredProjects', () => Effect.succeed(projectService.configuredProjects)),
//       Effect.bind('rootProject', ({ configuredProjects }) => Effect.succeed(configuredProjects.values().next().value)),
//       Effect.flatMap(({ rootProject }) => Effect.fromNullable(rootProject)),
//       Effect.mapError(() => new ProjectServiceError.NotConfigured()),
//       Effect.map((rootProject) => rootProject.getConfigFilePath()),
//     ),
//   captureStackTrace: true,
//   options: () => ({ name: 'projectService-getRootTsConfig' }),
// });

// const getDefaultProject: (
//   projectService: ts.server.ProjectService,
//   options: {
//     directory?: string | undefined;
//     ensureProject?: boolean | undefined;
//     file: string;
//   },
// ) => Effect.Effect<ts.server.NormalizedPath, ProjectServiceError.ProjectServiceError> = Effect.functionWithSpan({
//   body: (
//     projectService: ts.server.ProjectService,
//     options: {
//       directory?: string | undefined;
//       ensureProject?: boolean | undefined;
//       file: string;
//     },
//   ) =>
//     Effect.Do.pipe(
//       Effect.bind('configuredProjects', () =>
//         Effect.succeed(
//           projectService.getDefaultProjectForFile(
//             ts.server.toNormalizedPath(options.file),
//             options.ensureProject ?? true,
//           ),
//         ),
//       ),
//       Effect.flatMap(({ rootProject }) => Effect.fromNullable(rootProject)),
//       Effect.bind('rootProject', ({ configuredProjects }) => Effect.succeed(configuredProjects.values().next().value)),
//       Effect.flatMap(({ rootProject }) => Effect.fromNullable(rootProject)),
//       Effect.mapError(() => new ProjectServiceError.NotConfigured()),
//       Effect.map((rootProject) => rootProject.getConfigFilePath()),
//     ),
//   captureStackTrace: true,
//   options: () => ({ name: 'projectService-getRootTsConfig' }),
// });
// function getRootMostTsConfigUsingProjectReferences(
//   projectService: ts.server.ProjectService,
//   filePath: string
// ): string | undefined {
//   // Get the specific project for the file
//   const project = projectService.getDefaultProjectForFile(
//     filePath as ts.server.NormalizedPath,
//     /* ensureProject */ true
//   );
//
//   if (!project || project.projectKind !== ts.server.ProjectKind.Configured) {
//     return undefined; // No tsconfig.json found
//   }
//
//   // Start with the current tsconfig.json
//   let currentConfigPath = (project as ts.server.ConfiguredProject).getConfigFilePath();
//
//   // Map to track all tsconfig.json files and their references
//   const tsconfigToReferences = new Map<string, string[]>();
//
//   // Populate the map by iterating over all configured projects
//   projectService.configuredProjects.forEach((configuredProject) => {
//     const configPath = configuredProject.getConfigFilePath();
//     const parsedCommandLine = configuredProject.getParsedCommandLine();
//
//     if (parsedCommandLine?.projectReferences) {
//       tsconfigToReferences.set(
//         configPath,
//         parsedCommandLine.projectReferences.map((ref) => ref.path)
//       );
//     } else {
//       tsconfigToReferences.set(configPath, []);
//     }
//   });
//
//   // Reverse walk the projectReferences graph
//   while (true) {
//     let isReferenced = false;
//
//     for (const [configPath, references] of tsconfigToReferences) {
//       if (references.includes(currentConfigPath)) {
//         currentConfigPath = configPath; // Move up to the referencing tsconfig.json
//         isReferenced = true;
//         break;
//       }
//     }
//
//     if (!isReferenced) {
//       break; // Found the root-most tsconfig.json
//     }
//   }
//
//   return currentConfigPath;
// }

// export namespace Options {
//   export namespace Effectify {
//     export interface Result<A> {
//       result: A;
//     }
//   }
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   export interface Effectify<Args extends Array<any>, A extends { result: any }, E, R> {
//     body: (projectService: ts.server.ProjectService, path: Path.Path, ...args: Args) => Effect.Effect<A, E, R>;
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     logEnd: (fields: NoInfer<A>, path: Path.Path, ...args: NoInfer<Args>) => [string, ...Array<any>];
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     logStart: (path: Path.Path, ...args: NoInfer<Args>) => [string, ...Array<any>];
//     name: (path: Path.Path, ...args: NoInfer<Args>) => string;
//   }
// }
//
// export namespace Options {
//   export interface OpenClientFile {
//     file: string;
//     fileContent?: string;
//     kind?: ts.ScriptKind;
//     workspace: string;
//   }
// }
// // configFileName?: NormalizedPath;
// // configFileErrors?: readonly Diagnostic[];
// const openClientFile = effectify({
//   body: (projectService, _, { file, fileContent, kind, workspace }: Options.OpenClientFile) => {
//     const result = projectService.openClientFileWithNormalizedPath(file, fileContent, kind, workspace);
//     if (result.configFileErrors && Array.isNonEmptyReadonlyArray(result.configFileErrors)) {
//       return Effect.fail(
//         new ProjectServiceError.DiagnosticError({
//           diagnostic: result.configFileErrors,
//           directory,
//           file,
//           kind,
//         }),
//       );
//     }
//     return Effect.succeed({ result });
//   },
//   logEnd: ({ result }, _, options) => [
//     'Opened client file',
//     {
//       ...Struct.omit(options, 'fileContent'),
//       tsconfig: result.configFileName,
//     },
//   ],
//   logStart: (_, options) => ['Opening client file', Struct.omit(options, 'fileContent')],
//   name: (path, { directory, file }) => `projectService-openClientFile-${path.relative(directory, file)}`,
// });
//
// export namespace Options {
//   export interface GetProject {
//     directory: string;
//     ensureProject?: boolean;
//     file: string;
//   }
// }
//
// export type Project = ts.server.Project; // ConfiguredProject | ts.server.Project & { projectKind: Exclude<ts.server.ProjectKind, ts.server.ProjectKind.Configured>;
//
// export namespace Project {
//   export type ConfiguredProject = ts.server.ConfiguredProject;
//   export const isConfigured = (self: Project): self is ConfiguredProject =>
//     self.projectKind === ts.server.ProjectKind.Configured;
//   export const getProjectName = (self: Project): string => self.getProjectName();
//   export const getKind = (self: Project): ts.server.ProjectKind => self.projectKind;
//   export const getConfigFilePath: {
//     (self: ConfiguredProject): string;
//     (self: Exclude<Project, ConfiguredProject>): string | undefined;
//   } = ((self: Project): string | undefined => (isConfigured(self) ? self.getConfigFilePath() : undefined)) as any;
// }
//
// /**
//  * Get the `ts.server.Project` for a given file.
//  */
// const getProject = effectify({
//   body: (projectService, _, { directory, ensureProject, file }: Options.GetProject) =>
//     Effect.Do.pipe(
//       Effect.bind('clientFile', () => openClientFile(projectService, { directory, file })),
//       Effect.bind('result', () =>
//         pipe(
//           Effect.fromNullable(
//             projectService.getDefaultProjectForFile(ts.server.toNormalizedPath(file), ensureProject ?? true),
//           ),
//           Effect.catchAll(() => Effect.fail(new ProjectServiceError.NoProjectFound({ directory, file }))),
//           Effect.tap((project) => {
//             if (ensureProject && !Project.isConfigured(project)) {
//               return Effect.fail(
//                 new ProjectServiceError.ProjectNotConfigured({
//                   directory,
//                   file,
//                   kind: Project.getKind(project),
//                   projectName: Project.getProjectName(project),
//                 }),
//               );
//             }
//             return Effect.void;
//           }),
//         ),
//       ),
//     ),
//   logEnd: ({ result }, _, options) => [
//     'Found project',
//     {
//       ...options,
//       kind: Project.getKind(result),
//       projectName: Project.getProjectName(result),
//       tsconfig: Project.getConfigFilePath(result),
//     },
//   ],
//   logStart: (_, options) => ['Getting project', options],
//   name: (path, { directory, file }) => `projectService-getProject-${path.relative(directory, file)}`,
// });
//
// export namespace Options {
//   export interface GetProgram {
//     directory: string;
//     ensureSynchronized?: boolean;
//     file: string;
//   }
// }
//
// /**
//  * Get the `ts.server.Project` for a given file.
//  */
// const getProgram = effectify({
//   body: (projectService, _, { directory, ensureSynchronized, file }: Options.GetProgram) =>
//     Effect.Do.pipe(
//       Effect.bind('project', () => getProject(projectService, { directory, file })),
//       Effect.bind('result', ({ project }) =>
//         pipe(
//           Effect.fromNullable(project.getLanguageService(ensureSynchronized ?? true).getProgram()),
//           Effect.catchAll(() =>
//             Effect.fail(
//               new ProjectServiceError.NoProgramFound({
//                 directory,
//                 file,
//                 kind: Project.getKind(project),
//                 projectName: Project.getProjectName(project),
//                 tsconfig: Project.getConfigFilePath(project),
//               }),
//             ),
//           ),
//         ),
//       ),
//     ),
//   logEnd: ({ project }, _, options) => [
//     'Found program',
//     {
//       ...options,
//       projectName: Project.getProjectName(project),
//       tsconfig: Project.getConfigFilePath(project),
//     },
//   ],
//   logStart: (_, options) => ['Getting program', options],
//   name: (path, { directory, file }) => `projectService-getProgram-${path.relative(directory, file)}`,
// });
//
// export namespace Options {
//   export interface GetSourceFile {
//     directory: string;
//     file: string;
//   }
// }
// const getSourceFile = effectify({
//   body: (projectService, _, { directory, file }: Options.GetSourceFile) =>
//     Effect.Do.pipe(
//       Effect.bind('project', () => getProject(projectService, { directory, file })),
//       Effect.bind('program', () => getProgram(projectService, { directory, file })),
//       Effect.bind('result', ({ program, project }) =>
//         pipe(
//           Effect.fromNullable(program.getSourceFile(file)),
//           Effect.catchAll(() =>
//             Effect.fail(
//               new ProjectServiceError.NoSourceFileFound({
//                 directory,
//                 file,
//                 kind: Project.getKind(project),
//                 projectName: Project.getProjectName(project),
//                 tsconfig: Project.getConfigFilePath(project),
//               }),
//             ),
//           ),
//         ),
//       ),
//     ),
//   logEnd: ({ project }, _, options) => [
//     'Found source file',
//     {
//       ...options,
//       kind: Project.getKind(project),
//       projectName: Project.getProjectName(project),
//       tsconfig: Project.getConfigFilePath(project),
//     },
//   ],
//   logStart: (_, options) => ['Getting source file', options],
//   name: (path, { directory, file }) => `projectService-getSourceFile-${path.relative(directory, file)}`,
// });
//
// export namespace Options {
//   export interface GetTypeChecker {
//     directory: string;
//     file: string;
//   }
// }
// const getTypeChecker = effectify({
//   body: (projectService, _, { directory, file }: Options.GetTypeChecker) =>
//     Effect.Do.pipe(
//       Effect.bind('project', () => getProject(projectService, { directory, file })),
//       Effect.bind('program', () => getProgram(projectService, { directory, file })),
//       Effect.bind('result', ({ program, project }) =>
//         pipe(
//           Effect.fromNullable(program.getTypeChecker()),
//           Effect.catchAll(() =>
//             Effect.fail(
//               new ProjectServiceError.NoSourceFileFound({
//                 directory,
//                 file,
//                 kind: Project.getKind(project),
//                 projectName: Project.getProjectName(project),
//                 tsconfig: Project.getConfigFilePath(project),
//               }),
//             ),
//           ),
//         ),
//       ),
//     ),
//   logEnd: ({ project }, _, options) => [
//     'Type checker acquired',
//     {
//       ...options,
//       kind: Project.getKind(project),
//       projectName: Project.getProjectName(project),
//       tsconfig: Project.getConfigFilePath(project),
//     },
//   ],
//   logStart: (_, options) => ['Acquiring type checker', options],
//   name: (path, { directory, file }) => `projectService-getTypeChecker-${path.relative(directory, file)}`,
// });
//
// /**
//  * Get a type check from a project file.
//  */
// // const getTypeChecker: {
// //   (options: {
// //     directory: string;
// //     file: string;
// //   }): (
// //     projectService: ts.server.ProjectService,
// //   ) => Effect.Effect<ts.TypeChecker, ProjectServiceError.ProjectServiceError>;
// //   (
// //     projectService: ts.server.ProjectService,
// //     options: { directory?: string | undefined; file: string },
// //   ): Effect.Effect<ts.TypeChecker, ProjectServiceError.ProjectServiceError>;
// // } = Function.dual(
// //   2,
// //   Effect.functionWithSpan({
// //     body: (
// //       projectService: ts.server.ProjectService,
// //       { directory, file }: { directory?: string | undefined; file: string },
// //     ) =>
// //       Effect.Do.pipe(
// //         Effect.bind('project', () => getProject(projectService, { directory, file })),
// //         Effect.bind('program', () => getProgram(projectService, { directory, file })),
// //         Effect.flatMap(({ program, project }) =>
// //           pipe(
// //             Effect.fromNullable(program.getTypeChecker()),
// //             Effect.catchAll(() =>
// //               getRootTsConfig(projectService).pipe(
// //                 Effect.flatMap((tsconfigPath) =>
// //                   Effect.fail(
// //                     new ProjectServiceError.NoSourceFileFound({
// //                       file,
// //                       projectName: project.getProjectName(),
// //                       tsconfigPath,
// //                     }),
// //                   ),
// //                 ),
// //               ),
// //             ),
// //           ),
// //         ),
// //       ),
// //     captureStackTrace: true,
// //     options: (_, { file }) => ({ name: `projectService-getTypeChecker-${file}` }), // TODO: relative
// //   }),
// // );
//
// /**
//  * Get ambient modules from a project file.
//  */
// const getAmbientModules: {
//   (options: {
//     // TODO: log
//     directory?: string | undefined;
//     file: string;
//   }): (
//     projectService: ts.server.ProjectService,
//   ) => Effect.Effect<Readonly<Record<string, ReadonlyArray<string>>>, ProjectServiceError.ProjectServiceError>;
//   (
//     projectService: ts.server.ProjectService,
//     options: { directory: string | undefined; file: string },
//   ): Effect.Effect<Readonly<Record<string, ReadonlyArray<string>>>, ProjectServiceError.ProjectServiceError>;
// } = Function.dual(
//   2,
//   Effect.functionWithSpan({
//     body: (
//       projectService: ts.server.ProjectService,
//       { directory, file }: { directory?: string | undefined; file: string },
//     ): Effect.Effect<Readonly<Record<string, ReadonlyArray<string>>>, ProjectServiceError.ProjectServiceError> =>
//       Effect.Do.pipe(
//         Effect.bind('typeChecker', () => getTypeChecker(projectService, { directory, file })),
//         Effect.flatMap(({ typeChecker }) => {
//           const t = pipe(
//             typeChecker.getAmbientModules(),
//             Array.map((module) =>
//               Effect.all([
//                 S.decode(S.parseJson(S.String))(module.getName()),
//                 pipe(
//                   module.getDeclarations() ?? [],
//                   Array.map((declaration) => declaration.getSourceFile().fileName),
//                   Effect.succeed,
//                 ),
//               ]),
//             ),
//             Effect.all,
//             (v) => v,
//             Effect.map(Record.fromEntries),
//             Effect.mapError((error) => new ProjectServiceError.ParseError({ error: error.toString() })),
//           );
//           return t;
//         }),
//       ),
//     captureStackTrace: true,
//     options: (_, { file }) => ({ name: `projectService-gettAmbientModules-${file}` }), // TODO: relative
//   }),
// );
