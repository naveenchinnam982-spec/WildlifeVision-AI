/**
 * Generates realistic aerial wildlife drone scenes as Data URLs
 * for immediate one-click testing and demonstration.
 */

function createSavannaElephantsDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background savanna terrain
  const grad = ctx.createLinearGradient(0, 0, 1200, 800);
  grad.addColorStop(0, '#c2a665'); // arid savanna grass
  grad.addColorStop(0.5, '#ad9151');
  grad.addColorStop(1, '#8e7943');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 800);

  // Add terrain noise/grass tufts
  ctx.fillStyle = '#6e5e34';
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 1200;
    const y = Math.random() * 800;
    const r = 2 + Math.random() * 6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Waterhole / dried riverbed curve
  ctx.strokeStyle = '#5a7888';
  ctx.lineWidth = 45;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(100, 750);
  ctx.quadraticCurveTo(500, 680, 950, 780);
  ctx.stroke();

  // Draw 5 African Elephants with shadows from drone top-down perspective
  const elephants = [
    { x: 340, y: 320, size: 75, angle: 0.3 }, // Bull elephant
    { x: 480, y: 360, size: 68, angle: 0.4 }, // Matriarch
    { x: 620, y: 330, size: 60, angle: 0.25 }, // Young adult
    { x: 510, y: 470, size: 45, angle: 0.35 }, // Calf
    { x: 740, y: 390, size: 65, angle: 0.2 }, // Female
  ];

  elephants.forEach(({ x, y, size, angle }) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Drone sun shadow (offset)
    ctx.fillStyle = 'rgba(40, 35, 25, 0.45)';
    ctx.beginPath();
    ctx.ellipse(size * 0.4, size * 0.5, size * 0.7, size * 0.4, angle + 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body (aerial top-down oval)
    ctx.fillStyle = '#5c5b59';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.7, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#52514f';
    ctx.beginPath();
    ctx.ellipse(size * 0.6, 0, size * 0.32, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Large ears (prominent from drone view)
    ctx.fillStyle = '#636260';
    ctx.beginPath();
    ctx.ellipse(size * 0.45, -size * 0.38, size * 0.25, size * 0.18, -0.4, 0, Math.PI * 2);
    ctx.ellipse(size * 0.45, size * 0.38, size * 0.25, size * 0.18, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Trunk extended forward
    ctx.strokeStyle = '#4a4947';
    ctx.lineWidth = size * 0.15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.8, 0);
    ctx.quadraticCurveTo(size * 1.1, size * 0.1, size * 1.3, 0);
    ctx.stroke();

    ctx.restore();
  });

  // Drone telemetry watermark
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '14px monospace';
  ctx.fillText('AERIAL DRONE SURVEY [CAM-01] • ALT: 45m • SAVANNA TRANSECT 4', 30, 40);

  return canvas.toDataURL('image/jpeg', 0.92);
}

function createZebrasSavannaDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Grassland background
  const grad = ctx.createLinearGradient(0, 0, 1200, 800);
  grad.addColorStop(0, '#5a7a3b');
  grad.addColorStop(0.5, '#76964a');
  grad.addColorStop(1, '#8fa85c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 800);

  // Shrubs
  ctx.fillStyle = '#374f23';
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 1200;
    const y = Math.random() * 800;
    ctx.beginPath();
    ctx.arc(x, y, 6 + Math.random() * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6 Zebras grazing
  const zebras = [
    { x: 300, y: 280, angle: 0.6 },
    { x: 420, y: 340, angle: -0.2 },
    { x: 550, y: 260, angle: 0.8 },
    { x: 680, y: 390, angle: 0.3 },
    { x: 780, y: 440, angle: -0.5 },
    { x: 860, y: 310, angle: 0.1 },
  ];

  zebras.forEach(({ x, y, angle }) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Shadow
    ctx.fillStyle = 'rgba(30, 45, 20, 0.4)';
    ctx.beginPath();
    ctx.ellipse(25, 30, 45, 20, angle + 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.ellipse(0, 0, 45, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Black stripes
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 3.5;
    for (let s = -30; s <= 30; s += 9) {
      ctx.beginPath();
      ctx.moveTo(s, -18);
      ctx.lineTo(s + (s % 2 === 0 ? 3 : -3), 18);
      ctx.stroke();
    }

    // Neck & Head
    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.ellipse(45, 0, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(58, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '14px monospace';
  ctx.fillText('AERIAL DRONE SURVEY [CAM-02] • ALT: 35m • PLAINS RECONNAISSANCE', 30, 40);

  return canvas.toDataURL('image/jpeg', 0.92);
}

function createForestDeerDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Forest canopy and clearing
  ctx.fillStyle = '#2d4a22';
  ctx.fillRect(0, 0, 1200, 800);

  // Clearing patch
  ctx.fillStyle = '#556b2f';
  ctx.beginPath();
  ctx.ellipse(600, 400, 450, 280, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Surrounding trees
  ctx.fillStyle = '#1a3314';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() > 0.5 ? Math.random() * 250 : 950 + Math.random() * 250;
    const y = Math.random() * 800;
    ctx.beginPath();
    ctx.arc(x, y, 40 + Math.random() * 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4 Deer in clearing
  const deers = [
    { x: 450, y: 350, angle: 0.1, buck: true },
    { x: 570, y: 430, angle: -0.4, buck: false },
    { x: 720, y: 380, angle: 0.5, buck: false },
    { x: 620, y: 290, angle: -0.2, buck: false },
  ];

  deers.forEach(({ x, y, angle, buck }) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Shadow
    ctx.fillStyle = 'rgba(20, 30, 15, 0.45)';
    ctx.beginPath();
    ctx.ellipse(15, 22, 35, 16, angle + 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#965a25';
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#854b1d';
    ctx.beginPath();
    ctx.ellipse(38, 0, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // White tail patch
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(-36, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    // Antlers if buck
    if (buck) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(44, -6);
      ctx.lineTo(54, -20);
      ctx.lineTo(60, -26);
      ctx.moveTo(50, -14);
      ctx.lineTo(58, -12);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(44, 6);
      ctx.lineTo(54, 20);
      ctx.lineTo(60, 26);
      ctx.moveTo(50, 14);
      ctx.lineTo(58, 12);
      ctx.stroke();
    }

    ctx.restore();
  });

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '14px monospace';
  ctx.fillText('AERIAL DRONE SURVEY [CAM-03] • ALT: 40m • TEMPERATE FOREST CLEARING', 30, 40);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export interface DroneSamplePreset {
  id: string;
  name: string;
  description: string;
  animalType: string;
  expectedCount: string;
  getDataUrl: () => string;
  gps: {
    latitude: number;
    longitude: number;
    altitudeMeters: number;
    locationName: string;
    source: 'preset';
    missionId: string;
    habitatType: string;
  };
}

export const DRONE_SAMPLE_PRESETS: DroneSamplePreset[] = [
  {
    id: 'elephants-savanna',
    name: 'Savanna Elephant Herd',
    description: 'Aerial drone transect tracking an African elephant family herd near a dry riverbed.',
    animalType: 'Elephant',
    expectedCount: '5 Elephants',
    getDataUrl: createSavannaElephantsDataUrl,
    gps: {
      latitude: -1.5034,
      longitude: 35.1432,
      altitudeMeters: 48,
      locationName: 'Maasai Mara National Reserve, Kenya',
      source: 'preset',
      missionId: 'TRX-KENYA-04',
      habitatType: 'Savanna Grassland',
    },
  },
  {
    id: 'zebras-plains',
    name: 'Plains Zebra Cluster',
    description: 'Top-down drone capture of grazing plains zebras with distinct stripe patterns.',
    animalType: 'Zebra',
    expectedCount: '6 Zebras',
    getDataUrl: createZebrasSavannaDataUrl,
    gps: {
      latitude: -24.0116,
      longitude: 31.4853,
      altitudeMeters: 42,
      locationName: 'Kruger National Park, South Africa',
      source: 'preset',
      missionId: 'TRX-KRUGER-09',
      habitatType: 'Open Woodland Plains',
    },
  },
  {
    id: 'deer-clearing',
    name: 'Forest Deer Family',
    description: 'Overhead forest clearing view showing white-tailed deer including antlered buck.',
    animalType: 'Deer',
    expectedCount: '4 Deer',
    getDataUrl: createForestDeerDataUrl,
    gps: {
      latitude: 38.4755,
      longitude: -78.4535,
      altitudeMeters: 36,
      locationName: 'Shenandoah National Park, Virginia, USA',
      source: 'preset',
      missionId: 'TRX-APPALACH-02',
      habitatType: 'Temperate Deciduous Forest',
    },
  },
];
