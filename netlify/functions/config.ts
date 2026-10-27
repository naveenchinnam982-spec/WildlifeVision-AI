import type { Handler, HandlerEvent } from './types.js';

/**
 * Health & Configuration endpoint for Netlify Serverless environment
 * Route: GET /api/config
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true }),
    };
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      hasApiKey: Boolean(apiKey && apiKey.trim().length > 0),
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      fallbackModel: 'gemini-flash-latest',
      thinkingLevel: 'LOW',
      maxUploadSizeMb: 25,
      environment: 'netlify-serverless',
      timestamp: new Date().toISOString(),
    }),
  };
};
