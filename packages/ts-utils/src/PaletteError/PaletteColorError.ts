import { Data } from 'effect';

import type { Colors, Hsl } from '../Palette.js';

export class PaletteColorError extends Data.TaggedError('PaletteColorError')<{
  errors: Partial<Colors<Hsl>>;
}> {
  message = 'Failed to make palette color(s)';
}
