/**
 * Production-safe logger utility
 * Logs only in development mode, silences in production
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  log(...args: any[]) {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  warn(...args: any[]) {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error(...args: any[]) {
    // Always log errors (can be sent to error tracking service)
    console.error(...args);

    // TODO: Send to error tracking service in production
    // if (!isDevelopment) {
    //   // Sentry.captureException(args[0]);
    // }
  },

  info(...args: any[]) {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  debug(...args: any[]) {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};

// Export as default for convenience
export default logger;
