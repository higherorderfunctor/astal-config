import { describe, expect, it } from 'bun:test';

import { Cause, Effect, flow, Logger } from 'effect';

import { ProjectService } from '@astal-config/ts-utils';
import { Path } from '@effect/platform';
import { BunContext } from '@effect/platform-bun';

describe('@astal-config/ts-utils', () => {
  describe('FileWatcher', () => {
    it('should watch files', () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const projectService = yield* ProjectService.ProjectService;
          const ambientModules = yield* projectService.getAmbientModules(
            path.resolve(__dirname, `./fixtures/project-a/index.ts`),
            path.resolve(__dirname, './fixtures/project-a')
          );
          expect(ambientModules).toMatchObject({
            "package-a": [path.resolve(__dirname, `./fixtures/project-a/index.ts`)]
          });
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
});
