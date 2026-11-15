import JSZip from "jszip";
import { saveAs } from "file-saver";

// We dynamically import pdfjs-dist in the browser to avoid SSR canvas node errors
let pdfjsLib: any = null;

async function getPdfJs() {
  if (typeof window === "undefined") return null;
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjsLib;
}

// 1. RENDER PAGE TO THUMBNAIL DATA URL
export async function renderPageThumbnail(
  file: File | ArrayBuffer,
  pageNumber: number = 1,
  scale: number = 0.5
): Promise<string> {
  const pdfjs = await getPdfJs();
  if (!pdfjs) throw new Error("PDF.js unavailable");

  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  if (!context) throw new Error("Could not acquire 2D canvas context");

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toDataURL("image/jpeg", 0.85);
}

// 2. GET TOTAL PAGE COUNT
export async function getPdfPageCount(file: File | ArrayBuffer): Promise<number> {
  const pdfjs = await getPdfJs();
  if (!pdfjs) throw new Error("PDF.js unavailable");
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

// 3. CONVERT PDF TO HIGH-RES IMAGES (ZIP)
export async function pdfToImages(
  file: File,
  format: "jpeg" | "png" = "jpeg",
  dpi: number = 200,
  onProgress?: (msg: string, percent?: number) => void
): Promise<Blob> {
  const pdfjs = await getPdfJs();
  if (!pdfjs) throw new Error("PDF.js unavailable");

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;

  const scale = dpi / 72; // Standard PDF point is 72 DPI
  const zip = new JSZip();

  for (let i = 1; i <= total; i++) {
    onProgress?.(`Rendering page ${i} of ${total} (${dpi} DPI)...`, Math.round((i / total) * 100));
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");

    if (context) {
      // White background for transparent pages
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), mimeType, 0.92));
      const ext = format === "png" ? "png" : "jpg";
      const fileName = `${file.name.replace(/\.pdf$/i, "")}_page_${i}.${ext}`;
      zip.file(fileName, blob);
    }
  }

  onProgress?.("Packaging all pages into ZIP archive...");
  return await zip.generateAsync({ type: "blob" });
}

// 4. EXTRACT TEXT / MARKDOWN FROM PDF
export async function extractPdfText(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  const pdfjs = await getPdfJs();
  if (!pdfjs) throw new Error("PDF.js unavailable");

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;

  let fullText = `# Extracted Content: ${file.name}\n\n`;

  for (let i = 1; i <= total; i++) {
    onProgress?.(`Extracting text from page ${i} of ${total}...`);
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");

    fullText += `## Page ${i}\n\n${pageText}\n\n---\n\n`;
  }

  return fullText;
}

// 5. OCR RUNNER VIA TESSERACT.JS
export async function ocrPdf(
  file: File,
  language: string = "eng",
  onProgress?: (msg: string, percent?: number) => void
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  onProgress?.("Spinning up local OCR neural engine...");
  const worker = await createWorker(language);

  const pdfjs = await getPdfJs();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const total = Math.min(pdf.numPages, 20); // Cap at 20 pages per batch for client responsiveness

  let ocrResult = `# OCR Recognized Text: ${file.name}\n\n`;

  for (let i = 1; i <= total; i++) {
    onProgress?.(`Extracting visual page ${i} for OCR analysis...`, Math.round((i / total) * 100));
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for high recognition accuracy

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) continue;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;

    onProgress?.(`Running OCR recognition on page ${i}...`);
    const ret = await worker.recognize(canvas);
    ocrResult += `## Page ${i} (Confidence: ${Math.round(ret.data.confidence)}%)\n\n${ret.data.text}\n\n---\n\n`;
  }

  await worker.terminate();
  return ocrResult;
}
