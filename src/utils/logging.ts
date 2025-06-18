// src/utils/logging.ts

// Store the original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

// Check if we're in production
const isProduction = import.meta.env.MODE === 'production';

// Define log types for type safety
type LogFunction = (...args: any[]) => void;
type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';
type LogLevels = Record<LogLevel, LogFunction>;

// Create logger functions
export const createLogger = (): LogLevels => {
  // In production, silence all logs except error by default
  if (isProduction) {
    return {
      log: () => {},
      info: () => {},
      warn: () => {},
      debug: () => {},
      // Keep error logs for critical issues
      error: (...args: any[]) => originalConsole.error(...args),
    };
  }
  
  // In development, use enhanced logging
  return {
    log: (...args: any[]) => originalConsole.log('[LOG]', ...args),
    info: (...args: any[]) => originalConsole.info('[INFO]', ...args),
    warn: (...args: any[]) => originalConsole.warn('[WARN]', ...args),
    debug: (...args: any[]) => originalConsole.debug('[DEBUG]', ...args),
    error: (...args: any[]) => originalConsole.error('[ERROR]', ...args),
  };
};

// Override console methods based on environment
export const configureLogging = (silenceAll = false, forceEnableLogging = false): void => {
  if ((isProduction || silenceAll) && !forceEnableLogging) {
    // In production or when explicitly silenced, disable most logs
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.debug = () => {};
    
    // Optionally keep error logs unless explicitly silenced
    if (silenceAll) {
      console.error = () => {};
    }
  } else {
    // In development or when force enabled, use enhanced logging with prefixes
    console.log = (...args: any[]) => originalConsole.log('[LOG]', ...args);
    console.info = (...args: any[]) => originalConsole.info('[INFO]', ...args);
    console.warn = (...args: any[]) => originalConsole.warn('[WARN]', ...args);
    console.debug = (...args: any[]) => originalConsole.debug('[DEBUG]', ...args);
    console.error = (...args: any[]) => originalConsole.error('[ERROR]', ...args);
  }
};

// Export logger instance
export const logger = createLogger();

// Export environment check
export const isProductionEnv = isProduction;

// Export a restore function to return to original behavior if needed
export const restoreConsole = (): void => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
}; 