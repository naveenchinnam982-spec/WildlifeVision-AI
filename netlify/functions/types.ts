/**
 * Type declarations and shared runtime helpers for Netlify Serverless Functions
 * Provides 100% type-safety without external dependencies.
 */

export interface HandlerEvent {
  rawUrl?: string;
  rawQuery?: string;
  path?: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string | boolean | number>;
  body: string;
  isBase64Encoded?: boolean;
}

export interface HandlerContext {
  [key: string]: any;
}

export type Handler = (
  event: HandlerEvent,
  context?: HandlerContext
) => Promise<HandlerResponse> | HandlerResponse;

export const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
};

/**
 * Extracts and sanitizes the Gemini API Key from all standard environment variable aliases.
 * Handles quoted strings (e.g. from copy-pasted .env files) and trims whitespace.
 */
export function getCleanApiKey(): string {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GEMINI_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.API_KEY,
  ];

  for (const raw of candidates) {
    if (typeof raw === 'string') {
      const sanitized = raw.trim().replace(/^["']|["']$/g, '').trim();
      if (sanitized.length > 0 && sanitized !== 'your_gemini_api_key_here') {
        return sanitized;
      }
    }
  }

  return '';
}
