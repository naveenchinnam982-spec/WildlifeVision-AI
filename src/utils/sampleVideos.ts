/**
 * Realistic synthetic drone wildlife video generators for instant testing.
 * Uses HTML5 Canvas + MediaRecorder to record smooth, realistic drone footage in-browser.
 */

export interface SampleVideoPreset {
  id: string;
  title: string;
  description: string;
  expectedSpecies: string[];
  expectedTrackCount: number;
  durationSec: number;
  width: number;
  height: number;
  generateBlob: () => Promise<Blob>;
  gps?: {
    latitude: number;
    longitude: number;
    altitudeMeters: number;
    locationName: string;
    source: 'preset';
    missionId: string;
    habitatType: string;
  };
}

/**
 * Draws a top-down aerial elephant on canvas
 */
function drawElephant(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Shadow
  ctx.fillStyle = 'rgba(30, 25, 20, 0.4)';
  ctx.beginPath();
  ctx.ellipse(size * 0.4, size * 0.4, size * 0.65, size * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torso
  ctx.fillStyle = '#686054';
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.6, size * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#564e43';
  ctx.beginPath();
  ctx.arc(size * 0.52, 0, size * 0.24, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#60584c';
  ctx.beginPath();
  ctx.ellipse(size * 0.46, -size * 0.28, size * 0.2, size * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.46, size * 0.28, size * 0.2, size * 0.12, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Trunk
  ctx.strokeStyle = '#50483c';
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.68, 0);
  ctx.quadraticCurveTo(size * 0.9, size * 0.1, size * 1.05, -size * 0.05);
  ctx.stroke();

  // Tusks
  ctx.strokeStyle = '#f5efe0';
  ctx.lineWidth = size * 0.04;
  ctx.beginPath();
  ctx.moveTo(size * 0.65, -size * 0.08);
  ctx.lineTo(size * 0.82, -size * 0.12);
  ctx.moveTo(size * 0.65, size * 0.08);
  ctx.lineTo(size * 0.82, size * 0.12);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws a top-down aerial zebra on canvas
 */
function drawZebra(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Shadow
  ctx.fillStyle = 'rgba(20, 20, 20, 0.35)';
  ctx.beginPath();
  ctx.ellipse(size * 0.3, size * 0.35, size * 0.55, size * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = '#222222';
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.5, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stripes (white on black)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.05;
  for (let i = -size * 0.35; i <= size * 0.35; i += size * 0.12) {
    ctx.beginPath();
    ctx.moveTo(i, -size * 0.18);
    ctx.lineTo(i + 2, size * 0.18);
    ctx.stroke();
  }

  // Neck & Head
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(size * 0.45, 0, size * 0.18, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Muzzle
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(size * 0.6, 0, size * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Generates an African Savanna drone video featuring 3 walking African Elephants
 */
async function generateElephantsDroneVideo(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const width = 960;
  const height = 540;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const stream = canvas.captureStream(25);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const fps = 25;
  const totalFrames = 80; // ~3.2 seconds
  let frame = 0;

  return new Promise((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };

    recorder.start();

    const interval = setInterval(() => {
      const progress = frame / totalFrames;

      // Savanna background moving slowly with drone camera motion
      const camX = progress * 40;
      const camY = progress * 20;

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#be9b5a');
      grad.addColorStop(0.5, '#ab8949');
      grad.addColorStop(1, '#97793d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Waterhole curve
      ctx.strokeStyle = '#4e7084';
      ctx.lineWidth = 36;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(80 - camX, 480 - camY);
      ctx.quadraticCurveTo(450 - camX, 410 - camY, 880 - camX, 490 - camY);
      ctx.stroke();

      // Bush / foliage dots
      ctx.fillStyle = '#655428';
      for (let i = 0; i < 30; i++) {
        const bx = (i * 37) % width;
        const by = (i * 73) % height;
        ctx.beginPath();
        ctx.arc(bx - camX * 0.5, by - camY * 0.5, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3 African Elephants moving naturally
      // Elephant 1 (Matriarch leading)
      drawElephant(
        ctx,
        320 + progress * 90 - camX,
        220 + progress * 25 - camY,
        58,
        0.28 + Math.sin(progress * 8) * 0.04
      );

      // Elephant 2 (Follower)
      drawElephant(
        ctx,
        480 + progress * 85 - camX,
        270 + progress * 22 - camY,
        52,
        0.26 + Math.cos(progress * 8) * 0.04
      );

      // Elephant 3 (Calf walking closely)
      drawElephant(
        ctx,
        410 + progress * 80 - camX,
        350 + progress * 20 - camY,
        38,
        0.25 + Math.sin(progress * 10) * 0.05
      );

      // HUD drone telemetry overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '11px monospace';
      ctx.fillText(`ALT: 42m | HDG: 074° | CAM: 4K OPTICAL | TIME: ${(frame / fps).toFixed(1)}s`, 20, 30);

      frame++;
      if (frame >= totalFrames) {
        clearInterval(interval);
        recorder.stop();
      }
    }, 1000 / fps);
  });
}

/**
 * Generates Serengeti Plains drone flight featuring 3 Zebras and 1 Lion
 */
async function generateSerengetiZebraLionVideo(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const width = 960;
  const height = 540;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const stream = canvas.captureStream(25);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const fps = 25;
  const totalFrames = 80; // ~3.2 seconds
  let frame = 0;

  return new Promise((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };

    recorder.start();

    const interval = setInterval(() => {
      const progress = frame / totalFrames;

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#caa362');
      grad.addColorStop(1, '#9f7e41');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw 3 Zebras running in a formation
      drawZebra(
        ctx,
        280 + progress * 140,
        210 + Math.sin(progress * 6) * 15,
        46,
        0.05 + Math.sin(progress * 12) * 0.05
      );

      drawZebra(
        ctx,
        380 + progress * 135,
        270 + Math.cos(progress * 6) * 12,
        44,
        0.04 + Math.cos(progress * 12) * 0.05
      );

      drawZebra(
        ctx,
        220 + progress * 142,
        310 + Math.sin(progress * 6) * 10,
        42,
        0.06 + Math.sin(progress * 12) * 0.05
      );

      // Draw 1 Lion watching from near an acacia tree
      // Acacia tree shadow & canopy
      ctx.fillStyle = 'rgba(40, 35, 20, 0.5)';
      ctx.beginPath();
      ctx.ellipse(750, 180, 55, 35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lion (tawny predator silhouette)
      ctx.save();
      ctx.translate(680, 220);
      ctx.fillStyle = '#b8860b'; // golden tawny
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 14, 0.4, 0, Math.PI * 2);
      ctx.fill();
      // Lion mane & head
      ctx.fillStyle = '#8b5a00';
      ctx.beginPath();
      ctx.arc(18, 5, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Telemetry
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '11px monospace';
      ctx.fillText(`TRANSECT: SERENGETI-B | SPEED: 14 m/s | TIME: ${(frame / fps).toFixed(1)}s`, 20, 30);

      frame++;
      if (frame >= totalFrames) {
        clearInterval(interval);
        recorder.stop();
      }
    }, 1000 / fps);
  });
}

export const SAMPLE_VIDEO_PRESETS: SampleVideoPreset[] = [
  {
    id: 'elephants_transect',
    title: 'Savanna Elephants Transect',
    description: 'Autonomous drone flight tracking 3 African Elephants moving along a riverbed.',
    expectedSpecies: ['African Elephant'],
    expectedTrackCount: 3,
    durationSec: 3.2,
    width: 960,
    height: 540,
    generateBlob: generateElephantsDroneVideo,
    gps: {
      latitude: -2.7667,
      longitude: 38.4667,
      altitudeMeters: 55,
      locationName: 'Tsavo East National Park, Kenya',
      source: 'preset',
      missionId: 'VID-TSAVO-01',
      habitatType: 'Semi-Arid Bushland & Riverbed',
    },
  },
  {
    id: 'serengeti_zebras_lion',
    title: 'Serengeti Plains Migration',
    description: 'Aerial survey tracking 3 Plains Zebras galloping and 1 Lion resting nearby.',
    expectedSpecies: ['Plains Zebra', 'Lion'],
    expectedTrackCount: 4,
    durationSec: 3.2,
    width: 960,
    height: 540,
    generateBlob: generateSerengetiZebraLionVideo,
    gps: {
      latitude: -2.3333,
      longitude: 34.8333,
      altitudeMeters: 45,
      locationName: 'Serengeti Ecosystem Corridor, Tanzania',
      source: 'preset',
      missionId: 'VID-SERENGETI-02',
      habitatType: 'Open Savanna Grasslands',
    },
  },
];
