import { describe, expect, it } from 'bun:test';

import { NodeSdk } from '@effect/opentelemetry';
import { BunContext } from '@effect/platform-bun';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Cause, Effect, flow, Inspectable, Logger, Option } from 'effect';

import { ClientFile, ProjectService } from '@astal-config/ts-utils';

const NodeSdkLive = NodeSdk.layer(() => ({
  resource: { serviceName: 'example' },

  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));

describe('FileWatcher', () => {
  it('should watch files', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const clientFile = yield* ClientFile.open({
          filePath: `${__dirname}/fixtures/project-a/index.ts`,
          workspacePath: `${__dirname}/fixtures`,
        });
        expect(clientFile).toMatchObject({
          filePath: `${__dirname}/fixtures/project-a/index.ts`,
          workspacePath: Option.some(`${__dirname}/fixtures`),
        });
      }).pipe(
        Effect.provide(NodeSdkLive),
        Effect.scoped,
        Effect.provide(ProjectService.layer),
        Effect.provide(BunContext.layer),
        Effect.sandbox,
        Effect.tapError(flow(Inspectable.toJSON, Effect.logWarning)),
        Effect.provide(Logger.structured),
      ),
    ));
});
