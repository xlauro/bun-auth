const isProduction = process.env.NODE_ENV === "production";

// Color codes for development terminal logging
const colors = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeLog(level: LogLevel, message: string, requestId?: string, meta?: any) {
  if (isProduction) {
    // Production output: Structured JSON
    const logPayload = {
      timestamp: formatTimestamp(),
      level,
      requestId,
      message,
      meta,
    };
    console.log(JSON.stringify(logPayload));
  } else {
    // Development output: Pretty-printed console logs
    const timestampStr = `${colors.gray}[${formatTimestamp()}]${colors.reset}`;
    
    let levelStr = `[${level}]`;
    if (level === "DEBUG") levelStr = `${colors.cyan}${levelStr}${colors.reset}`;
    else if (level === "INFO") levelStr = `${colors.green}${levelStr}${colors.reset}`;
    else if (level === "WARN") levelStr = `${colors.yellow}${levelStr}${colors.reset}`;
    else if (level === "ERROR") levelStr = `${colors.red}${levelStr}${colors.reset}`;

    const reqIdStr = requestId 
      ? ` ${colors.gray}[req-id: ${colors.cyan}${requestId.substring(0, 8)}${colors.gray}]${colors.reset}` 
      : "";

    const metaStr = meta ? ` \x1b[90m${JSON.stringify(meta)}\x1b[0m` : "";

    console.log(`${timestampStr} ${levelStr}${reqIdStr} ${message}${metaStr}`);
  }
}

export const logger = {
  debug(message: string, meta?: any) {
    writeLog("DEBUG", message, undefined, meta);
  },
  info(message: string, requestId?: string, meta?: any) {
    writeLog("INFO", message, requestId, meta);
  },
  warn(message: string, requestId?: string, meta?: any) {
    writeLog("WARN", message, requestId, meta);
  },
  error(message: string, error?: any, requestId?: string) {
    let errorMessage = message;
    let metaPayload: any = undefined;

    if (error instanceof Error) {
      errorMessage = `${message}: ${error.message}`;
      metaPayload = { stack: error.stack };
    } else if (error) {
      metaPayload = { error };
    }
    
    writeLog("ERROR", errorMessage, requestId, metaPayload);
  },
};
