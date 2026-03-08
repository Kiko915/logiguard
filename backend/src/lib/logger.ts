import pino from "pino";
import { config } from "../config/index.js";

// ─── Structured Logger ─────────────────────────────────────────────────────────
// Uses pino for high-performance structured logging.
// Pretty-prints in development; outputs JSON in production for log aggregators.
export const logger = pino({
  level: config.NODE_ENV === "production" ? "info" : "debug",
  ...(config.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
  base: {
    service: "logiguard-api",
    env: config.NODE_ENV,
  },
});
