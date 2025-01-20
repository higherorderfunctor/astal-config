import { NodeSdk } from '@effect/opentelemetry';
import { BunContext, BunRuntime } from '@effect/platform-bun';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  Cause,
  Duration,
  Effect,
  Exit,
  Fiber,
  flow,
  Inspectable,
  Layer,
  Logger,
  LogLevel,
  Option,
  pipe,
  Schedule,
  Scope,
} from 'effect';
import { ScheduleDriverTypeId } from 'effect/Schedule';

import { ClientFile, ProjectService } from '@astal-config/ts-utils';

import * as PrettyLogger from './Logger.js';

const NodeSdkLive = NodeSdk.layer(() => ({
  resource: { serviceName: 'example' },
  spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
}));

Effect.gen(function* () {
  // const scope = yield* Scope.make();
  // yield* Effect.gen(function* () {
  //  const fiberA = yield* Effect.fork(
  //    ClientFile.open({
  //      filePath: `${__dirname}/fixtures/project-a/index.ts`,
  //      workspacePath: `${__dirname}/fixtures`,
  //    }).pipe(Effect.provideService(Scope.Scope, scope)),
  //  );
  //  yield* pipe(
  //    Effect.log('interrupting'),
  //    Effect.flatMap(() => Fiber.interrupt(fiberA)),
  //    Effect.flatMap((exit) => Effect.log('interrupted result', exit)),
  //    Effect.delay('1 seconds'),
  //    Effect.fork,
  //    Effect.flatMap(Fiber.join),
  //  );
  //  const fiberB = yield* Effect.fork(
  //    ClientFile.open({
  //      filePath: `${__dirname}/fixtures/project-b/index.ts`,
  //      workspacePath: `${__dirname}/fixtures`,
  //    }).pipe(Effect.provideService(Scope.Scope, scope)),
  //  );
  // }).pipe(Effect.provide(ProjectService.layer));
  // yield* Effect.log('closing it now');
  // yield* Scope.close(scope, Exit.succeed('asdf'));
  yield* Effect.log('closed!!!!!');
  yield* Effect.log('closed!!!!!');
  yield* Effect.log('closed!!!!!');
  yield* Effect.log('closed!!!!!');
  yield* Effect.log('closed!!!!!');
  yield* Effect.log('closed!!!!!');
}).pipe(
  Effect.scoped,
  Effect.provide(NodeSdkLive),
  Effect.provide(BunContext.layer),
  Effect.sandbox,
  Effect.tapError(flow(Inspectable.toJSON, Effect.logFatal)),
  Effect.provide(PrettyLogger.pretty),
  Effect.orDie,
  Effect.tapError(flow(Inspectable.toJSON, Effect.logFatal)),
  // Effect.provide(Logger.structured),
  // Effect.provide(Logger.replace(Logger.defaultLogger, Logger.none)),
  Effect.provide(Logger.minimumLogLevel(LogLevel.All)),
  Effect.runPromise,
);
