import { Data } from 'effect';
import type ts from 'typescript';

export class ProjectNotConfigured extends Data.TaggedClass('ProjectNotConfigured')<{
  directory: string;
  file: string;
  kind: ts.server.ProjectKind;
  projectName: string;
}> {
  message = 'Project not configured';
}
