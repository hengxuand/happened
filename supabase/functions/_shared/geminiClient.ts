import {GenerativeModel, GoogleGenerativeAI} from "npm:@google/generative-ai";

function requireEnv(name: "GEMINI_API_KEY"): string {
    const value = Deno.env.get(name);
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export function createGeminiModel(options?: {
    model?: string;
    temperature?: number;
    responseMimeType?: string;
}): GenerativeModel {
    const apiKey = requireEnv("GEMINI_API_KEY");
    const genAI = new GoogleGenerativeAI(apiKey);

    return genAI.getGenerativeModel({
        model: options?.model ?? "gemini-3.1-flash-lite",
        generationConfig: {
            responseMimeType: options?.responseMimeType ?? "application/json",
            temperature: options?.temperature ?? 0.2,
        },
    });
}

