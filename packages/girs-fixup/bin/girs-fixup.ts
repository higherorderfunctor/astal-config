#!/usr/bin/env bun

import { Command, HelpDoc, Options, Span, ValidationError } from '@effect/cli';
import { FileSystem, Terminal } from '@effect/platform';
import { BunContext, BunRuntime, BunTerminal } from '@effect/platform-bun';
import { Ansi, AnsiDoc } from '@effect/printer-ansi';
import { lineBreak } from '@effect/printer/Doc';
import { Array, Console, Effect, flow, Number, pipe, Record, String } from 'effect';
import { max } from 'effect/Number';
// import { Array, Console, Effect, flow, Inspectable, pipe } from 'effect';

// import { PackageName } from '@astal-config/girs-fixup';

// import packageJson from '../package.json' with { type: 'json' };

const { annotate, cat, cats, char,line, colon, empty, hang, hsep, indent, reflow, space, hcat, spaces, text, vsep } = AnsiDoc;

const b = flow(annotate(Ansi.bold));

const red = flow(annotate(Ansi.red));
const gray = flow(annotate(Ansi.white));
const seal$ = flow(AnsiDoc.render({ style: 'pretty' }));
const seal = flow(seal$, text);


// const prop = (k: AnsiDoc.AnsiDoc, v: AnsiDoc.AnsiDoc) =>
//   hsep([k, pipe(v, AnsiDoc.nest(4), annotate(Ansi.red))]);

const t = Effect.runSync(
  Terminal.Terminal.pipe(
    Effect.flatMap(({ columns }) => columns),
    Effect.provide(BunTerminal.layer),
  ),
);

const bold = (message: string, props?: Record<string, string>, extra?: string) => {
  const maxKeyLength = pipe(Record.keys(props ?? {}), Array.map(String.length), Array.reduce(0, Number.max));
  return cats([
    hsep([text('× Error:'), pipe(reflow(message), hang(0))]),
    empty,
    pipe(
      Record.toEntries(props ?? {}),
      Array.map(([key, value]) =>
        AnsiDoc.hsep([spaces(maxKeyLength - key.length), text(`${key}:`), pipe(reflow(value), hang(0))]),
      ),
      vsep,
    ),
    extra ? cat(line, text(extra)) : empty,
    // pipe(AnsiDoc.vsep([
    //   AnsiDoc.text('Filename'),
    //   AnsiDoc.text('Another: asdf'),
    // ]),
    // AnsiDoc.indent(2)
    // )
  ]);
};
// AnsiDoc.annotate(Ansi.bold),
// AnsiDoc.annotate(Ansi.redBright),

Effect.runSync(
  pipe(
    bold(
      'Something happeneSomething happeneSomething happeneSomething happeneSomething happeneSomething happene Something happenedddddddSomething happened',
      {
        file: 'something.d.ts',
        formatting:
          'Something happeneSomething happeneSomething happeneSomething happeneSomething happeneSomething happene Something happenedddddddSomething happened',
      },
      "asdf"
    ),
    AnsiDoc.render({ options: { lineWidth: t }, style: 'pretty' }),
    Console.log,
  ),
);

// /**
//  * Define the `--girs` path option.
//  */
// const ls = Effect.map(
//   FileSystem.FileSystem,
//   (fs) => (path: string) =>
//     fs
//       .readDirectory(path)
//       .pipe(
//         Effect.mapError((error) => ValidationError.invalidValue(HelpDoc.p(Inspectable.stringifyCircular(error, 2)))),
//       ),
// );
//
// const girs = Options.directory('girs', { exists: 'yes' }).pipe(
//   Options.withDefault(`${process.cwd()}/vendor/@girs`),
//   Options.withDescription(
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
//   Options.mapEffect((girs) =>
//     pipe(
//       ls,
//       Effect.ap(Effect.succeed(girs)),
//       Effect.flatten,
//       Effect.flatMap(flow(Array.map(PackageName.fromDts), Effect.all)),
//     ),
//   ),
// );
//
// /**
//  * App entry point.
//  */
// const command = Command.make('girs-fixup', { girs }, Console.log);
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
//     disableErrorReporting: true,
//   }),
// );
