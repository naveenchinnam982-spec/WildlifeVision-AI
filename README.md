# 🛰️ WildlifeVision AI — Drone-Based Wildlife Monitoring & Animal Detection System

WildlifeVision AI is an end-to-end aerial computer vision and wildlife census platform engineered for conservation biologists, wildlife rangers, ecological researchers, and drone flight survey crews. The system ingests high-resolution aerial photographs and flight video transects captured by Unmanned Aerial Vehicles (UAVs) to localize animals, identify wildlife species, count individual specimens without double-counting, generate interactive geospatial GIS maps, and export audit-ready PDF and CSV census reports.

---

## 🌟 Key Features

### 1. Multimodal Aerial Computer Vision Pipeline
- **Gemini Multimodal Inference**: Powered by Google Gemini 3.8 Flash (`gemini-3.8-flash`) via the official `@google/genai` TypeScript SDK on a hardened server-side proxy route.
- **Strict Normalized Coordinates**: Precision bounding boxes mapped to a normalized `[0, 1000]` coordinate grid, automatically scaled to any drone sensor aspect ratio.
- **Taxonomic Species Classification**: Identifies wildlife species (African Elephant, Plains Zebra, Lion, White-tailed Deer, Giraffe, Water Buffalo, Birds) with fallback to defensible higher-order taxons.
- **Zero-Hallucination Guardrails**: Distinguishes natural landscape features (rocks, tree trunks, shadows) from actual animals and outputs clean zero-count states when no wildlife is present.

### 2. Fast Video Analysis & Multi-Object Tracking (MOT)
- **2–3x Optimized Sampling Pipeline**: Adaptive frame sampling (2–5 FPS) with keyframe motion scoring to avoid redundant processing.
- **Spatial Multi-Object Tracking**: Maintains persistent animal track IDs across sampled frames using IoU overlap and Hungarian association.
- **True Unique Animal Counting**: Counts each individual animal exactly once per video survey instead of multiplying counts per frame.
- **Temporary Occlusion Recovery**: Gracefully recovers track continuity when animals pass behind foliage, trees, or terrain obstacles.

### 3. Interactive Geospatial GIS Forest Map
- **Interactive Leaflet Cartography**: High-contrast satellite and topographic map rendering with drone flight transects.
- **Geotagged Sighting Clusters**: Live markers color-coded by species with specimen breakdown popups.
- **Haversine Distance Telemetry**: Calculates ecological corridor ranges, flight transect lengths, and survey territory coverage.

### 4. Interactive Annotation Canvas
- **Aspect-Preserving Drone Canvas**: Custom HTML5 Canvas rendering engine supporting 4K drone imagery with zero aspect distortion.
- **Inspection HUD**: Corner-accent reticles, confidence indicators, and interactive click-to-highlight animal inspection.
- **1-Click High-Res PNG Export**: Exports annotated aerial photos with bounding boxes burned directly into pixel layers.

### 5. Multi-Format Census Export & Permanent Storage
- **Audit-Ready PDF Reports**: Generated with `jsPDF` including flight telemetry, embedded annotated aerial photos, census distribution tables, and biological review flags.
- **Granular CSV Exports**: Individual detection logs (`[survey_id, detection_id, species, confidence, bbox]`) and aggregated species census summaries.
- **Durable History Store**: Permanent survey storage backed by JSON file persistence with GPS patching and search filtering.

---

## 🧰 Technologies Used

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Leaflet GIS.
- **Backend**: Node.js 20+, Express.js, `@google/genai` SDK, `dotenv`.
- **Build System**: Vite 6, `tsx` (TypeScript execution runtime), ES Modules.
- **Reporting & Visualization**: `jsPDF` (vector PDF engine), HTML5 Canvas.
- **PWA & Mobile**: `vite-plugin-pwa` with offline caching and mobile web-app manifest.

---

## 📋 Prerequisites

