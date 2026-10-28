import type { Handler, HandlerEvent } from './types.js';
import { getCleanApiKey } from './types.js';

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

  const apiKey = getCleanApiKey();

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      hasApiKey: Boolean(apiKey && apiKey.length > 0),
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      fallbackModel: 'gemini-3.5-flash',
      thinkingLevel: 'LOW',
      maxUploadSizeMb: 25,
      environment: 'netlify-serverless',
      timestamp: new Date().toISOString(),
    }),
  };
};
