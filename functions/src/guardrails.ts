/**
 * Guardrails Module
 * Provides content safety checks for user inputs
 */

export type ContentCategory = 
  | 'harassment'
  | 'hate-speech'
  | 'sexual'
  | 'dangerous'
  | 'profanity'
  | 'spam'
  | 'allowed';

export interface GuardrailResult {
  allowed: boolean;
  category: ContentCategory;
  reason?: string;
}

/**
 * Check text content against guardrail policies
 * @param text - Combined text to check (e.g., sheet content + user message)
 * @returns GuardrailResult indicating if content is allowed
 */
export function checkText(text: string): GuardrailResult {
  const lowerText = text.toLowerCase();

  // Basic keyword-based checks (production would use Gemini Safety API)
  const harassmentPatterns = /\b(threat|attack|harm|kill|hurt)\b/i;
  const hateSpeechPatterns = /\b(racist|sexist|bigot)\b/i;
  const sexualPatterns = /\b(explicit sexual content placeholder)\b/i;
  const dangerousPatterns = /\b(bomb|weapon|explosive|terrorist)\b/i;

  if (harassmentPatterns.test(lowerText)) {
    return {
      allowed: false,
      category: 'harassment',
      reason: 'Content contains threatening or harassing language',
    };
  }

  if (hateSpeechPatterns.test(lowerText)) {
    return {
      allowed: false,
      category: 'hate-speech',
      reason: 'Content contains hate speech',
    };
  }

  if (sexualPatterns.test(lowerText)) {
    return {
      allowed: false,
      category: 'sexual',
      reason: 'Content contains inappropriate sexual content',
    };
  }

  if (dangerousPatterns.test(lowerText)) {
    return {
      allowed: false,
      category: 'dangerous',
      reason: 'Content contains dangerous or illegal activity references',
    };
  }

  // Check for excessive length (potential spam)
  if (text.length > 10000) {
    return {
      allowed: false,
      category: 'spam',
      reason: 'Content exceeds maximum length',
    };
  }

  return {
    allowed: true,
    category: 'allowed',
  };
}

/**
 * Get a safe response for blocked content
 * @param category - The content category that was blocked
 * @returns A safe, generic response to return to the user
 */
export function safeResponseFor(category: ContentCategory): string {
  const responses: Record<ContentCategory, string> = {
    'harassment': 'I cannot process content that contains threatening or harassing language.',
    'hate-speech': 'I cannot process content that contains hate speech or discriminatory language.',
    'sexual': 'I cannot process content that contains inappropriate sexual content.',
    'dangerous': 'I cannot process content that references dangerous or illegal activities.',
    'profanity': 'I cannot process content that contains excessive profanity.',
    'spam': 'The content is too long or appears to be spam.',
    'allowed': 'Content is allowed.',
  };

  return responses[category] || 'I cannot process this content.';
}
