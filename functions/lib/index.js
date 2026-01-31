import express from "express";
import { onRequestV2 } from "firebase-functions/v2/https";
import cors from "cors";
import { checkText, safeResponseFor } from "./guardrails";
import { rateLimitMiddleware } from "./rateLimit";
import { v4 as uuidv4 } from "uuid";
// Configurable CORS origins
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",")
    : ["http://localhost:5000", "https://acaptiveaudience.net"];
const app = express();
// JSON body parsing with explicit limit
app.use(express.json({ limit: "200kb" }));
// Request ID middleware
app.use((req, res, next) => {
    req.requestId = req.headers["x-request-id"] || uuidv4();
    res.setHeader("X-Request-Id", req.requestId);
    next();
});
// Structured logging
app.use((req, res, next) => {
    console.log(JSON.stringify({
        type: "request",
        method: req.method,
        url: req.url,
        requestId: req.requestId,
        ip: req.ip,
        time: new Date().toISOString()
    }));
    next();
});
// CORS middleware
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    }
}));
// Rate limiting
app.use(rateLimitMiddleware);
// Timeout guard
app.use((req, res, next) => {
    const timeout = setTimeout(() => {
        res.status(503).json({ error: "Request timed out", requestId: req.requestId });
    }, 10000); // 10s
    res.on("finish", () => clearTimeout(timeout));
    next();
});
// Routes
app.get("/health", (req, res) => {
    res.json({
        ok: true,
        version: "0.1.0",
        timestamp: Date.now(),
        requestId: req.requestId
    });
});
app.post("/chat", async (req, res) => {
    const { sheetText = "", userMessage = "", mode = "chat" } = req.body || {};
    const moderation = checkText(sheetText + userMessage);
    if (!moderation.allowed) {
        return res.status(400).json({
            moderation,
            assistantMessage: safeResponseFor(moderation.category),
            requestId: req.requestId
        });
    }
    // Placeholder assistant message
    res.json({
        assistantMessage: "Let's keep writing together! What would you like to explore or revise next?",
        moderation: { allowed: true },
        usage: { placeholder: true },
        requestId: req.requestId
    });
});
app.post("/revise", async (req, res) => {
    const { sheetText = "", mode = "rinse" } = req.body || {};
    const moderation = checkText(sheetText);
    if (!moderation.allowed) {
        return res.status(400).json({
            moderation,
            revisedText: sheetText,
            changeNotes: [],
            requestId: req.requestId
        });
    }
    let revisedText = sheetText;
    let changeNotes = [];
    if (mode === "rinse") {
        // Trim, normalize whitespace, remove double spaces
        const trimmed = revisedText.trim();
        const normalized = trimmed.replace(/\s+/g, " ");
        revisedText = normalized.replace(/ {2,}/g, " ");
        changeNotes.push("Trimmed and normalized whitespace.");
    }
    else if (mode === "wash") {
        // Paragraph breaks, sentence spacing
        let washed = revisedText.replace(/\r\n/g, "\n");
        washed = washed.replace(/\n{2,}/g, "\n");
        washed = washed.replace(/([.!?])\s*(?=[A-Z])/g, "$1 ");
        washed = washed.replace(/([^\n])\n([^\n])/g, "$1\n\n$2");
        revisedText = washed;
        changeNotes.push("Enforced paragraph breaks and sentence spacing.");
    }
    else if (mode === "scrub") {
        // Rinse + wash + tighten
        let scrubbed = revisedText.trim().replace(/\s+/g, " ").replace(/ {2,}/g, " ");
        scrubbed = scrubbed.replace(/\r\n/g, "\n");
        scrubbed = scrubbed.replace(/\n{2,}/g, "\n");
        scrubbed = scrubbed.replace(/([.!?])\s*(?=[A-Z])/g, "$1 ");
        scrubbed = scrubbed.replace(/([^\n])\n([^\n])/g, "$1\n\n$2");
        // Remove filler phrases
        const fillers = [
            "just to be clear",
            "in my opinion",
            "needless to say",
            "as a matter of fact",
            "for what it's worth",
            "at the end of the day"
        ];
        fillers.forEach(f => {
            const re = new RegExp("\\b" + f + "\\b", "gi");
            scrubbed = scrubbed.replace(re, "");
        });
        revisedText = scrubbed;
        changeNotes.push("Trimmed, normalized, paragraph breaks, and removed filler phrases.");
    }
    else {
        changeNotes.push("No revision applied.");
    }
    res.json({
        revisedText,
        changeNotes,
        moderation,
        requestId: req.requestId
    });
});
// Export single HTTPS function named 'api'
export const api = onRequestV2({ region: "us-central1" }, app);
