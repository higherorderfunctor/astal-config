import type { ParseResult } from 'effect';
import { Data } from 'effect';

export class ParseError extends Data.TaggedClass('ParseError')<{
  error: string;
}> {
  message = 'Parsing error occurred';

  static from = (error: ParseResult.ParseError) => new ParseError({ error: error.toString() });
}
