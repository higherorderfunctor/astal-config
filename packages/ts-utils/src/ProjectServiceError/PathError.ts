import { Data, Inspectable } from 'effect';

export class PathError
  extends Data.TaggedError('PathError')<{
    error: unknown;
    path: string;
  }>
  implements Inspectable.Inspectable
{
  message = 'Path error occurred';

  [Inspectable.NodeInspectSymbol]() {
    return this.toJSON();
  }

  toJSON() {
    return {
      cause: this.cause,
      error: Inspectable.toJSON(this.error),
      message: this.message,
      name: this.name,
      path: this.path,
      stack: this.stack,
    };
  }

  toString() {
    return Inspectable.format(this.toJSON());
  }
}
