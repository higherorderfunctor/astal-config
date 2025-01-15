import type { Array } from 'effect';
import { Data } from 'effect';
import type ts from 'typescript';

export class DiagnosticError extends Data.TaggedClass('NotConfigured')<{
  diagnostic: Array.NonEmptyReadonlyArray<ts.Diagnostic>;
  directory: string;
  file: string;
  kind?: ts.ScriptKind | undefined;
}> {
  message = 'Diagnostic errors occurred';
}
