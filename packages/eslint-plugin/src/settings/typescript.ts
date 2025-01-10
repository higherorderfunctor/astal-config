import path from 'node:path';

import type { Debugger } from 'debug';
import debug from 'debug';
import { Either, flow } from 'effect';
import type * as importX from 'eslint-plugin-import-x/types.js';
import ts from 'typescript';

const logInfo = debug('tsserver-resolver:resolver:info');
const logError = debug('tsserver-resolver:resolver:error');
const logTrace = debug('tsserver-resolver:resolver:trace');

const logRight: <R>(
  message: (args: NoInfer<R>) => Parameters<Debugger>,
  log?: Debugger,
) => <L = never>(self: Either.Either<R, L>) => Either.Either<R, L> =
  (message, log = logInfo) =>
  (self) =>
    Either.map(self, (args) => {
      log(...message(args));
      return args;
    });

const logLeft: <L>(
  message: (args: NoInfer<L>) => Parameters<Debugger>,
  log?: Debugger,
) => <R>(self: Either.Either<R, L>) => Either.Either<R, L> =
  (message, log = logError) =>
  (self) =>
    Either.mapLeft(self, (args) => {
      log(...message(args));
      return args;
    });

const NOT_FOUND: importX.ResultNotFound = { found: false };

const fail: <T extends Array<unknown>>(
  message: (...value: NoInfer<T>) => Parameters<Debugger>,
  log?: Debugger,
) => (...value: T) => importX.ResultNotFound =
  (message, log = logError) =>
  (...value) => {
    log(...message(...value));
    return NOT_FOUND;
  };

export const success: (path: string) => importX.ResultFound = (path) => ({ found: true, path });

/**
 * Get the `CompilerOptions` from the `RuleContext`.
 */
const getCompilerOptions: (options: {
  context: importX.ChildContext | importX.RuleContext;
  file: string;
}) => Either.Either<ts.CompilerOptions, importX.ResultNotFound> = flow(
  Either.right,
  logRight(({ context, file }) => ['Getting compiler options:', file, context], logTrace),
  Either.bind('compilerOptions', ({ context, file }) =>
    Either.fromNullable(
      context.sourceCode?.parserServices?.program?.getCompilerOptions(),
      fail(() => ['No compiler options found:', file] as const),
    ),
  ),
  logRight(({ file }) => ['Found compiler options:', { file }], logTrace),
  Either.map(({ compilerOptions }) => compilerOptions),
);

/**
 * Get the `Program` for a given `Project`.
 */
const getProgram: (options: {
  context: importX.ChildContext | importX.RuleContext;
  file: string;
}) => Either.Either<ts.Program, importX.ResultNotFound> = flow(
  Either.right,
  logRight(({ file }) => ['Getting program:', { file }], logTrace),
  Either.bind('program', ({ context }) =>
    Either.fromNullable(
      context.sourceCode?.parserServices?.program,
      fail(() => ['No program found']),
    ),
  ),
  logRight(({ file }) => ['Found program:', { file }], logTrace),
  Either.map(({ program }) => program),
);

/**
 * Get the `SourceFile` for a given `Program`.
 *
 * @remarks The `SourceFile` is used to traverse inline-references.
 */
const getSourceFile: (options: {
  file: string;
  program: ts.Program;
}) => Either.Either<ts.SourceFile, importX.ResultNotFound> = flow(
  Either.right,
  logRight(({ file }) => ['Getting source file:', file], logTrace),
  Either.bind('sourceFile', ({ file, program }) =>
    Either.fromNullable(
      program.getSourceFile(file),
      fail(() => ['No source file found:', { file }]),
    ),
  ),
  logRight(({ file, sourceFile }) => ['Found source file:', { file, sourceFile: sourceFile.fileName }], logTrace),
  Either.map(({ sourceFile }) => sourceFile),
);

/**
 * Get the `TypeChecker` for a given `Program`.
 *
 * @remarks The `TypeChecker` is used to find ambient modules.
 */
const getTypeChecker: (options: { program: ts.Program }) => Either.Either<ts.TypeChecker> = flow(
  Either.right,
  logRight(() => ['Getting type checker'], logTrace),
  Either.bind('typeChecker', ({ program }) => Either.right(program.getTypeChecker())),
  logRight(() => ['Found type checker'], logTrace),
  Either.map(({ typeChecker }) => typeChecker),
);

/**
 * Resolve a module.
 */
export const resolveModule: (options: {
  context: importX.ChildContext | importX.RuleContext;
  file: string;
  source: string;
}) => Either.Either<importX.ResultFound, importX.ResultNotFound> = flow(
  Either.right,
  Either.bind('compilerOptions', getCompilerOptions),
  logRight(({ file, source }) => ['Resolving module:', { file, source }]),
  Either.bind('resolvedModule', ({ compilerOptions, file, source }) => {
    const { resolvedModule } = ts.resolveModuleName(source, file, compilerOptions, ts.sys);
    return Either.fromNullable(
      resolvedModule,
      fail(() => ['No module found:', { file, source }]),
    );
  }),
  logRight(({ file, resolvedModule, source }) => [
    'Resolved module:',
    { file, path: resolvedModule.resolvedFileName, source },
  ]),
  Either.map(({ resolvedModule }) => success(resolvedModule.resolvedFileName)),
);

