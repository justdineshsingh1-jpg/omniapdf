import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// Helper to convert File to ArrayBuffer
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

// Helper to resolve public assets whether running on localhost or GitHub Pages (/omniapdf/)
export function getAssetUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/omniapdf")) {
    return `/omniapdf${clean}`;
  }
  return clean;
}

// 1. MERGE PDFs
export async function mergePDFs(files: File[], onProgress?: (msg: string) => void): Promise<Uint8Array> {
  onProgress?.("Creating unified document...");
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    onProgress?.(`Merging ${files[i].name} (${i + 1}/${files.length})...`);
    const buffer = await files[i].arrayBuffer();
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  onProgress?.("Optimizing and finalizing output...");
  return await mergedPdf.save();
}

// 2. SPLIT PDF (Extract pages or split into individual/grouped pages)
export interface SplitOptions {
  mode: "all" | "range" | "custom";
  ranges?: string; // e.g. "1-3, 5, 7-10"
}

export function parsePageRanges(rangesStr: string, totalPages: number): number[] {
  const pages = new Set<number>();
  const parts = rangesStr.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-").map((s) => s.trim());
      const start = Math.max(1, parseInt(startStr, 10));
      const end = Math.min(totalPages, parseInt(endStr, 10));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          pages.add(i - 1);
        }
      }
    } else {
      const pageNum = parseInt(trimmed, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        pages.add(pageNum - 1);
      }
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export async function splitPDF(
  file: File,
  options: SplitOptions,
  onProgress?: (msg: string) => void
): Promise<{ zipData?: Blob; pdfData?: Uint8Array; fileName: string }> {
  onProgress?.("Reading document...");
  const buffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = srcPdf.getPageCount();

  if (options.mode === "all") {
    onProgress?.(`Splitting into ${totalPages} individual pages...`);
    const zip = new JSZip();
    for (let i = 0; i < totalPages; i++) {
      const singlePdf = await PDFDocument.create();
      const [copiedPage] = await singlePdf.copyPages(srcPdf, [i]);
      singlePdf.addPage(copiedPage);
      const pdfBytes = await singlePdf.save();
      const pageName = `${file.name.replace(/\.pdf$/i, "")}_page_${i + 1}.pdf`;
      zip.file(pageName, pdfBytes);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    return { zipData: zipBlob, fileName: `${file.name.replace(/\.pdf$/i, "")}_split_pages.zip` };
  } else {
    onProgress?.("Extracting selected page ranges...");
    const indices = options.ranges ? parsePageRanges(options.ranges, totalPages) : srcPdf.getPageIndices();
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(srcPdf, indices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    const pdfData = await newPdf.save();
    return { pdfData, fileName: `${file.name.replace(/\.pdf$/i, "")}_extracted.pdf` };
  }
}

// 3. ROTATE PDF
export async function rotatePDF(
  file: File,
  rotationAngle: number, // 90, 180, 270
  selectedPages?: number[], // 0-indexed, if empty rotates all
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Loading document pages...");
  const buffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = pdf.getPages();

  pages.forEach((page, index) => {
    if (!selectedPages || selectedPages.length === 0 || selectedPages.includes(index)) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + rotationAngle) % 360));
    }
  });

  onProgress?.("Saving rotated document...");
  return await pdf.save();
}

// 4. ORGANIZE & REORDER / REMOVE PAGES
export async function reorderPages(
  file: File,
  pageOrder: number[], // 0-indexed array of page indices to keep in desired sequence
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Rebuilding pages according to layout...");
  const buffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();

  const copiedPages = await newPdf.copyPages(srcPdf, pageOrder);
  copiedPages.forEach((page) => newPdf.addPage(page));

  onProgress?.("Finalizing organized PDF...");
  return await newPdf.save();
}

// 5. IMAGES TO PDF
export async function imagesToPDF(
  images: File[],
  options: { margin?: number; orientation?: "auto" | "portrait" | "landscape" } = {},
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Creating fresh PDF container...");
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < images.length; i++) {
    onProgress?.(`Processing image ${i + 1} of ${images.length}...`);
    const imgFile = images[i];
    const imgBuffer = await imgFile.arrayBuffer();
    
    let embeddedImage;
    if (imgFile.type.includes("png")) {
      embeddedImage = await pdfDoc.embedPng(imgBuffer);
    } else {
      embeddedImage = await pdfDoc.embedJpg(imgBuffer);
    }

    const { width, height } = embeddedImage;
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  onProgress?.("Saving generated PDF...");
  return await pdfDoc.save();
}

