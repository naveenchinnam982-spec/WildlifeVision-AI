import { jsPDF } from 'jspdf';
import { AnalysisResult, VideoAnalysisResult } from '../types/wildlife';

/**
 * Downloads detailed detection records as a CSV file.
 */
export function downloadDetailedCsv(analysis: AnalysisResult): void {
  const headers = [
    'analysis_id',
    'detection_id',
    'animal_label',
    'category',
    'confidence',
    'status',
    'x_min',
    'y_min',
    'x_max',
    'y_max',
    'timestamp',
  ];

  const rows = analysis.detections.map((det) => [
    `"${analysis.analysisId}"`,
    `"${det.detectionId}"`,
    `"${det.animalLabel}"`,
    `"${det.category}"`,
    (det.confidence * 100).toFixed(1) + '%',
    `"${det.identificationStatus}"`,
    det.boundingBox.xMin,
    det.boundingBox.yMin,
    det.boundingBox.xMax,
    det.boundingBox.yMax,
    `"${analysis.timestamp}"`,
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `wildlife_detections_${analysis.analysisId}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads species-wise count summary as a CSV file.
 */
export function downloadSpeciesSummaryCsv(analysis: AnalysisResult): void {
  const headers = [
    'analysis_id',
    'animal_label',
    'category',
    'count',
    'identification_status',
    'timestamp',
  ];

  const rows = analysis.speciesCounts.map((sc) => [
    `"${analysis.analysisId}"`,
    `"${sc.animalLabel}"`,
    `"${sc.category || 'Wildlife'}"`,
    sc.count,
    `"${sc.status}"`,
    `"${analysis.timestamp}"`,
  ]);

  // Append total row
  rows.push([
    `"${analysis.analysisId}"`,
    '"TOTAL ANIMALS"',
    '"ALL"',
    analysis.totalAnimals,
    '"COMPLETED"',
    `"${analysis.timestamp}"`,
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `wildlife_species_summary_${analysis.analysisId}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads a PDF wildlife monitoring report using jsPDF.
 */
export async function downloadPdfReport(
  analysis: AnalysisResult,
  annotatedImageDataUrl?: string
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let cursorY = margin;

  // Header banner
  doc.setFillColor(15, 45, 30); // Deep forest green
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('WildlifeVision AI — Aerial Survey Report', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    'Drone-Based Wildlife Monitoring & Computer Vision Census',
    margin,
    18
  );

  doc.setFontSize(8);
  doc.setTextColor(190, 220, 200);
  doc.text(`Survey ID: ${analysis.analysisId}`, pageWidth - margin - 50, 12);
  doc.text(`Date: ${new Date(analysis.timestamp).toLocaleDateString()} ${new Date(analysis.timestamp).toLocaleTimeString()}`, pageWidth - margin - 50, 18);

  cursorY = 36;

  // Key Metrics Cards
  const cardWidth = (pageWidth - margin * 2 - 8) / 3;
  const cardHeight = 18;

  // Metric 1: Total Animals
  doc.setFillColor(243, 246, 243);
  doc.roundedRect(margin, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL ANIMALS DETECTED', margin + 4, cursorY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 45, 30);
  doc.text(String(analysis.totalAnimals), margin + 4, cursorY + 14);

  // Metric 2: Distinct Species
  const card2X = margin + cardWidth + 4;
  doc.setFillColor(243, 246, 243);
  doc.roundedRect(card2X, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('SPECIES IDENTIFIED', card2X + 4, cursorY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 45, 30);
  doc.text(String(analysis.distinctSpeciesCount), card2X + 4, cursorY + 14);

  // Metric 3: Uncertainty / Review
  const card3X = margin + (cardWidth + 4) * 2;
  doc.setFillColor(243, 246, 243);
  doc.roundedRect(card3X, cursorY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('STATUS / UNCERTAIN', card3X + 4, cursorY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(analysis.uncertainCount > 0 ? 180 : 15, analysis.uncertainCount > 0 ? 80 : 45, 30);
  doc.text(
    analysis.uncertainCount > 0
      ? `${analysis.uncertainCount} Need Review`
      : 'Confirmed High Confidence',
    card3X + 4,
    cursorY + 14
  );

  cursorY += cardHeight + 8;

  // Annotated Drone Image Embed
  const imageToEmbed = annotatedImageDataUrl || analysis.imageDataUrl;
  if (imageToEmbed && imageToEmbed.startsWith('data:image')) {
    try {
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = Math.min(85, (imgWidth * (analysis.imageHeight || 9)) / (analysis.imageWidth || 16));
      doc.addImage(imageToEmbed, 'JPEG', margin, cursorY, imgWidth, imgHeight, undefined, 'FAST');
      cursorY += imgHeight + 4;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Figure 1: Aerial drone frame with species bounding boxes and coordinate tracking (${analysis.imageWidth}x${analysis.imageHeight} px)`,
        margin,
        cursorY
      );
      cursorY += 8;
    } catch {
      // Continue if image embed encountered format issues
    }
  }

  // Species Census Summary Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 45, 30);
  doc.text('1. Species Census Breakdown', margin, cursorY);
  cursorY += 5;

  // Table header
  doc.setFillColor(230, 240, 235);
  doc.rect(margin, cursorY, pageWidth - margin * 2, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 60, 40);
  doc.text('Species Label', margin + 3, cursorY + 4.2);
  doc.text('Taxonomic Category', margin + 65, cursorY + 4.2);
  doc.text('Count', margin + 120, cursorY + 4.2);
  doc.text('Identification Status', margin + 145, cursorY + 4.2);
  cursorY += 7;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);

  if (analysis.speciesCounts.length === 0) {
    doc.text('No animals detected in this aerial image.', margin + 3, cursorY + 4);
    cursorY += 7;
  } else {
    for (const sc of analysis.speciesCounts) {
      if (cursorY > pageHeight - 25) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(sc.animalLabel, margin + 3, cursorY + 4);
      doc.text(sc.category || 'Wildlife', margin + 65, cursorY + 4);
      doc.text(String(sc.count), margin + 120, cursorY + 4);
      doc.text(
        sc.status === 'identified' ? 'Identified' : 'Needs Review',
        margin + 145,
        cursorY + 4
      );
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, cursorY + 5.5, pageWidth - margin, cursorY + 5.5);
      cursorY += 6.5;
    }
  }

  cursorY += 4;

  // Individual Detections Section
  if (cursorY > pageHeight - 35) {
    doc.addPage();
    cursorY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 45, 30);
  doc.text('2. Individual Detection Log (Sample Bounding Coordinates)', margin, cursorY);
  cursorY += 5;

  // Detection log table header
  doc.setFillColor(230, 240, 235);
  doc.rect(margin, cursorY, pageWidth - margin * 2, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 60, 40);
  doc.text('ID', margin + 3, cursorY + 4.2);
  doc.text('Animal', margin + 22, cursorY + 4.2);
  doc.text('Confidence', margin + 65, cursorY + 4.2);
  doc.text('Bounding Box [xMin, yMin, xMax, yMax]', margin + 95, cursorY + 4.2);
  doc.text('Status', margin + 155, cursorY + 4.2);
  cursorY += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 50);

  const displayDetections = analysis.detections.slice(0, 15);
  for (const det of displayDetections) {
    if (cursorY > pageHeight - 20) {
      doc.addPage();
      cursorY = margin;
    }
    const b = det.boundingBox;
    doc.text(det.detectionId, margin + 3, cursorY + 4);
    doc.text(det.animalLabel, margin + 22, cursorY + 4);
    doc.text(`${(det.confidence * 100).toFixed(0)}%`, margin + 65, cursorY + 4);
    doc.text(`[${b.xMin}, ${b.yMin}, ${b.xMax}, ${b.yMax}]`, margin + 95, cursorY + 4);
    doc.text(det.identificationStatus, margin + 155, cursorY + 4);
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, cursorY + 5.5, pageWidth - margin, cursorY + 5.5);
    cursorY += 6;
  }

  if (analysis.detections.length > 15) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`... and ${analysis.detections.length - 15} additional detections available in CSV export.`, margin + 3, cursorY + 4);
    cursorY += 6;
  }

  // Summary and Limitations Notes
  if (cursorY > pageHeight - 40) {
    doc.addPage();
    cursorY = margin;
  }

  cursorY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 45, 30);
  doc.text('3. Field Observations & AI Limitations', margin, cursorY);
  cursorY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 70);

  const summaryText = analysis.summary || 'Aerial computer vision detection completed on drone image.';
  const splitSummary = doc.splitTextToSize(`Environmental Summary: ${summaryText}`, pageWidth - margin * 2);
  doc.text(splitSummary, margin, cursorY);
  cursorY += splitSummary.length * 3.5 + 2;

  if (analysis.warnings && analysis.warnings.length > 0) {
    const warningText = `Quality Warnings: ${analysis.warnings.join('; ')}`;
    const splitWarn = doc.splitTextToSize(warningText, pageWidth - margin * 2);
    doc.setTextColor(180, 80, 20);
    doc.text(splitWarn, margin, cursorY);
    cursorY += splitWarn.length * 3.5 + 2;
  }

  doc.setTextColor(100, 100, 100);
  const disclaimer =
    'Methodology Notice: Animal identification and counting are derived using multimodal aerial computer vision. Confidence scores represent model-estimated likelihoods. Partially occluded or distant animals may require ground-truth verification. Adhere to national wildlife conservation guidelines regarding drone flight altitude and animal disturbance.';
  const splitDisc = doc.splitTextToSize(disclaimer, pageWidth - margin * 2);
  doc.text(splitDisc, margin, cursorY);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `WildlifeVision AI Survey Report — Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 6
    );
    doc.text('Confidential Conservation Data', pageWidth - margin - 38, pageHeight - 6);
  }

  doc.save(`WildlifeVision_Report_${analysis.analysisId}.pdf`);
}

/**
 * Downloads a consolidated multi-image Batch Wildlife Survey PDF report.
 */
export async function downloadBatchPdfReport(
  batchSummary: {
    batchId: string;
    totalImages: number;
    completedImages: number;
    failedImages: number;
    totalAnimalsDetected: number;
    distinctSpeciesCount: number;
    speciesCounts: { animalLabel: string; count: number; category?: string; status: string }[];
    uncertainDetections: number;
    startTime: string;
  },
  results: AnalysisResult[]
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  let cursorY = margin;

  // Header Banner
  doc.setFillColor(15, 45, 30);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('WILDLIFEVISION AI — CONSOLIDATED SURVEY REPORT', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(165, 214, 167);
  doc.text(
    `Batch Mission ID: ${batchSummary.batchId}  •  Conducted: ${new Date(batchSummary.startTime).toLocaleString()}`,
    margin,
    20
  );

  cursorY = 36;

  // Overview Statistics Grid
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 45, 30);
  doc.text('1. Batch Mission Overview & Aggregated Census', margin, cursorY);
  cursorY += 6;

  const colWidth = (pageWidth - margin * 2 - 9) / 4;
  const statBox = (x: number, label: string, value: string, sub: string, highlight?: boolean) => {
    doc.setFillColor(highlight ? 236 : 248, highlight ? 253 : 250, highlight ? 245 : 252);
    doc.setDrawColor(200, 220, 210);
    doc.roundedRect(x, cursorY, colWidth, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(90, 110, 100);
    doc.text(label.toUpperCase(), x + 3, cursorY + 4.5);

    doc.setFontSize(13);
    doc.setTextColor(highlight ? 20 : 15, highlight ? 120 : 45, highlight ? 70 : 30);
    doc.text(value, x + 3, cursorY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(sub, x + 3, cursorY + 15.5);
  };

  statBox(margin, 'Images Analyzed', `${batchSummary.completedImages} / ${batchSummary.totalImages}`, `${batchSummary.failedImages} failed`);
  statBox(margin + colWidth + 3, 'Total Animals', `${batchSummary.totalAnimalsDetected}`, 'Validated count', true);
  statBox(margin + (colWidth + 3) * 2, 'Species Diversity', `${batchSummary.distinctSpeciesCount}`, 'Distinct taxa');
  statBox(margin + (colWidth + 3) * 3, 'Review Flags', `${batchSummary.uncertainDetections}`, 'Biologist review');

  cursorY += 24;

  // Aggregated Species Distribution Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 45, 30);
  doc.text('2. Consolidated Species Census Across All Aerial Frames', margin, cursorY);
  cursorY += 5;

  // Table header
  doc.setFillColor(235, 242, 238);
  doc.rect(margin, cursorY, pageWidth - margin * 2, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 60, 50);
  doc.text('Species Taxon', margin + 3, cursorY + 4);
  doc.text('Category', margin + 70, cursorY + 4);
  doc.text('Total Count', margin + 120, cursorY + 4);
  doc.text('Survey Share', margin + 155, cursorY + 4);
  cursorY += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const total = batchSummary.totalAnimalsDetected || 1;
  batchSummary.speciesCounts.forEach((sc) => {
    if (cursorY > pageHeight - 30) {
      doc.addPage();
      cursorY = margin;
    }
    const share = ((sc.count / total) * 100).toFixed(1) + '%';
    doc.setTextColor(30, 30, 30);
    doc.text(sc.animalLabel, margin + 3, cursorY + 4);
    doc.setTextColor(90, 90, 90);
    doc.text(sc.category || 'Wildlife', margin + 70, cursorY + 4);
    doc.setTextColor(15, 45, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(String(sc.count), margin + 124, cursorY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(share, margin + 158, cursorY + 4);

    doc.setDrawColor(230, 230, 230);
    doc.line(margin, cursorY + 5.5, pageWidth - margin, cursorY + 5.5);
    cursorY += 6;
  });

  cursorY += 6;

  // Per-Image Breakdown Table
  if (cursorY > pageHeight - 45) {
    doc.addPage();
    cursorY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 45, 30);
  doc.text('3. Individual Aerial Survey Frame Results', margin, cursorY);
  cursorY += 5;

  doc.setFillColor(235, 242, 238);
  doc.rect(margin, cursorY, pageWidth - margin * 2, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 60, 50);
  doc.text('Frame / Filename', margin + 3, cursorY + 4);
  doc.text('Dimensions', margin + 65, cursorY + 4);
  doc.text('Animals', margin + 105, cursorY + 4);
  doc.text('Top Species Identified', margin + 130, cursorY + 4);
  cursorY += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  results.forEach((r) => {
    if (cursorY > pageHeight - 25) {
      doc.addPage();
      cursorY = margin;
    }
    const topSpecies = r.speciesCounts.map(s => `${s.animalLabel} (${s.count})`).slice(0, 3).join(', ') || 'None';
    doc.setTextColor(30, 30, 30);
    doc.text(r.filename.length > 32 ? r.filename.substring(0, 30) + '...' : r.filename, margin + 3, cursorY + 4);
    doc.setTextColor(90, 90, 90);
    doc.text(`${r.imageWidth}×${r.imageHeight}`, margin + 65, cursorY + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(r.totalAnimals > 0 ? 20 : 120, r.totalAnimals > 0 ? 120 : 120, r.totalAnimals > 0 ? 70 : 120);
    doc.text(String(r.totalAnimals), margin + 109, cursorY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(topSpecies, margin + 130, cursorY + 4);

    doc.setDrawColor(235, 235, 235);
    doc.line(margin, cursorY + 5.5, pageWidth - margin, cursorY + 5.5);
    cursorY += 6;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `WildlifeVision AI Batch Survey Summary — Page ${i} of ${totalPages}`,
      margin,
      pageHeight - 6
    );
    doc.text('Confidential Drone Wildlife Monitoring Data', pageWidth - margin - 55, pageHeight - 6);
  }

  doc.save(`WildlifeVision_Batch_Report_${batchSummary.batchId}.pdf`);
}

/**
 * Downloads consolidated CSV of all detections across multiple batch images.
 */
export function downloadBatchDetailedCsv(results: AnalysisResult[], batchId: string): void {
  const headers = [
    'batch_id',
    'image_filename',
    'analysis_id',
    'detection_id',
    'animal_label',
    'category',
    'confidence',
    'status',
    'x_min',
    'y_min',
    'x_max',
    'y_max',
    'timestamp',
  ];

  const rows: any[] = [];
  results.forEach(res => {
    res.detections.forEach(det => {
      rows.push([
        `"${batchId}"`,
        `"${res.filename}"`,
        `"${res.analysisId}"`,
        `"${det.detectionId}"`,
        `"${det.animalLabel}"`,
        `"${det.category}"`,
        (det.confidence * 100).toFixed(1) + '%',
        `"${det.identificationStatus}"`,
        det.boundingBox.xMin,
        det.boundingBox.yMin,
        det.boundingBox.xMax,
        det.boundingBox.yMax,
        `"${res.timestamp}"`,
      ]);
    });
  });

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `batch_wildlife_detections_${batchId}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads a comprehensive PDF Report for a Video Wildlife Survey.
 */
export async function downloadVideoPdfReport(videoResult: VideoAnalysisResult): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let cursorY = margin;

  // Header banner
  doc.setFillColor(15, 45, 30); // Deep forest green
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('WildlifeVision AI — Drone Video Wildlife Survey Report', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(190, 220, 205);
  doc.text(
    `Survey ID: ${videoResult.analysisId}  •  File: ${videoResult.filename}  •  Duration: ${videoResult.durationSec.toFixed(1)}s`,
    margin,
    20
  );

  cursorY = 34;

  // Overview stats row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 45, 30);
  doc.text('1. Aerial Video Tracking Summary', margin, cursorY);
  cursorY += 5;

  const colWidth = (pageWidth - margin * 2 - 9) / 4;
  const statBox = (x: number, label: string, value: string, sub: string, highlight = false) => {
    doc.setFillColor(highlight ? 240 : 248, highlight ? 253 : 250, highlight ? 244 : 248);
    doc.setDrawColor(200, 220, 210);
    doc.roundedRect(x, cursorY, colWidth, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(90, 110, 100);
    doc.text(label.toUpperCase(), x + 3, cursorY + 4.5);

    doc.setFontSize(13);
    doc.setTextColor(highlight ? 20 : 15, highlight ? 120 : 45, highlight ? 70 : 30);
    doc.text(value, x + 3, cursorY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(sub, x + 3, cursorY + 15.5);
  };

  statBox(margin, 'Tracked Animals', `${videoResult.totalTrackedAnimals}`, 'Unique Individuals', true);
  statBox(margin + colWidth + 3, 'Frame Sightings', `${videoResult.totalFrameDetections}`, 'Total Frame Dets');
  statBox(margin + (colWidth + 3) * 2, 'Species Count', `${videoResult.distinctSpeciesCount}`, 'Distinct Taxa');
  statBox(margin + (colWidth + 3) * 3, 'Frames Analyzed', `${videoResult.totalFramesAnalyzed}`, `Every ${videoResult.samplingIntervalSec}s`);

  cursorY += 24;

  // Species-wise Track Breakdown Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 45, 30);
  doc.text('2. Species-Wise Unique Track Counts', margin, cursorY);
  cursorY += 5;

  doc.setFillColor(235, 242, 238);
  doc.rect(margin, cursorY, pageWidth - margin * 2, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 60, 50);
  doc.text('Species Taxon', margin + 3, cursorY + 4);
  doc.text('Category', margin + 65, cursorY + 4);
  doc.text('Unique Tracks', margin + 110, cursorY + 4);
  doc.text('Total Frame Sightings', margin + 145, cursorY + 4);
  cursorY += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  videoResult.speciesCounts.forEach((sc) => {
    doc.setTextColor(30, 40, 35);
    doc.text(sc.animalLabel, margin + 3, cursorY + 4);
    doc.text(sc.category || 'Wildlife', margin + 65, cursorY + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(`${sc.trackCount} individuals`, margin + 110, cursorY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`${sc.totalDetections} detections`, margin + 145, cursorY + 4);

    cursorY += 6;
  });

  cursorY += 5;

  // Track Details Manifest
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 45, 30);
  doc.text('3. Persistent Animal Tracks Manifest', margin, cursorY);
  cursorY += 5;

  doc.setFillColor(235, 242, 238);
  doc.rect(margin, cursorY, pageWidth - margin * 2, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(40, 60, 50);
  doc.text('Track ID', margin + 3, cursorY + 4);
  doc.text('Species Label', margin + 35, cursorY + 4);
  doc.text('Time Interval', margin + 85, cursorY + 4);
  doc.text('Duration', margin + 125, cursorY + 4);
  doc.text('Avg Confidence', margin + 155, cursorY + 4);
  cursorY += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  videoResult.tracks.forEach((track) => {
    if (cursorY > pageHeight - 25) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setTextColor(30, 40, 35);
    doc.text(track.trackId, margin + 3, cursorY + 4);
    doc.text(track.animalLabel, margin + 35, cursorY + 4);
    doc.text(`${track.firstSeenSec.toFixed(1)}s – ${track.lastSeenSec.toFixed(1)}s`, margin + 85, cursorY + 4);
    doc.text(`${track.durationSec.toFixed(1)}s (${track.detectionCount} frames)`, margin + 125, cursorY + 4);
    doc.text(`${(track.averageConfidence * 100).toFixed(0)}%`, margin + 155, cursorY + 4);

    cursorY += 5.5;
  });

  cursorY += 6;

  // Methodology and Limitations
  if (cursorY > pageHeight - 35) {
    doc.addPage();
    cursorY = margin;
  }

  doc.setFillColor(250, 245, 235);
  doc.setDrawColor(230, 215, 180);
  doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120, 80, 20);
  doc.text('Methodology, Tracking Discipline & Biologist Disclosure:', margin + 3, cursorY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 70, 30);
  const methodologyText =
    `${videoResult.methodology} A video track represents an estimated distinct animal sighting across contiguous video frames, not guaranteed DNA/biological identity. Occasional occlusion, camera turns, or re-entry into frame may generate new track IDs.`;
  const splitText = doc.splitTextToSize(methodologyText, pageWidth - margin * 2 - 6);
  doc.text(splitText, margin + 3, cursorY + 9);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `Generated by WildlifeVision AI • ${new Date().toUTCString()}`,
    margin,
    pageHeight - 8
  );

  doc.save(`WildlifeVision_Video_Report_${videoResult.analysisId}.pdf`);
}

/**
 * Downloads CSV containing unique animal tracks for video survey.
 */
export function downloadVideoTracksCsv(videoResult: VideoAnalysisResult): void {
  const headers = [
    'analysis_id',
    'filename',
    'track_id',
    'animal_label',
    'category',
    'identification_status',
    'first_seen_sec',
    'last_seen_sec',
    'duration_sec',
    'frame_sightings_count',
    'avg_confidence_pct',
  ];

  const rows = videoResult.tracks.map((t) => [
    `"${videoResult.analysisId}"`,
    `"${videoResult.filename}"`,
    `"${t.trackId}"`,
    `"${t.animalLabel}"`,
    `"${t.category}"`,
    `"${t.identificationStatus}"`,
    t.firstSeenSec.toFixed(2),
    t.lastSeenSec.toFixed(2),
    t.durationSec.toFixed(2),
    t.detectionCount,
    (t.averageConfidence * 100).toFixed(1) + '%',
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `video_wildlife_tracks_${videoResult.analysisId}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads CSV containing all individual keyframe detections.
 */
export function downloadVideoFramesCsv(videoResult: VideoAnalysisResult): void {
  const headers = [
    'analysis_id',
    'filename',
    'frame_index',
    'timestamp_sec',
    'detection_id',
    'animal_label',
    'category',
    'confidence_pct',
    'x_min',
    'y_min',
    'x_max',
    'y_max',
  ];

  const rows: any[] = [];
  videoResult.analyzedFrames.forEach((frame) => {
    frame.detections.forEach((det) => {
      rows.push([
        `"${videoResult.analysisId}"`,
        `"${videoResult.filename}"`,
        frame.frameIndex,
        frame.timestampSec.toFixed(2),
        `"${det.detectionId}"`,
        `"${det.animalLabel}"`,
        `"${det.category}"`,
        (det.confidence * 100).toFixed(1) + '%',
        det.boundingBox.xMin,
        det.boundingBox.yMin,
        det.boundingBox.xMax,
        det.boundingBox.yMax,
      ]);
    });
  });

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `video_keyframe_detections_${videoResult.analysisId}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
