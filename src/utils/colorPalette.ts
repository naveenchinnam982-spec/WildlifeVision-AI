// Distinctive palette for wildlife species bounding boxes and badges
export const SPECIES_PALETTE = [
  { stroke: '#10B981', fill: 'rgba(16, 185, 129, 0.18)', text: '#065F46', name: 'Emerald' },
  { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.18)', text: '#92400E', name: 'Amber' },
  { stroke: '#3B82F6', fill: 'rgba(59, 130, 246, 0.18)', text: '#1E40AF', name: 'Blue' },
  { stroke: '#EC4899', fill: 'rgba(236, 72, 153, 0.18)', text: '#9D174D', name: 'Pink' },
  { stroke: '#8B5CF6', fill: 'rgba(139, 92, 246, 0.18)', text: '#5B21B6', name: 'Purple' },
  { stroke: '#14B8A6', fill: 'rgba(20, 184, 166, 0.18)', text: '#115E59', name: 'Teal' },
  { stroke: '#F97316', fill: 'rgba(249, 115, 22, 0.18)', text: '#9A3412', name: 'Orange' },
  { stroke: '#06B6D4', fill: 'rgba(6, 182, 212, 0.18)', text: '#155E75', name: 'Cyan' },
  { stroke: '#84CC16', fill: 'rgba(132, 204, 22, 0.18)', text: '#3F6212', name: 'Lime' },
  { stroke: '#E11D48', fill: 'rgba(225, 29, 72, 0.18)', text: '#881337', name: 'Rose' },
];

/**
 * Returns a stable color configuration for a given species name.
 */
export function getSpeciesColor(speciesName: string): {
  stroke: string;
  fill: string;
  text: string;
  name: string;
} {
  if (!speciesName) return SPECIES_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < speciesName.length; i++) {
    hash = (hash << 5) - hash + speciesName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % SPECIES_PALETTE.length;
  return SPECIES_PALETTE[index];
}
