import { Data } from 'effect';

export class NoProgramFound extends Data.TaggedClass('NoProgramFound')<
  Readonly<{
    file: string;
    projectName: string;
    tsconfigPath: string;
  }>
> {
  message = 'No program found';
}
