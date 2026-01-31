// Simple in-memory rate limiter per IP for ACA v2

import { Request, Response, NextFunction } from "express";

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 30;

const ipMap: Record<string, RateLimitEntry> = {};

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";
  const now = Date.now();
  let entry = ipMap[ip as string];
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { count: 1, windowStart: now };
    ipMap[ip as string] = entry;
  } else {
    entry.count += 1;
  }
  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({
      error: "Rate limit exceeded. Please wait and try again.",
      requestId: (req as any).requestId
    });
  }
  next();
}
