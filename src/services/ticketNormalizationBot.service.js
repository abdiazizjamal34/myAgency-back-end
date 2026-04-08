// src/services/ticketNormalizationBot.service.js
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, getTicketSchema } from './ticketNormalizationPrompt.service.js';

const DEFAULT_PROVIDER = 'gemini';
const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash'];
const DEFAULT_OPENAI_MODELS = ['gpt-4.1-mini'];
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_STATUS_TEXT = ['UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'DEADLINE_EXCEEDED', 'INTERNAL', 'RATE LIMIT'];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseModelCandidates(rawValue, fallback) {
    const fromEnv = (rawValue || '')
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean);

    return fromEnv.length ? fromEnv : fallback;
}

function getNormalizationProvider() {
    const provider = String(process.env.NORMALIZATION_PROVIDER || process.env.TICKET_NORMALIZATION_PROVIDER || DEFAULT_PROVIDER)
        .trim()
        .toLowerCase();

    if (!['gemini', 'openai'].includes(provider)) {
        throw new Error(`Unsupported NORMALIZATION_PROVIDER: ${provider}. Use \"gemini\" or \"openai\".`);
    }

    return provider;
}

function getGeminiModelCandidates() {
    return parseModelCandidates(process.env.GEMINI_NORMALIZATION_MODELS, DEFAULT_GEMINI_MODELS);
}

function getOpenAiModelCandidates() {
    return parseModelCandidates(process.env.OPENAI_NORMALIZATION_MODELS, DEFAULT_OPENAI_MODELS);
}

function isRetryableProviderError(error) {
    const statusCode = Number(error?.status ?? error?.code ?? error?.error?.code);
    if (RETRYABLE_STATUS_CODES.has(statusCode)) {
        return true;
    }

    const text = [
        error?.statusText,
        error?.message,
        error?.error?.status,
        error?.error?.message,
    ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase();

    return RETRYABLE_STATUS_TEXT.some((token) => text.includes(token));
}

function isModelNotFoundError(error) {
    const statusCode = Number(error?.status ?? error?.code ?? error?.error?.code);
    const text = [
        error?.statusText,
        error?.message,
        error?.error?.status,
        error?.error?.message,
    ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase();

    return statusCode === 404 || text.includes('NOT_FOUND') || text.includes('MODEL IS NOT FOUND') || text.includes('MODELS/');
}

function isOpenAiInsufficientQuotaError(error) {
    const statusCode = Number(error?.status ?? error?.code ?? error?.error?.code);
    const code = String(error?.error?.code || '').toLowerCase();
    const type = String(error?.error?.type || '').toLowerCase();
    const text = [error?.message, error?.error?.message]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (code === 'insufficient_quota' || type === 'insufficient_quota') {
        return true;
    }

    return statusCode === 429 && (text.includes('insufficient_quota') || text.includes('exceeded your current quota'));
}

function toOpenAiInsufficientQuotaFailure(error) {
    const wrapped = new Error('OpenAI quota exceeded (insufficient_quota). Add billing/credits to your OpenAI account or switch NORMALIZATION_PROVIDER to gemini.');
    wrapped.status = Number(error?.status ?? error?.code ?? error?.error?.code ?? 429);
    wrapped.code = 'insufficient_quota';
    wrapped.provider = 'openai';
    wrapped.originalError = error;
    return wrapped;
}

function isOpenAiInsufficientQuotaFailure(error) {
    const code = String(error?.code || '').toLowerCase();
    const provider = String(error?.provider || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return (provider === 'openai' && code === 'insufficient_quota')
        || message.includes('insufficient_quota')
        || message.includes('exceeded your current quota');
}

function extractGeminiErrorMessage(error) {
    return error?.message || error?.error?.message || 'Unknown Gemini error';
}

function extractProviderErrorMessage(error) {
    return error?.message || error?.error?.message || 'Unknown provider error';
}

function validateGeminiApiKey(apiKey) {
    const trimmed = String(apiKey || '').trim();

    if (!trimmed) {
        throw new Error('GEMINI_API_KEY is not set. Please set it in your environment variables.');
    }

    // OpenAI keys usually start with "sk-" and are not valid for Google Gemini APIs.
    if (trimmed.startsWith('sk-')) {
        throw new Error('GEMINI_API_KEY appears to be an OpenAI key (starts with "sk-"). This service uses @google/genai and requires a Google AI Studio Gemini API key.');
    }

    return trimmed;
}

function validateOpenAiApiKey(apiKey) {
    const trimmed = String(apiKey || '').trim();

    if (!trimmed) {
        throw new Error('OPENAI_API_KEY is not set. Please set it in your environment variables.');
    }

    // Gemini API keys usually start with "AIza" and are not valid for OpenAI APIs.
    if (trimmed.startsWith('AIza')) {
        throw new Error('OPENAI_API_KEY appears to be a Gemini key (starts with "AIza"). Set a valid OpenAI API key.');
    }

    return trimmed;
}

function getOpenAiBaseUrl() {
    return String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
}

async function runGeminiNormalization(cleanedText) {
    const geminiApiKey = validateGeminiApiKey(process.env.GEMINI_API_KEY);

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const modelCandidates = getGeminiModelCandidates();
    const maxAttemptsPerModel = parsePositiveInt(process.env.GEMINI_NORMALIZATION_MAX_ATTEMPTS, 3);
    const retryBaseDelayMs = parsePositiveInt(process.env.GEMINI_NORMALIZATION_RETRY_BASE_MS, 800);

    let lastError;
    let totalAttempts = 0;

    for (const model of modelCandidates) {
        for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
            totalAttempts += 1;

            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: `${SYSTEM_PROMPT}\n\n=== TICKET TEXT ===\n${cleanedText}`,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: getTicketSchema(),
                        temperature: 0.1,
                    }
                });

                const output = response.text;
                if (!output) {
                    throw new Error('Received empty response from Gemini.');
                }

                return JSON.parse(output);
            } catch (error) {
                lastError = error;
                const retryable = isRetryableProviderError(error);
                const hasAttemptsLeftOnModel = attempt < maxAttemptsPerModel;

                if (isModelNotFoundError(error)) {
                    console.warn(`Gemini model unavailable for generateContent (model=${model}). Trying next configured model.`);
                    break;
                }

                if (!retryable) {
                    console.error(`Gemini Normalization Bot non-retryable error (model=${model}, attempt=${attempt}):`, error);
                    throw new Error(`Failed to normalize ticket with Gemini: ${extractGeminiErrorMessage(error)}`);
                }

                if (hasAttemptsLeftOnModel) {
                    const delayMs = retryBaseDelayMs * (2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
                    console.warn(`Gemini transient error (model=${model}, attempt=${attempt}/${maxAttemptsPerModel}). Retrying in ${delayMs}ms.`);
                    await sleep(delayMs);
                } else {
                    console.warn(`Gemini transient error (model=${model}). Switching model if available.`);
                }
            }
        }
    }

    console.error('Gemini Normalization Bot Error after retries:', lastError);
    throw new Error(
        `Failed to normalize ticket with Gemini after ${totalAttempts} attempts across models [${modelCandidates.join(', ')}]: ${extractGeminiErrorMessage(lastError)}`
    );
}

