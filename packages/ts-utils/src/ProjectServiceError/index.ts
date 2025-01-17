import type { DiagnosticError } from './DiagnosticError.js';
import type { NoProgramFound } from './NoProgramFound.js';
import type { NoProjectFound } from './NoProjectFound.js';
import type { NoSourceFileFound } from './NoSourceFileFound.js';
import type { ParseError } from './ParseError.js';
import type { PathError } from './PathError.js';
import type { ProjectNotConfigured } from './ProjectNotConfigured.js';

// codegen:start { preset: barrel, include: '{*.ts,*/index.ts}', extension: { ts: 'js' }, }
export * from './DiagnosticError.js';
export * from './NoProgramFound.js';
export * from './NoProjectFound.js';
export * from './NoSourceFileFound.js';
export * from './ParseError.js';
export * from './PathError.js';
export * from './ProjectNotConfigured.js';
// codegen:end

export type ProjectServiceError =
  | DiagnosticError
  | NoProgramFound
  | NoProjectFound
  | NoSourceFileFound
  | ParseError
  | PathError
  | ProjectNotConfigured;
