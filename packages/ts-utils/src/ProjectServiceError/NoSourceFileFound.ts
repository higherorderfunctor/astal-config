import { Data } from 'effect';

export class NoSourceFileFound extends Data.TaggedClass('NoSourceFileFound')<
  Readonly<{
    file: string;
    projectName: string;
    tsconfigPath: string;
  }>
> {
  message = 'No source file found';
}
