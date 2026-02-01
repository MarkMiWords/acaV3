"use strict";
// Simple in-memory rate limiter per IP for ACA v2
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = rateLimitMiddleware;
const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 30;
const ipMap = {};
function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const now = Date.now();
    let entry = ipMap[ip];
    if (!entry || now - entry.windowStart > WINDOW_MS) {
        entry = { count: 1, windowStart: now };
        ipMap[ip] = entry;
    }
    else {
        entry.count += 1;
    }
    if (entry.count > MAX_REQUESTS) {
        return res.status(429).json({
            error: "Rate limit exceeded. Please wait and try again.",
            requestId: req.requestId
        });
    }
    next();
}
//# sourceMappingURL=rateLimit.js.map