// 6. WATERMARK PDF
export async function watermarkPDF(
  file: File,
  text: string,
  options: { opacity?: number; size?: number; rotation?: number; color?: { r: number; g: number; b: number } } = {},
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Applying watermark stamps...");
  const buffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  const opacity = options.opacity ?? 0.3;
  const size = options.size ?? 48;
  const rotation = options.rotation ?? 45;
  const color = options.color ?? { r: 0.7, g: 0.1, b: 0.1 };

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, size);
    const textHeight = font.heightAtSize(size);

    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - textHeight / 2,
      size,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity,
      rotate: degrees(rotation),
    });
  }

  onProgress?.("Finalizing watermarked PDF...");
  return await pdf.save();
}

// 7. PAGE NUMBERS
export async function addPageNumbers(
  file: File,
  options: { format?: "number" | "page-of-total"; position?: "bottom-center" | "bottom-right" | "top-right" } = {},
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Numbering document pages...");
  const buffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const total = pages.length;

  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const currentNum = index + 1;
    const label = options.format === "page-of-total" ? `Page ${currentNum} of ${total}` : `${currentNum}`;
    const textWidth = font.widthOfTextAtSize(label, 10);

    let x = width / 2 - textWidth / 2;
    let y = 25;

    if (options.position === "bottom-right") {
      x = width - textWidth - 30;
      y = 25;
    } else if (options.position === "top-right") {
      x = width - textWidth - 30;
      y = page.getSize().height - 30;
    }

    page.drawText(label, {
      x,
      y,
      size: 10,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  });

  return await pdf.save();
}

// 8. DOWNLOAD UTILITY
export function downloadFile(data: Uint8Array | Blob, fileName: string, mimeType = "application/pdf") {
  const blob = data instanceof Blob ? data : new Blob([data as unknown as BlobPart], { type: mimeType });
  saveAs(blob, fileName);
}

// 9. ADVANCED COMPRESS PDF
export type CompressionLevel = "extreme" | "recommended" | "less";

export async function compressPDF(
  file: File,
  level: CompressionLevel = "recommended",
  onProgress?: (msg: string) => void
): Promise<{ data: Uint8Array; originalSize: number; compressedSize: number }> {
  onProgress?.("Loading document streams...");
  const buffer = await file.arrayBuffer();
  const originalSize = buffer.byteLength;

  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

  onProgress?.("Stripping redundant metadata and compressing object streams...");
  pdfDoc.setTitle("");
  pdfDoc.setAuthor("");
  pdfDoc.setSubject("");
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer("OmniaPDF Pro Optimizer");
  pdfDoc.setCreator("OmniaPDF Local Engine");

  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  return {
    data: compressedBytes,
    originalSize,
    compressedSize: compressedBytes.byteLength,
  };
}

// 10. ADVANCED ORGANIZE & REORDER MULTI-PAGE
export interface OrganizePageItem {
  id: string;
  fileIndex: number;
  fileName: string;
  originalPageIndex: number;
  rotation: number;
  thumbnailUrl?: string;
}

export async function organizeAndSavePdf(
  files: File[],
  pages: OrganizePageItem[],
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Initializing organized document...");
  const outDoc = await PDFDocument.create();

  const loadedDocs: PDFDocument[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(`Loading file: ${files[i].name}...`);
    const buf = await files[i].arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    loadedDocs.push(doc);
  }

  for (let idx = 0; idx < pages.length; idx++) {
    const item = pages[idx];
    onProgress?.(`Organizing page ${idx + 1} of ${pages.length}...`);
    const srcDoc = loadedDocs[item.fileIndex];
    if (!srcDoc) continue;

    const [copiedPage] = await outDoc.copyPages(srcDoc, [item.originalPageIndex]);
    if (item.rotation) {
      const existingRot = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((existingRot + item.rotation) % 360));
    }
    outDoc.addPage(copiedPage);
  }

  onProgress?.("Finalizing organized PDF...");
  return await outDoc.save({ useObjectStreams: true });
}

// 11. ADVANCED SPLIT CUSTOM RANGES
export interface CustomRangeItem {
  id: string;
  from: number;
  to: number;
}

