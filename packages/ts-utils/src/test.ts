import { NodeSdk } from '@effect/opentelemetry';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Cause, Duration, Effect, Exit, flow, Inspectable, Logger, LogLevel, Option, Schedule, Scope } from 'effect';
import { ScheduleDriverTypeId } from 'effect/Schedule';

import { ClientFile, ProjectService } from '@astal-config/ts-utils';

const NodeSdkLive = NodeSdk.layer(() => ({
  resource: { serviceName: 'example' },

  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));

Effect.gen(function* () {
  const scope = yield* Scope.make();
  yield* Effect.gen(function* () {
    yield* ClientFile.open({
      filePath: `${__dirname}/fixtures/project-a/index.ts`,
      workspacePath: `${__dirname}/fixtures`,
    }).pipe(Effect.provideService(Scope.Scope, scope));
    yield* ClientFile.open({
      filePath: `${__dirname}/fixtures/project-b/index.ts`,
      workspacePath: `${__dirname}/fixtures`,
    }).pipe(Effect.provideService(Scope.Scope, scope));
  }).pipe(Effect.provide(ProjectService.layer));
  yield* Effect.log('closing it now');
  yield* Scope.close(scope, Exit.succeed('asdf'));
  yield* Effect.log('closed!!!!!');
}).pipe(
    Effect.scoped,
  Effect.provide(NodeSdkLive),
  Effect.provide(BunContext.layer),
  Effect.sandbox,
  Effect.tapError(flow(Inspectable.toJSON, Effect.logWarning)),
  Effect.provide(Logger.structured),
    Effect.provide(Logger.minimumLogLevel(LogLevel.All)),
  BunRuntime.runMain,
);
