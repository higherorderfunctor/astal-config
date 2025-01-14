import { Data } from 'effect';

export class NoProjectFound extends Data.TaggedClass('NoProjectFound')<
  Readonly<{
    file: string;
    tsconfigPath: string;
  }>
> {
  message = 'No project found';
}