- **Node.js**: Version 18.0.0 or higher (Node.js 20+ or 22+ recommended).
- **Package Manager**: `npm` (comes with Node.js) or `bun` / `pnpm` / `yarn`.
- **Google Gemini API Key**: Free API key from [Google AI Studio](https://aistudio.google.com/).

---

## ⚙️ Environment Variables

Copy the provided `.env.example` file to create your local `.env`:

```bash
cp .env.example .env
```

| Variable Name | Required | Default Value | Description |
| :--- | :---: | :---: | :--- |
| `GEMINI_API_KEY` | **Yes** | `your_gemini_api_key_here` | Your Google Gemini API Key from Google AI Studio. |
| `PORT` | No | `3000` | Local port for Express & Vite dev server. |
| `NODE_ENV` | No | `development` | Environment mode (`development` or `production`). |
| `GEMINI_MODEL` | No | `gemini-3.8-flash` | Gemini model ID used for visual detection. |
| `APP_URL` | No | `http://localhost:3000` | Application root URL. |

---

## 🚀 How to Run Locally

### 1. Extract & Navigate to the Project

```bash
unzip wildlifevision-ai.zip -d wildlifevision-ai
cd wildlifevision-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Your Environment

```bash
# Open .env and insert your GEMINI_API_KEY
cp .env.example .env
```

### 4. Start the Full-Stack Development Server

```bash
npm run dev
```

The application will start on **`http://localhost:3000`**. The Express backend and Vite frontend hot-reload automatically.

### 5. Run Automated Unit & Integration Tests

The project includes an automated test suite (99 unit & integration tests) verifying coordinate math, IoU deduplication, species aggregation, multi-object video tracking, geospatial math, and storage persistence:

```bash
npm test
```

---

## 📦 How to Build for Production

To create an optimized production build:

```bash
# 1. Compile TypeScript and bundle frontend assets into /dist
npm run build

# 2. Start the production Node.js Express server
npm start
```

The production server serves pre-compiled static assets from `dist/` with high-performance gzip/brotli compression and handles all `/api/*` endpoints.

---

## 🚢 Deployment Instructions

### Option 1: Netlify (Serverless Full-Stack Deployment)

WildlifeVision AI includes full Netlify support out-of-the-box via `netlify.toml` and Netlify Serverless Functions in `netlify/functions/`.

1. **Deploy Settings in Netlify**:
   - **Base directory**: `/` (or leave empty)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`

2. **Required Environment Variable**:
   Go to **Netlify Dashboard > Site Configuration > Environment Variables** and add:
   - `GEMINI_API_KEY`: Your Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/)
   - `GEMINI_MODEL`: (Optional) `gemini-3.8-flash` or `gemini-3.1-flash-lite`

3. **How Routing Works on Netlify**:
   - `POST /api/analyze-animal` is automatically routed to `/.netlify/functions/analyze-animal` via `netlify.toml` and `dist/_redirects`.
   - `POST /api/analyze-video` is routed to `/.netlify/functions/analyze-video`.
   - `POST /api/analyze` is routed to `/.netlify/functions/analyze-universal`.
   - `GET /api/config` is routed to `/.netlify/functions/config`.
   - All SPA page navigation routes (`/*`) fall back to `dist/index.html` with HTTP 200 without blocking API requests.

4. **Verify Deployment**:
   After Netlify finishes deploying:
   - Open `https://<your-site>.netlify.app/api/config` in your browser. You will see JSON confirmation: `{"success":true,"hasApiKey":true,...}`.
   - Upload any wildlife photo on the live site — analysis completes with precision bounding boxes and census counts!

### Option 2: Google Cloud Run

1. Ensure the `Dockerfile` or Cloud Build pack is configured.
2. Build and deploy:
   ```bash
   gcloud run deploy wildlifevision-ai \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars GEMINI_API_KEY="your-api-key",NODE_ENV="production"
   ```

### Option 3: Docker Container

Create a container image:

```bash
docker build -t wildlifevision-ai .
docker run -p 3000:3000 -e GEMINI_API_KEY="your-api-key" wildlifevision-ai
```

### Option 4: VPS / Linux Server (Ubuntu/Debian)

```bash
# Install Node.js 20 and PM2
sudo apt update && sudo apt install -y nodejs npm
sudo npm install -g pm2

# Clone or extract project
cd /var/www/wildlifevision-ai
npm install
npm run build

# Start with PM2 process manager
pm2 start server.ts --name "wildlifevision-ai" --interpreter tsx
pm2 save
```

---

## 🛡️ Drone Wildlife Survey Ethics Protocol

- **Flight Altitude (AGL)**: Maintain at least 30 to 50 meters Above Ground Level (AGL) for large mammals to prevent behavioral agitation or herd stampedes.
- **Acoustic Footprint**: Fly smooth, systematic transect flight lines; avoid stationary hovering directly over herds or nesting sites.
- **Biologist Verification**: High-stakes conservation decisions should corroborate AI model detections with ground-truth field data.

---

## 📄 License

Academic and Environmental Open Access — Free for conservation research, wildlife protection, and ecological monitoring.
