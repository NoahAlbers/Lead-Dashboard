type LogLevel = "info" | "warn" | "error";

function log(
  level: LogLevel,
  tag: string,
  message: string,
  data?: Record<string, unknown>
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    tag,
    message,
    ...data,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (tag: string, msg: string, data?: Record<string, unknown>) =>
    log("info", tag, msg, data),
  warn: (tag: string, msg: string, data?: Record<string, unknown>) =>
    log("warn", tag, msg, data),
  error: (tag: string, msg: string, data?: Record<string, unknown>) =>
    log("error", tag, msg, data),
};