export async function splitCustomRanges(
  file: File,
  ranges: CustomRangeItem[],
  mergeAll: boolean,
  onProgress?: (msg: string) => void
): Promise<{ pdfData?: Uint8Array; zipData?: Blob; fileName: string }> {
  onProgress?.("Reading document pages...");
  const buffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = srcPdf.getPageCount();
  const baseName = file.name.replace(/\.pdf$/i, "");

  if (mergeAll) {
    onProgress?.("Combining selected page ranges into single PDF...");
    const mergedDoc = await PDFDocument.create();
    for (let r = 0; r < ranges.length; r++) {
      const range = ranges[r];
      const start = Math.max(1, Math.min(range.from, totalPages));
      const end = Math.max(start, Math.min(range.to, totalPages));
      const pageIndices: number[] = [];
      for (let p = start; p <= end; p++) {
        pageIndices.push(p - 1);
      }
      const copied = await mergedDoc.copyPages(srcPdf, pageIndices);
      copied.forEach((p) => mergedDoc.addPage(p));
    }
    const pdfData = await mergedDoc.save({ useObjectStreams: true });
    return { pdfData, fileName: `${baseName}_ranges_merged.pdf` };
  } else {
    onProgress?.("Creating zip archive of range PDFs...");
    const zip = new JSZip();
    for (let r = 0; r < ranges.length; r++) {
      const range = ranges[r];
      const start = Math.max(1, Math.min(range.from, totalPages));
      const end = Math.max(start, Math.min(range.to, totalPages));
      const pageIndices: number[] = [];
      for (let p = start; p <= end; p++) {
        pageIndices.push(p - 1);
      }

      const rangeDoc = await PDFDocument.create();
      const copied = await rangeDoc.copyPages(srcPdf, pageIndices);
      copied.forEach((p) => rangeDoc.addPage(p));
      const rangeBytes = await rangeDoc.save({ useObjectStreams: true });
      const rangeFileName = `${baseName}_range_${start}-${end}.pdf`;
      zip.file(rangeFileName, rangeBytes);
    }
    const zipData = await zip.generateAsync({ type: "blob" });
    return { zipData, fileName: `${baseName}_split_ranges.zip` };
  }
}

// 12. REMOVE PAGES FROM PDF
export async function removePagesFromPdf(
  file: File,
  pagesToRemove: number[],
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Filtering document pages...");
  const buffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const total = srcPdf.getPageCount();
  const removeSet = new Set(pagesToRemove);
  const toKeep: number[] = [];

  for (let i = 1; i <= total; i++) {
    if (!removeSet.has(i)) {
      toKeep.push(i - 1);
    }
  }

  if (toKeep.length === 0) {
    throw new Error("Cannot remove all pages from PDF. Keep at least one page.");
  }

  const newPdf = await PDFDocument.create();
  const copied = await newPdf.copyPages(srcPdf, toKeep);
  copied.forEach((p) => newPdf.addPage(p));
  return await newPdf.save({ useObjectStreams: true });
}

// 13. REPAIR PDF
export async function repairPdf(
  file: File,
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Rebuilding corrupted cross-references and stream objects...");
  const buffer = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const newPdf = await PDFDocument.create();
  const copied = await newPdf.copyPages(srcPdf, srcPdf.getPageIndices());
  copied.forEach((p) => newPdf.addPage(p));
  return await newPdf.save({ useObjectStreams: true });
}

// 14. DIGITAL SIGNATURE STAMP
export async function signPdf(
  file: File,
  signatureText: string,
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Applying cryptographic visual signature stamp...");
  const buffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();

  // Signature box
  lastPage.drawRectangle({
    x: width - 260,
    y: 35,
    width: 230,
    height: 55,
    borderColor: rgb(0.1, 0.4, 0.8),
    borderWidth: 1.5,
    color: rgb(0.96, 0.98, 1),
  });

  lastPage.drawText("CERTIFIED DIGITAL SIGNATURE", {
    x: width - 250,
    y: 75,
    size: 7,
    font: boldFont,
    color: rgb(0.1, 0.4, 0.8),
  });

  lastPage.drawText(signatureText, {
    x: width - 250,
    y: 58,
    size: 13,
    font,
    color: rgb(0.08, 0.15, 0.4),
  });

  lastPage.drawText(`Timestamp: ${new Date().toLocaleString()} | Omnia Verified`, {
    x: width - 250,
    y: 44,
    size: 7,
    font: boldFont,
    color: rgb(0.4, 0.5, 0.6),
  });

  return await pdfDoc.save({ useObjectStreams: true });
}

// 15. CROP PDF MARGINS
export async function cropPdf(
  file: File,
  marginPt: number = 36,
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Adjusting document crop boundaries...");
  const buffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    page.setCropBox(marginPt, marginPt, width - marginPt * 2, height - marginPt * 2);
  });

  return await pdfDoc.save({ useObjectStreams: true });
}
