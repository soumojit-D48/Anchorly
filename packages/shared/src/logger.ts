import pino from 'pino';
import { mkdirSync } from 'node:fs';

mkdirSync('logs', { recursive: true });

const level = process.env.LOG_LEVEL ?? 'info';

const consoleLogger = pino({
  level,
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const fileLogger = pino({ level }, pino.destination('logs/app.log'));

function createLogMethod(method: 'info' | 'warn' | 'error' | 'debug' | 'fatal') {
  return (...args: unknown[]): void => {
    (consoleLogger[method] as (...a: unknown[]) => void)(...args);
    (fileLogger[method] as (...a: unknown[]) => void)(...args);
  };
}

export const logger = {
  info: createLogMethod('info'),
  warn: createLogMethod('warn'),
  error: createLogMethod('error'),
  debug: createLogMethod('debug'),
  fatal: createLogMethod('fatal'),
  level,
};
