import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import analyzeRouter, { surveyHistory, handleAnalyzeAnimal } from './server/api/analyze.js';
import videoAnalyzeRouter, { handleAnalyzeVideo } from './server/api/videoAnalyze.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Increase body parser limits for high-resolution aerial drone images and multi-frame video keyframes
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

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
import { historyStore } from './server/storage/historyStore.js';

// Health & configuration check
app.get('/api/config', (_req: Request, res: Response) => {
  const currentKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.API_KEY ||
    ''
  ).trim().replace(/^["']|["']$/g, '').trim();

  res.json({
    success: true,
    hasApiKey: Boolean(currentKey && currentKey.length > 0),
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    fallbackModel: 'gemini-3.5-flash',
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

// Universal Smart AI Inference Route (/api/analyze)
// Automatically dispatches to video tracking if frames are provided, or animal detection if single image
app.post(['/api/analyze', '/analyze'], (req: Request, res: Response) => {
  if (req.body && (Array.isArray(req.body.frames) || req.body.durationSec || req.body.videoUrl)) {
    return handleAnalyzeVideo(req, res);
  }
  return handleAnalyzeAnimal(req, res);
});

app.get(['/api/analyze', '/analyze'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    success: true,
    service: 'WildlifeVision AI Universal Inference Engine',
    endpoint: req.originalUrl,
    description: 'POST image payload (imageDataUrl) for photo detection, or video keyframes (frames array) for video tracking.',
  });
});

// Dedicated Wildlife Computer Vision Inference Route (server/api/analyze.js)
app.use(analyzeRouter);

// Dedicated Wildlife Video Analysis & Multi-Object Tracking Route (server/api/videoAnalyze.js)
app.use(videoAnalyzeRouter);

// Direct route registrations on app to ensure zero 404s regardless of routing middleware resolution
const videoRoutes = [
  '/api/analyze-video',
  '/api/video-analyze',
  '/api/analyze/video',
  '/api/video/analyze',
  '/api/video-analysis',
  '/api/video',
  '/api/videos',
  '/analyze-video',
  '/video-analyze',
];
videoRoutes.forEach((route) => {
  app.post(route, handleAnalyzeVideo);
});

const imageRoutes = [
  '/api/analyze-animal',
  '/api/analyze-image',
  '/api/image-analyze',
  '/api/analyze/image',
  '/api/image',
  '/analyze-animal',
  '/analyze-image',
  '/image-analyze',
];
imageRoutes.forEach((route) => {
  app.post(route, handleAnalyzeAnimal);
});

// Download Complete Project ZIP package
app.get(['/wildlifevision-ai.zip', '/api/download-zip', '/download'], (_req: Request, res: Response) => {
  const publicZip = path.resolve(__dirname, 'public', 'wildlifevision-ai.zip');
  const rootZip = path.resolve(__dirname, 'wildlifevision-ai.zip');
  const targetPath = fs.existsSync(publicZip) ? publicZip : fs.existsSync(rootZip) ? rootZip : null;

  if (targetPath) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="wildlifevision-ai.zip"');
    return res.sendFile(targetPath);
  }
  res.status(404).json({
    success: false,
    error: {
      code: 'ZIP_NOT_FOUND',
      message: 'Project ZIP package is being prepared. Please try again shortly.',
    },
  });
});

// Explicit 404 handler for ALL unmatched /api/* routes so they NEVER fall through to Vite SPA
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'API_ENDPOINT_NOT_FOUND',
      message: `API endpoint ${req.method} ${req.originalUrl} not found. Available endpoints: POST /api/analyze-animal (aerial images), POST /api/analyze-video (video transects), POST /api/analyze (universal).`,
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

