import openapi from "@elysia/openapi";
import { Elysia } from "elysia";
import { sql } from "drizzle-orm";
import { config } from "./shared/config";
import { db } from "./shared/db";
import { HttpError } from "./shared/errors/http-errors";
import { authController } from "./modules/auth/auth.controller";
import { protectedController } from "./modules/protected/protected.controller";
import { logger } from "./shared/logger";
import { observabilityPlugin } from "./shared/logger/observability-plugin";

export const app = new Elysia()
  .use(observabilityPlugin) // Track incoming requests, latency, and correlation IDs
  .error({
    HttpError,
  })
  .onError(({ error, set, code }) => {
    // Let Elysia handle validation errors natively
    if (code === "VALIDATION") {
      return;
    }

    // Gracefully catch domain-specific HTTP exceptions and return proper status codes
    if (error instanceof HttpError) {
      set.status = error.status;
      return { error: error.message };
    }

    // Route unhandled system errors through our logger
    logger.error("Unhandled Application Error occurred", error);
    
    set.status = 500;
    return { error: "Internal Server Error: An unexpected error occurred." };
  })
  .use(
    openapi({
      scalar: {
        withDefaultFonts: false,
      },
      documentation: {
        info: {
          title: "Elysia Clean Auth API",
          version: "2.0.0",
          description: "Authentication and authorization API refactored to Clean Architecture / DDD patterns with Observability.",
        },
      },
    })
  )
  .get("/", () => "Hello Elysia - Clean Architecture Auth System is active!")
  .get("/health", async ({ set }) => {
    let dbStatus = "UP";
    try {
      // Direct raw query execution to check Postgres pool status
      await db.execute(sql`SELECT 1`);
    } catch (err) {
      dbStatus = "DOWN";
      logger.error("Healthcheck Database query failed", err);
    }

    const healthReport = {
      status: dbStatus === "UP" ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        database: dbStatus,
      },
    };

    if (dbStatus === "DOWN") {
      set.status = 503; // Service Unavailable
    }

    return healthReport;
  })
  .use(authController)
  .use(protectedController)
  .listen(config.app.port);

logger.info(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
logger.info(`📖 Swagger API documentation available at http://localhost:${config.app.port}/swagger`);
