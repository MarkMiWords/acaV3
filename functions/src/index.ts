/**
 * Firebase Cloud Functions v2 API
 * Backend-only API endpoints for acaV3
 */

import { onRequest } from 'firebase-functions/v2/https';
import express, { Router } from 'express';
import cors from 'cors';
import { checkText, safeResponseFor } from './guardrails';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';

// ===================================================================
// WRAP Partner System Prompt
// ===================================================================

const WRAP_PARTNER_SYSTEM = `You are the WRAP Partner — a guided writing assistant inside The Forge, a writing workspace for formerly incarcerated, accessibility-challenged, and financially-challenged writers.

YOUR ROLE:
- You help authors express THEIR words. You never replace authorship.
- You ask clarifying questions, help with expression, and support narrative flow.
- You serve the story, not the user's emotions. You are not a therapist or companion.

RULES:
- Keep responses short (2-4 sentences). Writers need nudges, not essays.
- Never write full paragraphs meant to be pasted into their work.
- When you make a suggestion, frame it as something the AUTHOR could write, not something you wrote for them.
- If the author shares difficult experiences, acknowledge briefly and redirect to the writing. Do not provide counselling.
- Respect the author's voice. Do not "improve" their language or make it more formal.
- If you suggest something, output it in a JSON field called "suggestion" — keep it to one sentence the author might use.
- Only provide a suggestion when the author is stuck or asks for help with wording. Most responses should just be conversation.

HELP MODES (respond appropriately when the author asks for these):
- "Get Started" — Ask what memory or moment they want to capture. Draw it out with sensory questions.
- "Make a Heading" — Suggest 2-3 short title options based on the sheet content.
- "Research a Topic" — Provide brief factual context to support their writing.
- "Guided Composition" — Walk them through their story beat by beat.

CONTEXT:
You will receive the current sheet content (what the author has written) and conversation history. Use the sheet content to stay relevant — reference what they've already written.`;

// ===================================================================
// Revise Tool System Prompts
// ===================================================================

const REVISE_PROMPTS: Record<string, string> = {
  wash: `You are a writing clarity assistant inside The Forge, a workspace for writers from diverse backgrounds.

Your task is to review the author's text and suggest CLARITY improvements. You must:
- Suggest where to add paragraph breaks (reference the text around each break point)
- Identify sentences that are hard to follow and suggest simpler phrasing
- Flag repeated words or phrases
- Suggest places where the writing could breathe (shorter sentences, pauses)

RULES:
- NEVER rewrite the author's voice. Suggest, don't replace.
- Keep suggestions brief and specific — reference exact phrases from the text.
- Respect informal language, slang, and dialect. These are features, not bugs.
- Output your response as a JSON object with this structure:
  {"suggestions": [{"type": "paragraph_break", "after": "exact phrase...", "reason": "short reason"}, {"type": "clarity", "original": "exact phrase...", "suggestion": "simpler version", "reason": "short reason"}, {"type": "repetition", "word": "the word", "count": N, "reason": "short reason"}]}
- Return ONLY the JSON. No other text.`,

  scrub: `You are a structural writing assistant inside The Forge, a workspace for writers from diverse backgrounds.

Your task is to review the author's text and suggest STRUCTURAL improvements. You must:
- Suggest reordering if events are told out of sequence (unless it's clearly intentional)
- Suggest transitions between ideas that feel disconnected
- Identify sections that could be trimmed without losing meaning
- Suggest where the piece feels front-heavy or back-heavy

RULES:
- NEVER rewrite the author's voice. Suggest, don't replace.
- Keep suggestions brief and specific — reference exact phrases from the text.
- Respect the author's storytelling style. Not every piece needs to be linear.
- Output your response as a JSON object with this structure:
  {"suggestions": [{"type": "order", "section": "brief description...", "suggestion": "where it might fit better", "reason": "short reason"}, {"type": "transition", "between": "section A and section B", "suggestion": "a possible bridge sentence", "reason": "short reason"}, {"type": "trim", "section": "exact phrase or summary...", "reason": "why it could be shorter"}]}
- Return ONLY the JSON. No other text.`,
};

