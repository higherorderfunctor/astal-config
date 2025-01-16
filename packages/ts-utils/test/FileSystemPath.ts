import { describe, expect, it } from 'bun:test';

import { Path } from '@effect/platform';
import { BunContext } from '@effect/platform-bun';
import { Cause, Effect, flow, Logger } from 'effect';

describe('FileWatcher', () => {
  it('should watch files', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const parsed = path.parse('4;.\N/');
        expect(parsed).toMatchObject({ asdf: 'asdf' });
      }).pipe(
        Effect.scoped,
        Effect.provide(BunContext.layer),
        Effect.sandbox,
        Effect.tapErrorCause(flow(Cause.pretty, Effect.logFatal)),
        Effect.provide(Logger.structured),
      ),
    ));
});
