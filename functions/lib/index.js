"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
9; /**
 * Firebase Cloud Functions v2 API
 * Backend-only API endpoints for acaV3
 */
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const guardrails_1 = require("./guardrails");
const generative_ai_1 = require("@google/generative-ai");
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `You are an expert in analyzing spreadsheet data. The user has provided the following data from a spreadsheet:\n\n${sheetText}\n\n The user has asked the following question:\n\n${userMessage}\n\n Provide a detailed answer to the user's question based on the provided data.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        res.json({
            response: text,
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
    region: 'asia-southeast1',
    // Region: us-central1 is default, can be changed if needed
    // Secrets will be automatically injected by Firebase when configured
    secrets: ['GEMINI_API_KEY'],
}, app);
//# sourceMappingURL=index.js.map