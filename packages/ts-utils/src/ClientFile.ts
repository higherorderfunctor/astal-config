import { Array, Effect, Struct } from 'effect';
import ts from 'typescript';

import { effectify } from './Effectify.js';
import * as NormalizedPath from './NormalizedPath.js';
import * as ProjectServiceError from './ProjectServiceError/index.js';


export namespace ClientFile {
    type ScriptKind = { [K in keyof ts.ScriptKind]: ts.ScriptKind[K] };
    const ScriptKind: ScriptKind = ts.ScriptKind;
        //Unknown = 0,
        //JS = 1,
        //JSX = 2,
        //TS = 3,
        //TSX = 4,
        //External = 5,
        //JSON = 6,
        ///**
        // * Used on extensions that doesn't define the ScriptKind but the content defines it.
        // * Deferred extensions are going to be included in all project contexts.
        // */
        //Deferred = 7,
    }
}
export namespace Options {
  export interface OpenClientFile {
    file: string;
    fileContent?: string;
    hasMixedContent?: boolean;
    scriptKind?: ts.ScriptKind;
    workspace: string;
  }
}

export namespace ClientFile {
  export const FilePath = Symbol.for('@astal-config/ts-utils/ClientFile/FilePath');
  export const WorkspacePath = Symbol.for('@astal-config/ts-utils/ClientFile/WorkspacePath');
};

export interface ClientFile {
  hasMixedContent: boolean;
  scriptKind?: ts.ScriptKind; // TODO: remove
  tsconfig: NormalizedPath.NormalizedPath;
  [ClientFile.FilePath]: NormalizedPath.NormalizedPath;
  [ClientFile.WorkspacePath]: NormalizedPath.NormalizedPath;
}

export const open = effectify({
  body: (projectService, _, { file, fileContent, hasMixedContent, scriptKind, workspace }: Options.OpenClientFile) =>
    Effect.acquireRelease(Effect.gen(function* () {
      const normalizedFilePath = yield* NormalizedPath.normalize(file);
      const normalizedWorkspacePath = yield* NormalizedPath.normalize(workspace);

      const result = projectService.openClientFileWithNormalizedPath(
        normalizedFilePath[NormalizedPath.TsNormalizedPath],
        fileContent,
        scriptKind,
        hasMixedContent,
        normalizedWorkspacePath[NormalizedPath.TsNormalizedPath],
      );

      if (result.configFileErrors && Array.isNonEmptyReadonlyArray(result.configFileErrors)) {
        return yield* Effect.fail(
          new ProjectServiceError.DiagnosticError({
            diagnostic: result.configFileErrors,
            directory: workspace,
            file,
            kind: scriptKind,
          }),
        );
      }
      return yield* Effect.succeed({ result:{
        hasMixedContent,
        scriptKind, // TODO: remove
        tsconfig: yield* NormalizedPath.normalize(result.configFileName),
        [ClientFile.FilePath]: normalizedFilePath,
        [ClientFile.WorkspacePath]: normalizedWorkspacePath,
      } });
    }),
    ({ result }) => Effect.succeed(
        projectService.closeClientFile(result[ClientFile.FilePath])
      )
    ),
  logEnd: ({ result }, _, options) => [
    'Opened client file',
    {
      ...Struct.omit(options, 'fileContent'),
      tsconfig: result.configFileName,
    },
  ],
  logStart: (_, options) => ['Opening client file', Struct.omit(options, 'fileContent')],
  name: (path, { directory, file }) => `projectService-openClientFile-${path.relative(directory, file)}`,
});
