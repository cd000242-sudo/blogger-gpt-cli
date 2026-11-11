/**
 * Spider (cornerstone) post — pure decision logic used by the generate-internal-consistency handler.
 * electron/main.ts loads this through loadCoreModule('spider') (compiled to dist/core/spider).
 */
export * from './engine';
export * from './failure';
export * from './title';
export * from './draft';
export * from './completeness';
export * from './gemini-assist';
export * from './agent-instructions';
export * from './finish';
export * from './image-report';
