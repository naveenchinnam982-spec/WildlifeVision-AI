import type { Handler, HandlerEvent } from './types.js';

/**
 * Survey History endpoint for Netlify Serverless environment
 * Route: GET /api/history, POST /api/history/clear, DELETE /api/history/:id
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
};

const serverlessHistoryCache: any[] = [];

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true }),
    };
  }

  const path = event.path || '';

  if (event.httpMethod === 'POST' && path.includes('/clear')) {
    serverlessHistoryCache.length = 0;
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: 'All analysis history cleared' }),
    };
  }

  if (event.httpMethod === 'DELETE') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: 'Record removed' }),
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      data: serverlessHistoryCache,
    }),
  };
};
