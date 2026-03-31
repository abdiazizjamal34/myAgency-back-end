// src/services/ticketNormalizationBot.service.js
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, getTicketSchema } from './ticketNormalizationPrompt.service.js';

export async function runNormalizationBot(cleanedText) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set. Please set it in your environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${SYSTEM_PROMPT}\n\n=== TICKET TEXT ===\n${cleanedText}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: getTicketSchema(),
                temperature: 0.1, // low temperature for analytical extraction
            }
        });

        const output = response.text;
        if (!output) {
            throw new Error("Received empty response from Gemini.");
        }

        return JSON.parse(output);
    } catch (error) {
        console.error("Gemini Normalization Bot Error:", error);
        throw new Error("Failed to normalize ticket with Gemini DB: " + error.message);
    }
}
