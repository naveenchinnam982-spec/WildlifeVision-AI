import type { Handler, HandlerEvent } from './types.js';

/**
 * Survey History endpoint for Netlify Serverless environment
 * Route: GET /api/history, POST /api/history/clear, DELETE /api/history/:id, PATCH /api/history/:id/gps
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
};

// In-memory array for warm serverless container lifetime
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

  // 1. Clear all history
  if (event.httpMethod === 'POST' && path.includes('/clear')) {
    serverlessHistoryCache.length = 0;
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: 'All analysis history cleared' }),
    };
  }

  // 2. Delete specific record
  if (event.httpMethod === 'DELETE') {
    const parts = path.split('/');
    const id = parts[parts.length - 1];
    const idx = serverlessHistoryCache.findIndex((item) => item.analysisId === id);
    if (idx !== -1) {
      serverlessHistoryCache.splice(idx, 1);
    }
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: `Record ${id} removed` }),
    };
  }

  // 3. Patch GPS coordinates
  if (event.httpMethod === 'PATCH') {
    let body: any = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        // Ignored
      }
    }
    const { gps, droneMetadata } = body;
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        data: {
          gps: gps || null,
          droneMetadata: droneMetadata || null,
          updatedAt: new Date().toISOString(),
        },
      }),
    };
  }

  // 4. Default: GET /api/history
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      data: serverlessHistoryCache,
    }),
  };
};
