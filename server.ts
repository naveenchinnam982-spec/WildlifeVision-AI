import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import analyzeRouter, { surveyHistory } from './server/api/analyze.js';
import videoAnalyzeRouter from './server/api/videoAnalyze.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Increase body parser limits for high-resolution aerial drone images
app.use(express.json({ limit: '40mb' }));
app.use(express.urlencoded({ extended: true, limit: '40mb' }));

// Middleware to catch body-parser errors (JSON syntax, payload too large) and ensure JSON response
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err) {
    console.error('Body parser error:', err);
    res.status(err.status || 400).json({
      success: false,
      error: {
        code: err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'INVALID_REQUEST_BODY',
        message: err.message || 'Error parsing incoming request body.',
      },
    });
    return;
  }
  next();
});

// API key presence check for client configuration
const apiKey = process.env.GEMINI_API_KEY;

import { historyStore } from './server/storage/historyStore.js';

// Health & configuration check
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    hasApiKey: Boolean(apiKey && apiKey.trim().length > 0),
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    fallbackModel: 'gemini-flash-latest',
    thinkingLevel: 'LOW',
    maxUploadSizeMb: 25,
    timestamp: new Date().toISOString(),
  });
});

// List drone survey history permanently saved on disk
app.get('/api/history', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: historyStore.getAll(),
  });
});

// Delete specific survey from permanent history
app.delete('/api/history/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const removed = historyStore.remove(id);
  if (removed) {
    res.json({ success: true, message: `Record ${id} removed` });
  } else {
    res.status(404).json({
      success: false,
      error: {
        code: 'RECORD_NOT_FOUND',
        message: `Survey record ${id} not found.`,
      },
    });
  }
});

// Update GPS coordinates and metadata on specific survey
app.patch('/api/history/:id/gps', (req: Request, res: Response) => {
  const { id } = req.params;
  const { gps, droneMetadata } = req.body || {};
  const updated = historyStore.updateGps(id, gps, droneMetadata);
  if (!updated) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'RECORD_NOT_FOUND',
        message: `Survey record ${id} not found.`,
      },
    });
  }
  res.json({ success: true, data: updated });
});

// Clear all history permanently
app.post('/api/history/clear', (_req: Request, res: Response) => {
  historyStore.clear();
  res.json({ success: true, message: 'All analysis history cleared' });
});

// Dedicated Wildlife Computer Vision Inference Route (server/api/analyze.js)
app.use(analyzeRouter);

// Dedicated Wildlife Video Analysis & Multi-Object Tracking Route (server/api/videoAnalyze.js)
app.use(videoAnalyzeRouter);


// Explicit 404 handler for ALL unmatched /api/* routes so they NEVER fall through to Vite SPA
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'API_ENDPOINT_NOT_FOUND',
      message: `API endpoint ${req.method} ${req.originalUrl} not found.`,
    },
  });
});

// Global Express error handler for API
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An internal server error occurred.',
      },
    });
    return;
  }
  next(err);
});

// Setup Vite middleware in dev or static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`WildlifeVision AI Server listening on port ${port}`);
});

