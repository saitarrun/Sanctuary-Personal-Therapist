import * as Sentry from "@sentry/nextjs";

/**
 * Client-side Sentry configuration
 * Initializes Sentry for browser runtime with React integration
 */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "development";
const release = process.env.NEXT_PUBLIC_SENTRY_RELEASE;

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release,

    // Performance monitoring (Web Vitals)
    tracesSampleRate:
      environment === "production"
        ? parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.1")
        : 1.0,

    // Session replay (optional, for production debugging)
    replaysSessionSampleRate: environment === "production" ? 0.1 : 0,
    replaysOnErrorSampleRate: environment === "production" ? 1.0 : 0,

    // Before send hook for sanitization
    beforeSend(event, hint) {
      // Remove sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.authorization;
      }

      // Sanitize breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((crumb) => {
          if (crumb.data) {
            const sanitized = { ...crumb.data };
            // Remove message content from breadcrumbs (user messages)
            if (crumb.category === "chat") {
              delete sanitized.message;
              delete sanitized.content;
            }
            delete sanitized.password;
            delete sanitized.token;
            delete sanitized.apiKey;
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
      "originalCreateNotification",
      "canvas.contentDocument",
      // Network errors
      "Network request failed",
      "Failed to fetch",
      "ResizeObserver loop limit exceeded",
      "non-Error promise rejection captured",
    ],

    // Attach stack traces
    attachStacktrace: true,

    // Maximum breadcrumbs
    maxBreadcrumbs: 100,
  });
}

export default Sentry;
