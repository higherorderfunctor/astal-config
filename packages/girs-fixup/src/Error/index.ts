import { HelpDoc, ValidationError } from '@effect/cli';
import { Terminal } from '@effect/platform';
import { Doc } from '@effect/printer';
import { empty, hang, hsep, reflow, spaces, text, vsep } from '@effect/printer/Doc';
import { Array, Effect, flow, Inspectable, Number, Option, pipe, Predicate, Record, String } from 'effect';

const toDoc = (message: string, props?: null | Record<string, unknown>, extra?: string) => {
  const maxKeyLength = pipe(Record.keys(props ?? {}), Array.map(String.length), Array.reduce(0, Number.max));
  return vsep(
    Array.getSomes([
      Option.some(hsep([text('× Error:'), pipe(reflow(message), hang(0))])),
      Option.fromNullable(props).pipe(Option.map(() => empty)),
      Option.fromNullable(props).pipe(
        Option.map(
          flow(
            Record.filter((value) => Predicate.isNotUndefined(value)),
            Record.toEntries,
            Array.map(([key, value]) =>
              Doc.hsep([
                spaces(maxKeyLength - key.length),
                text(`${key}:`),
                pipe(reflow(Inspectable.stringifyCircular(value, 2)), hang(0)),
              ]),
            ),
            vsep,
          ),
        ),
      ),
      Option.fromNullable(extra).pipe(Option.map(() => empty)),
      Option.fromNullable(extra).pipe(Option.map(text)),
    ]),
  );
};

export const invalidValue = flow(
  toDoc,
  (doc) => Effect.succeed({ doc }),
  Effect.bind('term', () => Terminal.Terminal),
  Effect.bind('lineWidth', ({ term }) => term.columns),
  Effect.map(({ doc, lineWidth }) => Doc.render(doc, { options: { lineWidth }, style: 'pretty' })),
  Effect.map(HelpDoc.p),
  Effect.map(ValidationError.invalidValue),
  Effect.flip,
);
