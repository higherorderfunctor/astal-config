// codegen:start { preset: barrel, import: 'star', include: '{*.ts,*/index.ts}', extension: { ts: 'js' } }
import * as Error from './Error/index.js';
import * as PackageName from './PackageName.js';

export { Error, PackageName };
// codegen:end
