import { Data } from 'effect';

import type { Hsl } from '../Palette.js';

export class HslError extends Data.TaggedError('HslError')<{
  error: string;
  hsl: Hsl;
  input: string;
}> {
  message = 'Failed to convert HSL color';
}
