import { HelpDoc } from '@effect/cli';
import { Data } from 'effect';

/**
 * Generic error for all fixup errors using a `HelpDoc` for prettier messages.
 */
export class FixupError extends Data.TaggedError('FixupError')<{
  error: HelpDoc.HelpDoc;
}> {
  static make = (message: string) => new FixupError({ error: HelpDoc.p(message) });
}
