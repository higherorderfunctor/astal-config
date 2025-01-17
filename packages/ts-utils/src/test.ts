import { NodeSdk } from '@effect/opentelemetry';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Cause, Effect, flow, Inspectable, Logger, Option } from 'effect';

import { ClientFile, ProjectService } from '@astal-config/ts-utils';

const NodeSdkLive = NodeSdk.layer(() => ({
  resource: { serviceName: 'example' },

  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));

Effect.gen(function* () {
  const clientFile = yield* ClientFile.open({
    filePath: `${__dirname}/fixtures/project-a/index.ts`,
    workspacePath: `${__dirname}/fixtures`,
  });
}).pipe(
  Effect.scoped,
  Effect.provide(NodeSdkLive),
  Effect.provide(ProjectService.layer),
  Effect.provide(BunContext.layer),
  Effect.sandbox,
  Effect.tapError(flow(Inspectable.toJSON, Effect.logWarning)),
  Effect.provide(Logger.structured),
  BunRuntime.runMain,
);
