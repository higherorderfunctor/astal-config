import { describe, expect, it } from 'bun:test';

import { BunContext } from '@effect/platform-bun';
import { Cause, Effect, flow, Logger } from 'effect';

import { ClientFile, ProjectService } from '@astal-config/ts-utils';

describe('FileWatcher', () => {
  it('should watch files', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const clientFile = yield* ClientFile.open({
          filePath: './fixtures/project-a/index.ts',
          workspacePath: './fixtures',
        });
        expect(clientFile).toMatchObject({ asdf: 'asdf' });
      }).pipe(
        Effect.scoped,
        Effect.provide(ProjectService.layer),
        Effect.provide(BunContext.layer),
        Effect.sandbox,
        Effect.tapErrorCause(flow(Cause.pretty, Effect.logFatal)),
        Effect.provide(Logger.structured),
      ),
    ));
});
