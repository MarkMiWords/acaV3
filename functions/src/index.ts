/**
 * Firebase Cloud Functions v2 API
 * Backend-only API endpoints for acaV3
 */

import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
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

const apiRouter = express.Router();

/**
 * Health check endpoint
 */
apiRouter.get('/health', (req, res) => {
  res.json({ ok: true });
});

/**
 * Chat endpoint
 */
apiRouter.post('/chat', async (req, res) => {
  try {
    const { sheetText, userMessage } = req.body;

    if (!userMessage || typeof userMessage !== 'string') {
      res.status(400).json({ error: 'Missing or invalid userMessage' });
      return;
    }

    const combinedText = `${sheetText || ''}\n${userMessage}`;
    const guardrailResult = checkText(combinedText);

    if (!guardrailResult.allowed) {
      res.status(400).json({
        error: 'Content blocked by safety filters',
        message: safeResponseFor(guardrailResult.category),
      });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_KEY;
    if (!apiKey) {
      res.json({ response: '[DEV MODE] API Key missing.' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      systemInstruction: "You are a writing assistant in The Forge."
    });

    const userPrompt = `The user has provided their writing content:\n\n${sheetText}\n\n The user has asked the following:\n\n${userMessage}\n\n Provide a helpful response based on their writing.`;

    const result = await model.generateContent(userPrompt);
    const response = await result.response;
    res.json({ response: response.text() });
  } catch (error: any) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * WRAP Partner endpoint
 */
apiRouter.post('/partner', async (req, res) => {
  try {
    const { message, sheetContent, history } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Missing or invalid message' });
      return;
    }

    const guardrailResult = checkText(message);
    if (!guardrailResult.allowed) {
      res.status(400).json({
        error: 'Content blocked by safety filters',
        message: safeResponseFor(guardrailResult.category),
      });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_KEY;
    if (!apiKey) {
      res.json({ response: '[DEV MODE] API Key missing.' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      systemInstruction: WRAP_PARTNER_SYSTEM
    });

    const chatHistory: Content[] = [];
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (turn.role === 'user' || turn.role === 'model') {
          chatHistory.push({ role: turn.role, parts: [{ text: turn.text }] });
        }
      }
    }

    const sheetContext = sheetContent ? `\n\n[CURRENT SHEET CONTENT]\n${sheetContent}\n` : '';
    const userPrompt = `${sheetContext}\nAuthor says: ${message}\n\nRespond as the WRAP Partner. Include [SUGGESTION] followed by a one-sentence suggestion if applicable.`;

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(userPrompt);
    const responseText = result.response.text();

    let response = responseText;
    let suggestion: string | null = null;
    const suggestionMarker = '[SUGGESTION]';
    const markerIndex = responseText.indexOf(suggestionMarker);
    if (markerIndex !== -1) {
      response = responseText.substring(0, markerIndex).trim();
      suggestion = responseText.substring(markerIndex + suggestionMarker.length).trim();
    }

    res.json({ response, suggestion });
  } catch (error: any) {
    console.error('Partner Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Revise endpoint
 */
apiRouter.post('/revise', async (req, res) => {
  try {
    const { sheetContent, tool } = req.body;

    if (!sheetContent || !tool || !REVISE_PROMPTS[tool as string]) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const guardrailResult = checkText(sheetContent);
    if (!guardrailResult.allowed) {
      res.status(400).json({ error: 'Content blocked' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_KEY;
    if (!apiKey) {
      res.json({ suggestions: [{ type: 'info', reason: 'API Key missing' }] });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      systemInstruction: REVISE_PROMPTS[tool as string]
    });

    const result = await model.generateContent(sheetContent);
    const responseText = result.response.text();

    let suggestions: any[];
    try {
      const cleaned = responseText.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      suggestions = parsed.suggestions || [{ type: 'info', reason: 'No suggestions' }];
    } catch {
      suggestions = [{ type: 'info', reason: responseText }];
    }

    res.json({ suggestions });
  } catch (error: any) {
    console.error('Revise Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use('/', apiRouter);
app.use('/api', apiRouter);

export const api = onRequest({ region: 'asia-southeast1' }, app);