function parseOpenAiErrorBody(bodyText) {
    try {
        return JSON.parse(bodyText);
    } catch {
        return { message: bodyText };
    }
}

async function callOpenAiChatCompletion({ apiKey, model, cleanedText }) {
    const response = await fetch(`${getOpenAiBaseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `=== TICKET TEXT ===\n${cleanedText}` },
            ],
        }),
    });

    if (!response.ok) {
        const bodyText = await response.text();
        const body = parseOpenAiErrorBody(bodyText);
        const message = body?.error?.message || body?.message || `OpenAI HTTP ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        err.error = body?.error || body;
        throw err;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('Received empty response from OpenAI.');
    }

    return JSON.parse(content);
}

async function runOpenAiNormalization(cleanedText) {
    const openAiApiKey = validateOpenAiApiKey(process.env.OPENAI_API_KEY);
    const modelCandidates = getOpenAiModelCandidates();
    const maxAttemptsPerModel = parsePositiveInt(process.env.OPENAI_NORMALIZATION_MAX_ATTEMPTS, 3);
    const retryBaseDelayMs = parsePositiveInt(process.env.OPENAI_NORMALIZATION_RETRY_BASE_MS, 800);

    let lastError;
    let totalAttempts = 0;

    for (const model of modelCandidates) {
        for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt += 1) {
            totalAttempts += 1;

            try {
                return await callOpenAiChatCompletion({ apiKey: openAiApiKey, model, cleanedText });
            } catch (error) {
                lastError = error;
                const retryable = isRetryableProviderError(error);
                const hasAttemptsLeftOnModel = attempt < maxAttemptsPerModel;

                if (isOpenAiInsufficientQuotaError(error)) {
                    console.error(`OpenAI quota exceeded (model=${model}, attempt=${attempt}).`, error);
                    throw toOpenAiInsufficientQuotaFailure(error);
                }

                if (isModelNotFoundError(error)) {
                    console.warn(`OpenAI model unavailable for chat/completions (model=${model}). Trying next configured model.`);
                    break;
                }

                if (!retryable) {
                    console.error(`OpenAI Normalization Bot non-retryable error (model=${model}, attempt=${attempt}):`, error);
                    throw new Error(`Failed to normalize ticket with OpenAI: ${extractProviderErrorMessage(error)}`);
                }

                if (hasAttemptsLeftOnModel) {
                    const delayMs = retryBaseDelayMs * (2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
                    console.warn(`OpenAI transient error (model=${model}, attempt=${attempt}/${maxAttemptsPerModel}). Retrying in ${delayMs}ms.`);
                    await sleep(delayMs);
                } else {
                    console.warn(`OpenAI transient error (model=${model}). Switching model if available.`);
                }
            }
        }
    }

    console.error('OpenAI Normalization Bot Error after retries:', lastError);
    throw new Error(
        `Failed to normalize ticket with OpenAI after ${totalAttempts} attempts across models [${modelCandidates.join(', ')}]: ${extractProviderErrorMessage(lastError)}`
    );
}

export async function runNormalizationBot(cleanedText) {
    const provider = getNormalizationProvider();

    if (provider === 'openai') {
        try {
            return await runOpenAiNormalization(cleanedText);
        } catch (error) {
            if (isOpenAiInsufficientQuotaFailure(error)) {
                console.warn('OpenAI quota exhausted. Falling back to Gemini normalization.');
                return runGeminiNormalization(cleanedText);
            }

            throw error;
        }
    }

    return runGeminiNormalization(cleanedText);
}
