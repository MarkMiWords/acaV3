/**
 * Firebase Cloud Functions v2 API
 * Backend-only API endpoints for acaV3
 */

import { onRequest } from 'firebase-functions/v2/https';
import express, { Router } from 'express';
import cors from 'cors';
import { checkText, safeResponseFor } from './guardrails';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Create a router to hold all the API routes
const apiRouter = Router();

/**
 * Health check endpoint
 */
apiRouter.get('/health', (req, res) => {
  res.json({ ok: true });
});

/**
 * Chat endpoint
 * Accepts user message and sheet content, applies guardrails, and returns response
 */
apiRouter.post('/chat', async (req, res) => {
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
    const guardrailResult = checkText(combinedText);

    // If blocked, return safe response
    if (!guardrailResult.allowed) {
      res.status(400).json({
        error: 'Content blocked by safety filters',
        message: safeResponseFor(guardrailResult.category),
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro"});

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
  } catch (error: unknown) {
    console.error('Error in /chat endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * WRAP Partner endpoint
 * Mock endpoint for guided writing assistance
 */
apiRouter.post('/partner', async (req, res) => {
  try {
    const { message, sheetContent } = req.body;

    // Validate input
    if (!message || typeof message !== 'string') {
      res.status(400).json({ 
        error: 'Missing or invalid message' 
      });
      return;
    }

    // Run guardrails check
    const guardrailResult = checkText(message);

    // If blocked, return safe response
    if (!guardrailResult.allowed) {
      res.status(400).json({
        error: 'Content blocked by safety filters',
        message: safeResponseFor(guardrailResult.category),
        category: guardrailResult.category,
      });
      return;
    }

    // Mock responses for now (will be replaced with real AI later)
    const mockResponses = [
      {
        response: "That's an interesting point. Could you tell me more about what led to that moment?",
        suggestion: null
      },
      {
        response: "I can help you expand on that. Here's a suggestion:",
        suggestion: "Consider adding sensory details like what you saw, heard, or felt in that moment."
      },
      {
        response: "Let's work on making this clearer.",
        suggestion: "Try rephrasing this in your own words, as if you were telling a friend."
      }
    ];

    // Random selection for demo
    const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];

    res.json({
      ...response,
      metadata: {
        messageLength: message.length,
        sheetLength: sheetContent?.length || 0,
        guardrailsPassed: true,
      },
    });
  } catch (error: unknown) {
    console.error('Error in /partner endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Initialize the main Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Mount the router at both the root and /api
// This allows the function to handle requests from both the hosting rewrite and direct invocation
app.use('/', apiRouter);
app.use('/api', apiRouter);


/**
 * Export Express app as Cloud Function v2
 * Region can be configured via firebase.json or deployment flags
 */
export const api = onRequest(
  {
    region: 'asia-southeast1',
    // Secrets will be automatically injected by Firebase when configured
    secrets: ['GEMINI_API_KEY'],
  },
  app
);
