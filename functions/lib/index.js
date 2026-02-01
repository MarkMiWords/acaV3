"use strict";
/**
 * Firebase Cloud Functions v2 API
 * Backend-only API endpoints for acaV3
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const guardrails_1 = require("./guardrails");
// Initialize Express app
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({ origin: true })); // Allow all origins for local development
app.use(express_1.default.json());
/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ ok: true });
});
/**
 * Chat endpoint
 * Accepts user message and sheet content, applies guardrails, and returns response
 */
app.post('/chat', async (req, res) => {
    try {
        const { sheetText, userMessage } = req.body;
        // Validate input
        if (!userMessage || typeof userMessage !== 'string') {
            res.status(400).json({
                error: 'Missing or invalid userMessage'
            });
            return;
        }
        // Combine inputs for guardrail check
        const combinedText = `${sheetText || ''}\n${userMessage}`;
        // Run guardrails check
        const guardrailResult = (0, guardrails_1.checkText)(combinedText);
        // If blocked, return safe response
        if (!guardrailResult.allowed) {
            res.status(400).json({
                error: 'Content blocked by safety filters',
                message: (0, guardrails_1.safeResponseFor)(guardrailResult.category),
                category: guardrailResult.category,
            });
            return;
        }
        // Check for API key (will be needed for real AI calls)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            // Gracefully handle missing key during development
            res.json({
                response: '[DEV MODE] AI response would go here. GEMINI_API_KEY not configured.',
                metadata: {
                    sheetLength: sheetText?.length || 0,
                    messageLength: userMessage.length,
                },
            });
            return;
        }
        // TODO: Call Gemini API using apiKey
        // TODO: Implement actual AI logic here
        // const aiResponse = await callGeminiAPI(combinedText, userMessage, apiKey);
        // Stub response for now
        res.json({
            response: 'This is a stub response. Real AI call will be implemented here.',
            metadata: {
                sheetLength: sheetText?.length || 0,
                messageLength: userMessage.length,
                guardrailsPassed: true,
            },
        });
    }
    catch (error) {
        console.error('Error in /chat endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * Export Express app as Cloud Function v2
 * Region can be configured via firebase.json or deployment flags
 */
exports.api = (0, https_1.onRequest)({
    // Region: us-central1 is default, can be changed if needed
    // Secrets will be automatically injected by Firebase when configured
    secrets: ['GEMINI_API_KEY'],
}, app);
//# sourceMappingURL=index.js.map