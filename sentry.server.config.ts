import * as Sentry from "@sentry/nextjs";

/**
 * Server-side Sentry configuration
 * Initializes Sentry for Node.js runtime in Next.js server routes
 */

const dsn = process.env.SENTRY_DSN;
const environment = process.env.SENTRY_ENVIRONMENT || "development";
const release = process.env.SENTRY_RELEASE;

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release,

    // Performance monitoring
    tracesSampleRate:
      environment === "production"
        ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1")
        : 1.0,

    // Server-specific settings
    serverName: process.env.VERCEL_URL || "localhost",

    // Server integrations are auto-loaded

    // Request handling
    beforeSend(event, hint) {
      // Sanitize sensitive data before sending
      if (event.request) {
        // Remove authorization headers
        delete event.request.headers?.authorization;
        delete event.request.headers?.["x-api-key"];
        delete event.request.cookies;
      }

      // Remove sensitive breadcrumb data
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((crumb) => {
          if (crumb.data) {
            const sanitized = { ...crumb.data };
            delete sanitized.password;
            delete sanitized.token;
            delete sanitized.apiKey;
            delete sanitized.sessionId;
            return { ...crumb, data: sanitized };
          }
          return crumb;
        });
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      "top.GLOBALS",
      // See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
      "originalCreateNotification",
      "canvas.contentDocument",
      "MyApp_RemoveAllHighlights",
      // Network errors that are expected
      "Network request failed",
      "Failed to fetch",
    ],
  });
}

export default Sentry;
