/**
 * Guardrails Module
 * Provides content safety checks for user inputs
 */
export type ContentCategory = 'harassment' | 'hate-speech' | 'sexual' | 'dangerous' | 'profanity' | 'spam' | 'allowed';
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
export declare function checkText(text: string): GuardrailResult;
/**
 * Get a safe response for blocked content
 * @param category - The content category that was blocked
 * @returns A safe, generic response to return to the user
 */
export declare function safeResponseFor(category: ContentCategory): string;
//# sourceMappingURL=guardrails.d.ts.map