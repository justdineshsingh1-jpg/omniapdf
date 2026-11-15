import * as XLSX from "xlsx";
import { getAssetUrl } from "@/lib/pdf-ops";

let pdfjsLib: any = null;

async function getPdfJs() {
  if (typeof window === "undefined") return null;
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = getAssetUrl("/pdf.worker.min.mjs");
  }
  return pdfjsLib;
}

export interface ExtractedTableData {
  rows: string[][];
  csvString: string;
  xlsxBuffer: Uint8Array;
}

interface RawToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function extractPdfToTable(
  file: File,
  onProgress?: (msg: string) => void
): Promise<ExtractedTableData> {
  onProgress?.("Loading document geometry...");
  const pdfjs = await getPdfJs();
  if (!pdfjs) throw new Error("PDF.js unavailable");

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const allTableRows: string[][] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(`Extracting structured table from page ${pageNum} of ${numPages}...`);
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    const tokens: RawToken[] = [];
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      tokens.push({
        text: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        width: Math.round(item.width || 0),
        height: Math.round(item.height || 0),
      });
    }

    if (tokens.length === 0) continue;

    // 1. Group tokens into horizontal rows based on Y coordinate (within 4pt tolerance)
    tokens.sort((a, b) => b.y - a.y); // top-to-bottom

    const rowGroups: RawToken[][] = [];
    let currentRow: RawToken[] = [];
    let currentY: number | null = null;

    for (const token of tokens) {
      if (currentY === null) {
        currentY = token.y;
        currentRow.push(token);
      } else if (Math.abs(token.y - currentY) <= 4) {
        currentRow.push(token);
      } else {
        rowGroups.push(currentRow);
        currentRow = [token];
        currentY = token.y;
      }
    }
    if (currentRow.length > 0) {
      rowGroups.push(currentRow);
    }

    // 2. Discover column boundaries (X coordinates across the page)
    const xCoordinates: number[] = [];
    for (const row of rowGroups) {
      for (const t of row) {
        xCoordinates.push(t.x);
      }
    }
    xCoordinates.sort((a, b) => a - b);

    // Cluster X coordinates that are within 18pt of each other
    const colGutters: number[] = [];
    for (const x of xCoordinates) {
      if (colGutters.length === 0) {
        colGutters.push(x);
      } else {
        const last = colGutters[colGutters.length - 1];
        if (x - last > 24) {
          colGutters.push(x);
        }
      }
    }

    // 3. Place tokens of each row into column slots
    for (const row of rowGroups) {
      row.sort((a, b) => a.x - b.x); // left-to-right
      const cells: string[] = new Array(colGutters.length).fill("");

      for (const t of row) {
        // Find closest column gutter
        let bestCol = 0;
        let minDiff = Infinity;
        for (let c = 0; c < colGutters.length; c++) {
          const diff = Math.abs(t.x - colGutters[c]);
          if (diff < minDiff) {
            minDiff = diff;
            bestCol = c;
          }
        }

        if (cells[bestCol]) {
          cells[bestCol] += " " + t.text;
        } else {
          cells[bestCol] = t.text;
        }
      }

      // Filter out completely empty rows
      if (cells.some((c) => c.trim().length > 0)) {
        allTableRows.push(cells.map((c) => c.trim()));
      }
    }
  }

  onProgress?.("Compiling clean spreadsheet columns...");

  // Generate RFC 4180 CSV string
  const csvLines = allTableRows.map((row) =>
    row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
  );
  const csvString = csvLines.join("\n");

  // Generate native Excel .XLSX binary
  const worksheet = XLSX.utils.aoa_to_sheet(allTableRows);

  // Auto-size columns for Excel
  const colWidths = allTableRows.reduce((acc: number[], row) => {
    row.forEach((cell, idx) => {
      acc[idx] = Math.max(acc[idx] || 10, cell.length + 3);
    });
    return acc;
  }, []);
  worksheet["!cols"] = colWidths.map((w) => ({ wch: Math.min(w, 50) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Extracted Data");

  const xlsxArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const xlsxBuffer = new Uint8Array(xlsxArray);

  return {
    rows: allTableRows,
    csvString,
    xlsxBuffer,
  };
}

// Convert CSV or XLSX back into a styled vector PDF Table
export async function convertSheetToPdf(
  file: File,
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  onProgress?.("Reading spreadsheet records...");
  const buffer = await file.arrayBuffer();

  let rows: string[][] = [];

  if (file.name.endsWith(".csv") || file.type.includes("csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    rows = lines.map((line) => {
      // Basic CSV parser handling quoted cells
      const cells: string[] = [];
      let inQuotes = false;
      let current = "";
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          cells.push(current.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
          current = "";
        } else {
          current += char;
        }
      }
      cells.push(current.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
      return cells;
    });
  } else {
    // XLSX parsing via SheetJS
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
  }

  if (rows.length === 0) {
    throw new Error("Spreadsheet contains no readable rows.");
  }

  onProgress?.("Typesetting vector table layout into PDF...");
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4 standard width
  const pageHeight = 841.89; // A4 standard height
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  const numCols = Math.max(...rows.map((r) => r.length));
  const colWidth = contentWidth / Math.max(1, numCols);
  const rowHeight = 22;
  const rowsPerPage = Math.floor((pageHeight - margin * 2 - 40) / rowHeight);

  const totalPages = Math.ceil((rows.length - 1) / rowsPerPage) || 1;

  for (let p = 0; p < totalPages; p++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin - 20;

    // Title & Header banner
    page.drawText(`${file.name.replace(/\.[^/.]+$/, "")}`, {
      x: margin,
      y: currentY,
      size: 13,
      font: boldFont,
      color: rgb(0.1, 0.15, 0.3),
    });

    const pageTag = `Page ${p + 1} of ${totalPages}`;
    const tagWidth = font.widthOfTextAtSize(pageTag, 8);
    page.drawText(pageTag, {
      x: pageWidth - margin - tagWidth,
      y: currentY,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    currentY -= 20;

    // Draw Table Header Row
    const headerRow = rows[0] || [];
    page.drawRectangle({
      x: margin,
      y: currentY - 5,
      width: contentWidth,
      height: rowHeight,
      color: rgb(0.15, 0.23, 0.4),
    });

    for (let c = 0; c < numCols; c++) {
      const cellText = String(headerRow[c] || `Col ${c + 1}`);
      const truncated = cellText.length > 25 ? cellText.slice(0, 22) + "..." : cellText;
      page.drawText(truncated, {
        x: margin + c * colWidth + 5,
        y: currentY,
        size: 9,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
    }

    currentY -= rowHeight;

    // Draw Data Rows for this page
    const startRowIdx = 1 + p * rowsPerPage;
    const endRowIdx = Math.min(rows.length, startRowIdx + rowsPerPage);

    for (let r = startRowIdx; r < endRowIdx; r++) {
      const rowData = rows[r] || [];
      const isEven = (r - startRowIdx) % 2 === 0;

      // Zebra striping
      if (isEven) {
        page.drawRectangle({
          x: margin,
          y: currentY - 5,
          width: contentWidth,
          height: rowHeight,
          color: rgb(0.96, 0.97, 0.99),
        });
      }

      // Row bottom border
      page.drawLine({
        start: { x: margin, y: currentY - 5 },
        end: { x: margin + contentWidth, y: currentY - 5 },
        thickness: 0.5,
        color: rgb(0.85, 0.88, 0.92),
      });

      for (let c = 0; c < numCols; c++) {
        const cellText = String(rowData[c] ?? "");
        const truncated = cellText.length > 30 ? cellText.slice(0, 27) + "..." : cellText;
        page.drawText(truncated, {
          x: margin + c * colWidth + 5,
          y: currentY,
          size: 8.5,
          font,
          color: rgb(0.15, 0.15, 0.2),
        });
      }

      currentY -= rowHeight;
    }
  }

  return await pdfDoc.save({ useObjectStreams: true });
}
