import { Context } from 'effect';
import type ts from 'typescript';

export type TsProjectService = ts.server.ProjectService;
export const TsProjectService = Context.Tag('TsProjectService')<TsProjectService, ts.server.ProjectService>();
