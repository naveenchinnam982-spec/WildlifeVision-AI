import type { Handler, HandlerEvent, HandlerContext } from './types.js';
import { handler as animalHandler } from './analyze-animal.js';
import { handler as videoHandler } from './analyze-video.js';

/**
 * Universal Inference Dispatcher for POST /api/analyze
 * Dispatches to video tracking if keyframes are provided, or animal detection if single image.
 */

export const handler: Handler = async (event: HandlerEvent, context?: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify({ success: true }),
    };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        service: 'WildlifeVision AI Universal Inference Engine',
        endpoint: '/api/analyze',
        description: 'POST image payload (imageDataUrl) for photo detection, or video keyframes (frames array) for video tracking.',
      }),
    };
  }

  try {
    let body: any = {};
    if (event.body) {
      const rawPayload = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
      try {
        body = JSON.parse(rawPayload);
      } catch {
        // Fall back to animal handler which handles parsing error
      }
    }

    if (body && (Array.isArray(body.frames) || body.durationSec || body.videoUrl)) {
      return videoHandler(event, context);
    }

    return animalHandler(event, context);
  } catch (err: any) {
    return animalHandler(event, context);
  }
};