/**
 * Resolve a type reference.
 */
export const resolveTypeReference: (options: {
  context: importX.ChildContext | importX.RuleContext;
  file: string;
  source: string;
}) => Either.Either<importX.ResultFound, importX.ResultNotFound> = flow(
  Either.right,
  logRight(({ file, source }) => ['Resolving type reference directive:', { file, source }]),
  Either.bind('compilerOptions', getCompilerOptions),
  Either.bind('resolvedTypeReferenceDirective', ({ compilerOptions, file, source }) => {
    const { resolvedTypeReferenceDirective } = ts.resolveTypeReferenceDirective(source, file, compilerOptions, ts.sys);
    return Either.fromNullable(
      resolvedTypeReferenceDirective?.resolvedFileName,
      fail(() => ['No type reference directive found:', { file, source }]),
    );
  }),
  logRight(({ file, resolvedTypeReferenceDirective, source }) => [
    'Resolved type reference directive:',
    { file, path: resolvedTypeReferenceDirective, source },
  ]),
  Either.map(({ resolvedTypeReferenceDirective }) => success(resolvedTypeReferenceDirective)),
);

/**
 * Resolve an ambient module.
 */
export const resolveAmbientModule: (options: {
  context: importX.ChildContext | importX.RuleContext;
  file: string;
  source: string;
}) => Either.Either<importX.ResultFound, importX.ResultNotFound> = flow(
  Either.right,
  logRight(({ file, source }) => ['Resolving ambient module:', { file, source }]),
  Either.bind('program', getProgram),
  Either.bind('sourceFile', getSourceFile),
  Either.bind('typeChecker', getTypeChecker),
  Either.bind('resolvedAmbientModule', ({ file, source, typeChecker }) =>
    Either.fromNullable(
      typeChecker
        .getAmbientModules()
        .find((_) => _.getName() === `"${source}"`)
        ?.getDeclarations()?.[0]
        .getSourceFile().fileName,
      fail(() => ['No ambient module found:', { file, source }]),
    ),
  ),
  logRight(({ file, resolvedAmbientModule, source }) => [
    'Resolved ambient module:',
    { file, resolvedAmbientModule, source },
  ]),
  Either.map(({ resolvedAmbientModule }) => success(resolvedAmbientModule)),
);

/**
 * Resolve a fallback relative path.
 */
export const resolveFallbackRelativePath: (options: {
  file: string;
  source: string;
}) => Either.Either<importX.ResultFound, importX.ResultNotFound> = flow(
  Either.right,
  logRight(({ file, source }) => ['Resolving fallback relative path:', { file, source }]),
  Either.bind('path', ({ file, source }) =>
    Either.try({
      catch: fail((error) => ['No fallback relative path found:', { error, file, source }]),
      try: () => path.resolve(path.dirname(file), source),
    }),
  ),
  Either.flatMap(
    Either.liftPredicate(
      ({ path }) => ts.sys.fileExists(path),
      fail(({ file, path, source }) => ["Resolved fallback relative path doesn't exist:", { file, path, source }]),
    ),
  ),
  logRight(({ file, path, source }) => ['Resolved fallback relative path:', { file, path, source }]),
  Either.map(({ path }) => success(path)),
);

/**
 * Version 3 resolver.
 */
export const tsserverResolver: importX.NewResolver = {
  interfaceVersion: 3,
  name: 'tsserver-resolver',
  resolve: (
    source: string,
    file: string,
    context: importX.ChildContext | importX.RuleContext,
  ): importX.ResolvedResult =>
    Either.right({ context, file, source }).pipe(
      Either.flatMap((options) =>
        resolveModule(options).pipe(
          Either.orElse(() => resolveTypeReference(options)),
          Either.orElse(() => resolveAmbientModule(options)),
          Either.orElse(() => resolveFallbackRelativePath(options)),
        ),
      ),
      logRight((result) => ['Result:', result] as const),
      logLeft((result) => ['Result:', result]),
      Either.merge,
    ),
};

export const settings = {
  // speeds up LSP but requires manual cache clearing
  'import-x/cache': {
    lifetime: Number.POSITIVE_INFINITY,
  },
  // properly treat monorepo packages in node_modules as internal
  'import-x/internal-regex': '^@astal-config/',
  // maps extensions to parsers
  'import-x/parsers': {
    '@typescript-eslint/parser': ['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'],
  },
  // how to perform import lookups
  'import-x/resolver-next': [tsserverResolver],
};
