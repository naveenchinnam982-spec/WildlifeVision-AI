# WildlifeVision AI — Drone-Based Wildlife Monitoring & Animal Detection System

WildlifeVision AI is a computer vision and aerial wildlife monitoring platform designed for conservation biologists, ecological researchers, and drone survey teams. The system analyzes aerial photographs captured by Unmanned Aerial Vehicles (UAVs) to localize animals, identify wildlife species, count individual specimens, draw high-contrast bounding boxes, and export audit-ready PDF and CSV census reports.

---

## 🌟 Key Features

1. **Multimodal AI Wildlife Detection Pipeline**
   - Powered by Gemini 3.8 Flash (`gemini-3.8-flash`) via the official `@google/genai` TypeScript SDK on a secure server-side proxy route.
   - Strictly localized bounding boxes on a normalized 0–1000 coordinate scale.
   - Visual species identification (Elephants, Zebras, Deer, Lions, Giraffes, Birds, Canines, etc.) or defensible higher-taxon categories (`Deer family`, `Canine`, `Unknown animal`).
   - Rejects hallucinated detections; reports "No animals detected" when none are visible.

2. **Computer Vision & Deduplication Layer**
   - Class-aware Non-Maximum Suppression (IoU ≥ 0.60 threshold) prevents double-counting overlapping proposals of the same animal.
   - Coordinate bounding box sanitization, dimension inversion repairs, and boundary clamping.
   - Authoritative census counts calculated directly from validated detection records.

3. **Interactive Drone Canvas & Annotations**
   - Responsive HTML5 Canvas rendering preserving drone camera aspect ratios.
   - Distinguishable species color coding and corner-accent target reticles.
   - Dynamic toggles for bounding boxes, species labels, and confidence percentages.
   - Zoom controls (70%–220%) and click-to-highlight animal inspection.
   - 1-click High-Resolution Annotated PNG export.

4. **Multi-Format Report Generation**
   - **Downloadable PDF Report**: Generated client-side using `jsPDF` with mission telemetry, embedded annotated aerial photos, census tables, and AI limitations.
   - **Detailed CSV Log**: Individual records with `[analysis_id, detection_id, animal_label, category, confidence, status, x_min, y_min, x_max, y_max]`.
   - **Species Summary CSV**: Taxonomic counts and review flags.
   - **Print-Ready Styles**: Formatted print layout.

5. **Mission Archives & Drone Ethics**
   - Archived drone survey records with thumbnail previews and search filters.
   - Field guidelines on non-disturbance flight altitudes (AGL), acoustic footprints, and IUCN/FAA survey ethics.

---

## 🏗️ Project Architecture

```
├── index.html                   # HTML entry point with synchronized SEO metadata
├── metadata.json                # AI Studio app capabilities & metadata
├── package.json                 # Dependencies & full-stack scripts
├── server.ts                    # Full-stack Express server + Gemini CV pipeline
├── src/
│   ├── App.tsx                  # Main application state & routing
│   ├── main.tsx                 # React DOM root
│   ├── index.css                # Tailwind CSS styling
│   ├── types/
│   │   └── wildlife.ts          # TypeScript interfaces & Zod validation schemas
│   ├── utils/
│   │   ├── coordinateUtils.ts   # Normalized coordinate math, IoU, and NMS
│   │   ├── countUtils.ts        # Species census aggregations & totals
│   │   ├── colorPalette.ts      # Contrast-optimized species palette
│   │   ├── reportUtils.ts       # jsPDF report generation & CSV exports
│   │   └── sampleImages.ts      # Aerial drone presets (Elephants, Zebras, Deer)
│   ├── components/
│   │   ├── Header.tsx           # Top navigation & system status
│   │   ├── Sidebar.tsx          # Collapsible drone mission sidebar
│   │   ├── DashboardOverview.tsx# Statistics, charts, and mission overview
│   │   ├── ImageUploader.tsx    # Drag-and-drop uploader with sample presets
│   │   ├── AnnotatedCanvas.tsx  # Interactive canvas bounding box overlay
│   │   ├── DetectionResults.tsx # Detailed detection logs & export actions
│   │   ├── HistoryView.tsx      # Past mission archive with search & filter
│   │   └── SettingsView.tsx     # Confidence threshold, box style, and drone ethics
│   └── tests/
│       ├── wildlife.test.ts     # Core unit tests for coordinates, IoU, counting
│       └── runTests.ts          # Test runner script
└── tsconfig.json                # TypeScript bundler configuration
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Node.js 20+
- A valid Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### Environment Configuration

Set the API key in your `.env` file or AI Studio Secrets panel:

```bash
GEMINI_API_KEY="your-gemini-api-key-here"
```

### Installation

```bash
npm install
```

### Development Server

Start the full-stack server (runs Express + Vite middleware on port 3000):

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Run Automated Unit Tests

```bash
npm test
```

### Production Build

```bash
npm run build
npm start
```

---

## 🛡️ Drone Wildlife Survey Ethics

- **Minimum Flight Altitude:** Maintain at least 30 to 50 meters Above Ground Level (AGL) for large mammals to prevent acoustic or behavioral disturbance.
- **Flight Trajectory:** Fly steady, systematic transect paths; never chase, dive-bomb, or hover low directly over nesting sites or animal herds.
- **Biologist Review:** Confidence scores are model estimates. Detections flagged as "Needs Review" should be checked against ground-truth census data.
