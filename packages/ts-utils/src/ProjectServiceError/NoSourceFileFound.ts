import { Data } from 'effect';
import type ts from 'typescript';

export class NoSourceFileFound extends Data.TaggedClass('NoSourceFileFound')<
  Readonly<{
    directory: string;
    file: string;
    kind: ts.server.ProjectKind;
    projectName: string;
    tsconfig?: string | undefined;
  }>
> {
  message = 'No source file found';
}
