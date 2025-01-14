import { Data } from 'effect';

import type ts from 'typescript';

export class NoProjectFound extends Data.TaggedClass('NoProjectFound')<
  Readonly<{
    file: string;
    kind?: Exclude<ts.server.ProjectKind, ts.server.ProjectKind.Configured>;
  }>
> {
  message = 'No project found';
}
