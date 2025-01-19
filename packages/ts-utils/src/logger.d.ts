// import * as E from 'effect/Effect';

declare module 'effect' {
  namespace Effect {
    const logError: (message: string, annotations?: Record<string, unknown>) => void;
    const logError2: (message: string, annotations?: Record<string, unknown>) => void;
    export { logError, logError2 };
  }
}
