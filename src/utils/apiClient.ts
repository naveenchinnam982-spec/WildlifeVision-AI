/**
 * Safe API client utility for robust request/response handling.
 * Guaranteed to prevent "Unexpected token '<', '<!doctype ...' is not valid JSON" errors.
 */

export class ApiError extends Error {
  status: number;
  code: string;
  endpoint: string;
  contentType: string;

  constructor(
    message: string,
    status: number = 500,
    code: string = 'API_ERROR',
    endpoint: string = '',
    contentType: string = ''
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.endpoint = endpoint;
    this.contentType = contentType;
  }
}

/**
 * Strips HTML tags and extracts a clean, concise diagnostic message.
 */
function sanitizeHtmlError(html: string): string {
  // Try extracting title or pre tags
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }

  const h1Match = html.match(/<h1>([^<]+)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    return h1Match[1].trim();
  }

  const preMatch = html.match(/<pre>([^<]+)<\/pre>/i);
  if (preMatch && preMatch[1]) {
    return preMatch[1].trim().slice(0, 150);
  }

  // General tag strip
  const clean = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.slice(0, 150) || 'HTML error page';
}

export async function safeApiPost<T>(
  endpoint: string,
  body: unknown,
  signal?: AbortSignal,
  maxRetries: number = 3
): Promise<T> {
  let attempt = 0;

  while (true) {
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err; // Re-throw abort cleanly
      }
      if (attempt < maxRetries) {
        attempt++;
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      const msg = err instanceof Error ? err.message : 'Network connection failed.';
      throw new ApiError(
        `Unable to reach ${endpoint}: ${msg}. Please check your network connection or server status.`,
        0,
        'NETWORK_ERROR',
        endpoint
      );
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const rawText = await response.text();

    // If response is empty
    if (!rawText || rawText.trim().length === 0) {
      if (attempt < maxRetries && (response.status === 502 || response.status === 503 || response.status === 504)) {
        attempt++;
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw new ApiError(
        `Endpoint ${endpoint} returned an empty response (HTTP ${response.status}).`,
        response.status,
        'EMPTY_RESPONSE',
        endpoint,
        contentType
      );
    }

    // Check for HTML or non-JSON content
    if (
      !contentType.includes('application/json') ||
      rawText.trim().startsWith('<') ||
      rawText.trim().startsWith('<!doctype')
    ) {
      const diagnostic = sanitizeHtmlError(rawText);
      const isServerStarting =
        diagnostic.toLowerCase().includes('starting server') ||
        rawText.toLowerCase().includes('starting server') ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;

      if (attempt < maxRetries && isServerStarting) {
        attempt++;
        await new Promise((r) => setTimeout(r, 1800));
        continue;
      }

      // If server returned an HTML error page (e.g. 404 from a missing route or SPA fallback)
      let customMsg = `Server returned an HTML page instead of JSON (HTTP ${response.status} ${response.statusText} at ${endpoint}). Diagnostic: "${diagnostic}".`;
      if (response.status === 404) {
        customMsg = `Computer Vision API endpoint not found (HTTP 404 at ${endpoint}). When running on Netlify, please ensure netlify.toml and netlify/functions are deployed with GEMINI_API_KEY configured in environment variables.`;
      } else if (response.status === 502 || response.status === 503) {
        customMsg = `The backend service is temporarily unavailable (HTTP ${response.status}). Please try again in a few moments.`;
      }

      throw new ApiError(
        customMsg,
        response.status,
        response.status === 404 ? 'ENDPOINT_NOT_FOUND' : 'NON_JSON_RESPONSE',
        endpoint,
        contentType
      );
    }

    // Parse JSON safely
    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch (parseErr: unknown) {
      throw new ApiError(
        `Malformed JSON response from ${endpoint} (HTTP ${response.status}). Raw: "${rawText.slice(0, 100)}"`,
        response.status,
        'MALFORMED_JSON',
        endpoint,
        contentType
      );
    }

    // Check for HTTP errors or structured error response
    if (!response.ok || (json && json.success === false)) {
      const isRateLimit = response.status === 429 || json?.error?.code === 'RATE_LIMIT_EXCEEDED';
      const isTransientServiceError =
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504 ||
        json?.error?.retryable === true ||
        json?.error?.code === 'SERVICE_HIGH_DEMAND' ||
        (json?.error?.message && json.error.message.toLowerCase().includes('overloaded')) ||
        (json?.error?.message && json.error.message.toLowerCase().includes('high demand')) ||
        (json?.error?.message && json.error.message.toLowerCase().includes('temporarily unavailable'));

      // Retry transient rate-limit or overload errors with bounded backoff
      if (attempt < maxRetries && (isRateLimit || isTransientServiceError)) {
        attempt++;
        const retryAfterHeader = response.headers.get('retry-after');
        const parsedSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
        const delayMs = !isNaN(parsedSeconds) && parsedSeconds > 0 && parsedSeconds <= 12
          ? parsedSeconds * 1000
          : Math.min(6000, 1200 * Math.pow(1.8, attempt) + Math.random() * 400);

        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      const errorCode = json?.error?.code || `HTTP_${response.status}`;
      const errorMessage =
        json?.error?.message ||
        (typeof json?.error === 'string' ? json.error : null) ||
        json?.message ||
        `Request failed with HTTP status ${response.status} (${response.statusText || 'Error'}).`;

      throw new ApiError(errorMessage, response.status, errorCode, endpoint, contentType);
    }

    return json as T;
  }
}
