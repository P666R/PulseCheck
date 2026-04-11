import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * AsyncLocalStorage that holds the *request‑scoped* pino logger.
 * The value stored is a pino Logger (the one attached by pino‑http).
 */
export const loggerStore = new AsyncLocalStorage();
