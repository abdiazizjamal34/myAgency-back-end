// src/services/ticketNormalizationOrchestrator.service.js
import { runNormalizationBot } from './ticketNormalizationBot.service.js';
import { validateTicketSchema } from './ticketNormalizationValidator.service.js';

function preprocessText(rawText) {
    if (!rawText) return "";
    // Layer 1: Clean text to aid OCR
    let cleaned = rawText
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
        .replace(/\s{3,}/g, '  ') // Reduce multiple spaces but keep table structure
        .trim();
    return cleaned;
}

export async function normalizeTicketSchema(rawText) {
    const cleanedText = preprocessText(rawText);

    try {
        // Layer 2: LLM JSON Extraction
        const normalizedBotOutput = await runNormalizationBot(cleanedText);

        // Layer 3: Validation and Status Categorization
        const validated = validateTicketSchema(normalizedBotOutput);

        return {
            normalized: {
                airline: validated.airline,
                ticket: validated.ticketInfo,
                passengers: validated.passengers,
                itinerary: validated.itinerary,
                fare: {
                    currency: validated.fare.currency || "",
                    base: validated.fare.baseFare || 0,
                    taxes: validated.fare.taxes || 0,
                    total: validated.fare.total || 0,
                    breakdown: [] // If breakdown is needed
                },
                notes: validated.notes || []
            },
            normalizationMeta: {
                version: "v2-bot-gemini-1.5-flash",
                rawText: rawText,
                cleanedText: cleanedText,
                confidence: validated.meta.confidence,
                needsReview: validated.meta.needsReview,
                missingFields: validated.meta.missingFields,
                warnings: validated.meta.warnings
            },
            processingStatus: validated.processingStatus
        };
    } catch (err) {
        console.error("Orchestrator error:", err);
        return {
            normalized: { airline: {}, ticket: {}, passengers: [], itinerary: [], fare: { base: 0, taxes: 0, total: 0 }, notes: [] },
            normalizationMeta: {
                version: "v2-bot-gemini-1.5-flash",
                rawText: rawText,
                cleanedText: cleanedText,
                confidence: 0,
                needsReview: true,
                missingFields: ["ALL"],
                warnings: [err.message]
            },
            processingStatus: "FAILED"
        };
    }
}
