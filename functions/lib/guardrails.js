/**
 * guardrails.ts
 *
 * Narrative-first safety checks for ACaptiveAudience.net.
 * Designed to allow lived-experience storytelling while
 * blocking instructional harm, threats, and unsafe escalation.
 */
/**
 * Entry point used by /chat and /revise endpoints.
 */
export function checkText(text) {
    const normalised = normalise(text);
    if (detectSexualMinors(normalised)) {
        return block("sexual_minors", "Sexual content involving minors is not permitted.");
    }
    if (detectInstructionalHarm(normalised)) {
        return block("instructional_harm", "Instructional or enabling harm is not permitted.");
    }
    if (detectTargetedThreat(normalised)) {
        return block("targeted_threat", "Targeted threats or incitement are not permitted.");
    }
    if (detectSelfHarm(normalised)) {
        return block("self_harm", "Self-harm or suicidal ideation detected.");
    }
    return {
        allowed: true,
        category: "allowed",
        reason: "Narrative content permitted."
    };
}
/**
 * Provide a safe response message when content is blocked.
 * The API layer should use this to reply to the user.
 */
export function safeResponseFor(category) {
    switch (category) {
        case "self_harm":
            return ("I’m really sorry you’re feeling this way. I can’t help with anything that could harm you, " +
                "but you don’t have to go through this alone. If you can, consider reaching out to someone " +
                "you trust or a local crisis support service.");
        case "instructional_harm":
            return ("I can help you write about experiences, feelings, or consequences, " +
                "but I can’t assist with instructions or guidance that could cause harm.");
        case "targeted_threat":
            return ("I can help with reflective or narrative writing, " +
                "but I can’t assist with threats or harm toward specific people or groups.");
        case "sexual_minors":
            return ("I can’t engage with or assist in content involving sexual harm to minors.");
        default:
            return ("I can help with your writing, but I can’t continue with that request as written.");
    }
}
/* ------------------------------------------------------------------ */
/* Detection helpers                                                    */
/* ------------------------------------------------------------------ */
function normalise(input) {
    return input.toLowerCase().replace(/\s+/g, " ").trim();
}
/**
 * Allows narrative discussion of violence or crime,
 * but blocks HOW-TO language and facilitation.
 */
function detectInstructionalHarm(text) {
    const patterns = [
        // weapons / violence instructions
        "how to make a weapon",
        "how to build a bomb",
        "how to stab",
        "how to shoot",
        "best way to kill",
        "most effective way to hurt",
        // evasion / crime facilitation
        "how to get away with",
        "how to avoid police",
        "how to beat a charge",
        "how to hide a body",
        // explicit procedural phrasing
        "step by step",
        "materials needed",
        "instructions for"
    ];
    return patterns.some(p => text.includes(p));
}
/**
 * Blocks direct threats or incitement.
 * Does NOT block first-person reflection or metaphor.
 */
function detectTargetedThreat(text) {
    const patterns = [
        "i will kill you",
        "i am going to kill",
        "they deserve to die",
        "someone should kill",
        "i'm going to hurt you"
    ];
    return patterns.some(p => text.includes(p));
}
/**
 * Detects self-harm ideation.
 * This is intentionally sensitive.
 */
function detectSelfHarm(text) {
    const patterns = [
        "i want to kill myself",
        "i want to die",
        "i don't want to live",
        "end my life",
        "suicide note"
    ];
    return patterns.some(p => text.includes(p));
}
/**
 * Hard block. No nuance here.
 */
function detectSexualMinors(text) {
    const patterns = [
        "child pornography",
        "sexual with a minor",
        "underage sex",
        "minor sexual"
    ];
    return patterns.some(p => text.includes(p));
}
/* ------------------------------------------------------------------ */
/* Utility                                                             */
/* ------------------------------------------------------------------ */
function block(category, reason) {
    return {
        allowed: false,
        category,
        reason
    };
}