// ===================================================================
// Route Definitions
// ===================================================================

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
 * Guided writing assistant powered by Gemini
 */
apiRouter.post('/partner', async (req, res) => {
  try {
    const { message, sheetContent, history } = req.body;

    // Validate input
    if (!message || typeof message !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid message'
      });
      return;
    }

    // Run guardrails check
    const guardrailResult = checkText(message);
    if (!guardrailResult.allowed) {
      res.status(400).json({
        error: 'Content blocked by safety filters',
        message: safeResponseFor(guardrailResult.category),
        category: guardrailResult.category,
      });
      return;
    }

    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.json({
        response: '[DEV MODE] WRAP Partner response would appear here. Set GEMINI_API_KEY to enable.',
        suggestion: null,
      });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Build conversation history for multi-turn chat
    const chatHistory: Content[] = [];
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (turn.role === 'user' || turn.role === 'model') {
          chatHistory.push({
            role: turn.role,
            parts: [{ text: turn.text }],
          });
        }
      }
    }

    // Build the user message with sheet context
    const sheetContext = sheetContent
      ? `\n\n[CURRENT SHEET CONTENT]\n${sheetContent}\n[END SHEET CONTENT]\n\n`
      : '';

    const userPrompt = `${sheetContext}Author says: ${message}

Respond as the WRAP Partner. If you have a concrete writing suggestion the author could add to their sheet, include it in your response AND repeat it separately after the marker [SUGGESTION]. If you have no suggestion, do not include the marker.`;

    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: WRAP_PARTNER_SYSTEM,
    });

    const result = await chat.sendMessage(userPrompt);
    const responseText = result.response.text();

    // Parse out suggestion if present
    let response = responseText;
    let suggestion: string | null = null;

    const suggestionMarker = '[SUGGESTION]';
    const markerIndex = responseText.indexOf(suggestionMarker);
    if (markerIndex !== -1) {
      response = responseText.substring(0, markerIndex).trim();
      suggestion = responseText.substring(markerIndex + suggestionMarker.length).trim();
    }

    res.json({
      response,
      suggestion,
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

/**
 * Revise endpoint
 * AI-powered Wash (clarity) and Scrub (structure) tools
 */
apiRouter.post('/revise', async (req, res) => {
  try {
    const { sheetContent, tool } = req.body;

    if (!sheetContent || typeof sheetContent !== 'string') {
      res.status(400).json({ error: 'Missing or invalid sheetContent' });
      return;
    }

    if (!tool || !['wash', 'scrub'].includes(tool)) {
      res.status(400).json({ error: 'Invalid tool. Must be "wash" or "scrub".' });
      return;
    }

    const guardrailResult = checkText(sheetContent);
    if (!guardrailResult.allowed) {
      res.status(400).json({
        error: 'Content blocked by safety filters',
        message: safeResponseFor(guardrailResult.category),
        category: guardrailResult.category,
      });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.json({
        tool,
        suggestions: [
          { type: 'info', reason: '[DEV MODE] Revise suggestions would appear here. Set GEMINI_API_KEY to enable.' }
        ],
      });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const systemPrompt = REVISE_PROMPTS[tool];
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: sheetContent }] }],
      systemInstruction: systemPrompt,
    });

    const responseText = result.response.text();

    let suggestions: unknown[];
    try {
      const cleaned = responseText.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      const parsed: unknown = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object' && 'suggestions' in (parsed as Record<string, unknown>)) {
        suggestions = (parsed as { suggestions: unknown[] }).suggestions;
      } else {
        suggestions = [{ type: 'info', reason: 'No suggestions — your writing looks solid.' }];
      }
    } catch {
      suggestions = [{ type: 'info', reason: responseText }];
    }

    res.json({
      tool,
      suggestions,
      metadata: {
        sheetLength: sheetContent.length,
        guardrailsPassed: true,
      },
    });
  } catch (error: unknown) {
    console.error('Error in /revise endpoint:', error);
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
