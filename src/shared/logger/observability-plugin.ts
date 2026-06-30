import { Elysia } from "elysia";
import { logger } from "./index";

export const observabilityPlugin = new Elysia({ name: "observability" })
  .derive({ as: "global" }, ({ request }) => {
    // 1. Generate or extract correlation ID
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
    
    return {
      requestId,
      startTime: performance.now(),
    };
  })
  .onBeforeHandle({ as: "global" }, ({ requestId, set }) => {
    // 2. Set the response header to return the request ID to the client globally
    if (requestId) {
      set.headers["x-request-id"] = requestId;
    }
  })
  .onAfterResponse({ as: "global" }, ({ request, set, requestId, startTime }) => {
    // 3. Measure transaction latency and log globally
    const duration = startTime ? performance.now() - startTime : 0;
    
    const url = new URL(request.url);
    const path = `${url.pathname}${url.search}`;
    const status = typeof set.status === "number"
      ? set.status
      : typeof set.status === "string"
        ? parseInt(set.status, 10)
        : 200;

    const logMsg = `${request.method} ${path} - Status ${status} in ${duration.toFixed(2)}ms`;

    if (status >= 500) {
      logger.error(logMsg, undefined, requestId);
    } else if (status >= 400) {
      logger.warn(logMsg, requestId);
    } else {
      logger.info(logMsg, requestId);
    }
  });
