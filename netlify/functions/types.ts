/**
 * Type declarations for Netlify Serverless Functions
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
