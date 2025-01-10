#!/usr/bin/env bun

import { runMain } from '@astal-config/girs-fixup';

runMain();
// import { Command, HelpDoc, Options as CliOptions } from '@effect/cli';
// import { Command as PlatformCommand, FileSystem, Path } from '@effect/platform';
// import { BunContext, BunRuntime } from '@effect/platform-bun';
// import { Doc } from '@effect/printer';
// import { Array, Console, Data, Effect, pipe } from 'effect';
//
// import packageJson from '../package.json' with { type: 'json' };
//
// /**
//  * Generic error for all build errors using a `HelpDoc` for prettier messages.
//  */
// export class FixupError extends Data.TaggedError('FixupError')<{
//   error: HelpDoc.HelpDoc;
// }> {}
//
// export interface PackageName {
//   ext: 'd.ts';
//   packageName: string;
//   scope: 'astal' | 'girs';
// }
//
// export namespace PackageName {
//   export const make = (filename: string): Effect.Effect<PackageName> => {
//     const { ext, packageName, scope } = {
//       .../^(?<scope>astal)?(?<packageName>.+)\.(?<ext>d\.ts)$/.exec(filename)?.groups,
//     } as {
//       ext: 'd.ts';
//       packageName: string;
//       scope?: 'astal';
//     };
//     return { ext, packageName, scope: scope ?? 'girs' };
//   };
// }
//
// /**
//  * Define the `--girs` path option.
//  */
// const girs = CliOptions.directory('girs', { exists: 'yes' }).pipe(
//   CliOptions.mapEffect((tsconfig) => Path.Path.pipe(Effect.map((path) => path.resolve(tsconfig)))),
//   CliOptions.withDefault(`${process.cwd()}/vendor/@girs`),
//   CliOptions.withDescription(
//     pipe(
//       Doc.vsep([
//         Doc.text('Location of @girs generated types.'),
//         Doc.empty,
//         pipe(Doc.text('Default: `$PWD/vendor/@girs`.'), Doc.indent(2)),
//       ]),
//       Doc.render({
//         style: 'pretty',
//       }),
//     ),
//   ),
// );
//
// /**
//  * App entry point.
//  */
// const command = Command.make('girs-fixup', { girs }, ({ girs }) =>
//   Effect.Do.pipe(
//     Effect.bind('fs', () => FileSystem.FileSystem),
//     Effect.flatMap(({ fs }) => fs.readDirectory(girs)),
//     Effect.map(Array.map(PackageName.make)),
//     Effect.flatMap(Console.log),
//   ),
// );
//
// /**
//  * Set app metadata.
//  */
// const cli = Command.run(command, {
//   name: '@astal-config/girs-fixup',
//   version: packageJson.version,
// });
//
// /**
//  * Run the app.
//  */
// cli(process.argv).pipe(
//   Effect.provide(BunContext.layer),
//   BunRuntime.runMain({
//     // use our own printer
//     // disableErrorReporting: true,
//   }),
// );
