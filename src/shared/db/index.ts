import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Logger } from "drizzle-orm/logger";
import { config } from "../config";
import * as schema from "./schema";
import { logger } from "../logger";

// Custom database query logger to route Drizzle operations through our logger
class DrizzleLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    logger.debug(`SQL Query: ${query}`, { params });
  }
}

const client = postgres(config.db.url);
export const db = drizzle(client, { 
  schema, 
  logger: new DrizzleLogger(),
});

export * from "./schema";
