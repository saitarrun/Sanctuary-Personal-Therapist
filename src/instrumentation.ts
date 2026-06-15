/**
 * Next.js instrumentation hook
 * Runs on server startup (both during builds and at runtime)
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize Sentry on the server
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime - can add Edge-specific initialization here if needed
  }
}
