import type { HslError } from './HslError.js';
import type { PaletteColorError } from './PaletteColorError.js';

// codegen:start { preset: barrel, include: '{*.ts,*/index.ts}', extension: { ts: 'js' } }
export * from './HslError.js';
export * from './PaletteColorError.js';
// codegen:end

export type PaletteError = HslError | PaletteColorError;
