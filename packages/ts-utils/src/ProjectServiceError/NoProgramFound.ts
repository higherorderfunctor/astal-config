import { Data } from 'effect';
import type ts from 'typescript';

export class NoProgramFound extends Data.TaggedClass('NoProgramFound')<
  Readonly<{
    directory: string;
    file: string;
    kind: ts.server.ProjectKind;
    projectName: string;
    tsconfig?: string | undefined;
  }>
> {
  message = 'No program found';
}
