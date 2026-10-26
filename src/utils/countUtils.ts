import { AnimalDetection, SpeciesCount, IdentificationStatus } from '../types/wildlife';

export interface CountingResult {
  totalAnimals: number;
  distinctSpeciesCount: number;
  speciesCounts: SpeciesCount[];
  uncertainCount: number;
}

/**
 * Calculates authoritative species-wise counts and total count directly
 * from the validated, deduplicated animal detection records.
 */
export function calculateSpeciesCounts(detections: AnimalDetection[]): CountingResult {
  if (!detections || detections.length === 0) {
    return {
      totalAnimals: 0,
      distinctSpeciesCount: 0,
      speciesCounts: [],
      uncertainCount: 0,
    };
  }

  const map = new Map<
    string,
    {
      count: number;
      category?: string;
      status: IdentificationStatus;
      originalName: string;
    }
  >();

  let uncertainCount = 0;

  for (const det of detections) {
    const rawLabel = det.animalLabel.trim();
    // Normalize casing for grouping key, but preserve capitalized presentation
    const key = rawLabel.toLowerCase();
    const formattedName =
      rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

    if (det.identificationStatus === 'uncertain' || det.identificationStatus === 'unclassified') {
      uncertainCount++;
    }

    if (!map.has(key)) {
      map.set(key, {
        count: 1,
        category: det.category,
        status: det.identificationStatus,
        originalName: formattedName,
      });
    } else {
      const entry = map.get(key)!;
      entry.count += 1;
      // If one of the detections is uncertain or unclassified, mark status appropriately
      if (det.identificationStatus !== 'identified' && entry.status === 'identified') {
        entry.status = det.identificationStatus;
      }
    }
  }

  // Convert map to sorted array (highest count first)
  const speciesCounts: SpeciesCount[] = Array.from(map.values())
    .map((item) => ({
      animalLabel: item.originalName,
      category: item.category,
      count: item.count,
      status: item.status,
    }))
    .sort((a, b) => b.count - a.count);

  const totalAnimals = detections.length;
  const distinctSpeciesCount = speciesCounts.length;

  return {
    totalAnimals,
    distinctSpeciesCount,
    speciesCounts,
    uncertainCount,
  };
}
