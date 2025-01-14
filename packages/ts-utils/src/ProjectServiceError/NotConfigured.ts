import { Data } from 'effect';

export class NotConfigured extends Data.TaggedClass('NotConfigured')<{}> {
  message = 'Project service not configured';
}
