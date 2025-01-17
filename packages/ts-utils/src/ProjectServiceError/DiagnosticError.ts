import type { Array, Option } from 'effect';
import { Data } from 'effect';
import type ts from 'typescript';

import type * as ClientFile from '../ClientFile.js';
import type * as NormalizedPath from '../NormalizedPath.js';

export enum DiagnosticCategory {
  Error = 1,
  Message = 3,
  Suggestion = 2,
  Warning = 0,
}

export interface Diagnostic extends ts.Diagnostic {}

export interface DiagnosticMessageChain extends ts.DiagnosticMessageChain {}

export interface DiagnosticRelatedInformation extends ts.DiagnosticRelatedInformation {}
export interface DiagnosticRelatedInformation extends ts.DiagnosticRelatedInformation {}

export class DiagnosticError extends Data.TaggedClass('NotConfigured')<{
  diagnostic: Array.NonEmptyReadonlyArray<Diagnostic>;
  filePath: NormalizedPath.NormalizedPath;
  hasMixedContent: boolean;
  scriptKind: Option.Option<ClientFile.ScriptKind>; // TODO: remove
  tsconfigPath: Option.Option<NormalizedPath.NormalizedPath>;
  workspacePath: Option.Option<NormalizedPath.NormalizedPath>;
}> {
  message = 'Diagnostic errors occurred';
}
