type LogLevel = "debug" | "info" | "warn" | "error";

const logPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getConfiguredLogLevel(): LogLevel {
  const value = process.env.LOG_LEVEL?.trim().toLowerCase();

  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return logPriority[level] >= logPriority[getConfiguredLogLevel()];
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    value: String(error),
  };
}

function writeLog(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  writeLog("info", message, context);
}

export function logWarn(message: string, context?: Record<string, unknown>) {
  writeLog("warn", message, context);
}

export function logError(message: string, error?: unknown, context?: Record<string, unknown>) {
  writeLog("error", message, {
    ...context,
    error: error === undefined ? undefined : normalizeError(error),
  });
}
