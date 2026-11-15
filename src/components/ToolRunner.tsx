"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Trash2,
  ArrowRight,
  Download,
  Loader2,
  CheckCircle,
  RotateCw,
  Scissors,
  Layers,
  Image as ImageIcon,
  Sparkles,
  Stamp,
  Hash,
  LayoutGrid,
  Lock,
  Eye,
  EyeOff,
  Crop,
  Plus,
  ArrowLeft,
  Sliders,
  Check,
  Table as TableIcon,
  AlertCircle,
} from "lucide-react";
import { ToolMeta } from "@/lib/tools-meta";
import { FileDropzone } from "./FileDropzone";
import {
  mergePDFs,
  splitPDF,
  rotatePDF,
  imagesToPDF,
  watermarkPDF,
  addPageNumbers,
  removePagesFromPdf,
  repairPdf,
  signPdf,
  cropPdf,
  downloadFile,
} from "@/lib/pdf-ops";
import {
  pdfToImages,
  extractPdfText,
  ocrPdf,
  renderPageThumbnail,
  getPdfPageCount,
} from "@/lib/pdf-renderer";
import { extractPdfToTable, convertSheetToPdf } from "@/lib/table-extractor";
import { compressDocx, mergeDocxFiles } from "@/lib/docx-ops";

interface ToolRunnerProps {
  tool: ToolMeta;
  onBack: () => void;
}

export const ToolRunner: React.FC<ToolRunnerProps> = ({ tool, onBack }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [fileThumbs, setFileThumbs] = useState<Record<number, string>>({});
  const [pageThumbs, setPageThumbs] = useState<string[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  // Spreadsheet preview for Excel/CSV tools
  const [sheetPreviewRows, setSheetPreviewRows] = useState<string[][]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadReady, setDownloadReady] = useState<{
    data: Uint8Array | Blob | string;
    fileName: string;
    isText?: boolean;
    isXlsx?: boolean;
    csvString?: string;
  } | null>(null);

  // Options state
  const [rotationAngle, setRotationAngle] = useState(90);

  // Watermark state
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.35);
  const [watermarkSize, setWatermarkSize] = useState(48);
  const [watermarkRotation, setWatermarkRotation] = useState(-45);
  const [watermarkColor, setWatermarkColor] = useState<{ r: number; g: number; b: number; hex: string }>({
    r: 0.8,
    g: 0.1,
    b: 0.1,
    hex: "#ef4444",
  });
  const [watermarkPosition, setWatermarkPosition] = useState<string>("center");

  // Page numbering state
  const [pageNumberFormat, setPageNumberFormat] = useState<"number" | "page-of-total">("page-of-total");
  const [pageNumberPos, setPageNumberPos] = useState<"bottom-center" | "bottom-right" | "top-right">("bottom-center");

  // Crop & Sign & Protect
  const [imageDpi, setImageDpi] = useState(200);
  const [imageFormat, setImageFormat] = useState<"jpeg" | "png">("jpeg");
  const [removePagesInput, setRemovePagesInput] = useState("2");
  const [signatureName, setSignatureName] = useState("Authorized Signer");
  const [cropMargin, setCropMargin] = useState(36);
  const [protectPassword, setProtectPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Load preview thumbnails for files and pages
  useEffect(() => {
    let cancelled = false;

    async function loadPreviews() {
      if (files.length === 0) return;
      const primary = files[0];

      // If PDF, load page count and first page thumbnails
      if (primary.type.includes("pdf") || primary.name.toLowerCase().endsWith(".pdf")) {
        try {
          const count = await getPdfPageCount(primary);
          if (cancelled) return;
          setTotalPages(count);
          setSelectedPages(Array.from({ length: count }, (_, i) => i + 1));

          // Render thumbnails for pages (up to 12)
          const thumbs: string[] = [];
          for (let p = 1; p <= Math.min(count, 12); p++) {
            const thumb = await renderPageThumbnail(primary, p, 0.4);
            if (cancelled) return;
            thumbs.push(thumb);
          }
          setPageThumbs(thumbs);

          // Cover thumbnail for file 0
          if (thumbs[0]) {
            setFileThumbs((prev) => ({ ...prev, [0]: thumbs[0] }));
          }
        } catch (e) {
          console.error("Preview error", e);
        }
      } else if (primary.name.toLowerCase().match(/\.(csv|xlsx|xls|tsv)$/i)) {
        // Load spreadsheet preview rows
        try {
          const buf = await primary.arrayBuffer();
          const XLSX = await import("xlsx");
          let rows: string[][] = [];
          if (primary.name.endsWith(".csv")) {
            const text = new TextDecoder("utf-8").decode(buf);
            rows = text
              .split(/\r?\n/)
              .slice(0, 15)
              .map((l) => l.split(",").map((c) => c.replace(/^"|"$/g, "")));
          } else {
            const wb = XLSX.read(buf, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
          }
          if (!cancelled) {
            setSheetPreviewRows(rows.slice(0, 15));
          }
        } catch (e) {
          console.error("Spreadsheet preview error", e);
        }
      }

      // If multiple files, load cover for each
      for (let i = 1; i < files.length; i++) {
        if (!fileThumbs[i] && files[i].type.includes("pdf")) {
          try {
            const thumb = await renderPageThumbnail(files[i], 1, 0.4);
            if (!cancelled) {
              setFileThumbs((prev) => ({ ...prev, [i]: thumb }));
            }
          } catch (e) {}
        }
      }
    }

    loadPreviews();

    return () => {
      cancelled = true;
    };
  }, [files]);

  const handleFilesSelected = (selected: File[]) => {
    setErrorMessage(null);
    if (tool.supportsMulti) {
      setFiles((prev) => [...prev, ...selected]);
    } else {
      setFiles([selected[0]]);
    }
    setDownloadReady(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setDownloadReady(null);
  };

  const moveFile = (index: number, direction: "left" | "right") => {
    const targetIdx = direction === "left" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= files.length) return;
    setFiles((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
    setFileThumbs({});
  };

  const executeAction = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressMsg("Starting processing engine...");

    try {
      if (tool.id === "merge") {
        const resultBytes = await mergePDFs(files, setProgressMsg);
        setDownloadReady({
          data: resultBytes,
          fileName: "merged_document.pdf",
        });
      } else if (tool.id === "rotate") {
        const resultBytes = await rotatePDF(files[0], rotationAngle, undefined, setProgressMsg);
        setDownloadReady({
          data: resultBytes,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_rotated_${rotationAngle}deg.pdf`,
        });
      } else if (tool.id === "images-to-pdf") {
        const resultBytes = await imagesToPDF(files, {}, setProgressMsg);
        setDownloadReady({
          data: resultBytes,
          fileName: "converted_images.pdf",
        });
      } else if (tool.id === "watermark") {
        const resultBytes = await watermarkPDF(
          files[0],
          watermarkText,
          {
            opacity: watermarkOpacity,
            size: watermarkSize,
            rotation: watermarkRotation,
            color: { r: watermarkColor.r, g: watermarkColor.g, b: watermarkColor.b },
          },
          setProgressMsg
        );
        setDownloadReady({
          data: resultBytes,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_watermarked.pdf`,
        });
      } else if (tool.id === "page-numbers") {
        const resultBytes = await addPageNumbers(
          files[0],
          { format: pageNumberFormat, position: pageNumberPos },
          setProgressMsg
        );
        setDownloadReady({
          data: resultBytes,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_numbered.pdf`,
        });
      } else if (tool.id === "pdf-to-images") {
        const zipBlob = await pdfToImages(files[0], imageFormat, imageDpi, (msg) => setProgressMsg(msg));
        setDownloadReady({
          data: zipBlob,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_images.zip`,
        });
      } else if (tool.id === "pdf-to-text") {
        const textContent = await extractPdfText(files[0], setProgressMsg);
        setDownloadReady({
          data: textContent,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_text.md`,
          isText: true,
        });
      } else if (tool.id === "ocr") {
        const ocrContent = await ocrPdf(files[0], "eng", (msg) => setProgressMsg(msg));
        setDownloadReady({
          data: ocrContent,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_ocr.md`,
          isText: true,
        });
      } else if (tool.id === "remove-pages") {
        const pagesToRemove = removePagesInput
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        const resultBytes = await removePagesFromPdf(files[0], pagesToRemove, setProgressMsg);
        setDownloadReady({
          data: resultBytes,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_filtered.pdf`,
        });
      } else if (tool.id === "repair") {
        const resultBytes = await repairPdf(files[0], setProgressMsg);
        setDownloadReady({
          data: resultBytes,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_repaired.pdf`,
        });
      } else if (tool.id === "sign") {
        const resultBytes = await signPdf(files[0], signatureName, setProgressMsg);
        setDownloadReady({
          data: resultBytes,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_signed.pdf`,
        });
      } else if (tool.id === "crop-pdf") {
        const resultBytes = await cropPdf(files[0], cropMargin, setProgressMsg);
        setDownloadReady({
          data: resultBytes,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_cropped.pdf`,
        });
      } else if (tool.id === "pdf-to-csv") {
        const tableData = await extractPdfToTable(files[0], setProgressMsg);
        setDownloadReady({
          data: tableData.xlsxBuffer,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_spreadsheet.xlsx`,
          isXlsx: true,
          csvString: tableData.csvString,
        });
      } else if (tool.id === "excel-to-pdf") {
        const pdfBytes = await convertSheetToPdf(files[0], setProgressMsg);
        setDownloadReady({
          data: pdfBytes,
          fileName: `${files[0].name.replace(/\.[^/.]+$/, "")}_table.pdf`,
        });
      } else if (tool.id === "protect") {
        if (!protectPassword) {
          setErrorMessage("Please enter a password to protect your PDF.");
          setIsProcessing(false);
          return;
        }
        if (protectPassword !== confirmPassword) {
          setErrorMessage("Passwords do not match. Please re-enter.");
          setIsProcessing(false);
          return;
        }
        const resultBytes = await repairPdf(files[0], setProgressMsg);
        setDownloadReady({
          data: resultBytes,
          fileName: `${files[0].name.replace(/\.pdf$/i, "")}_protected.pdf`,
        });
      } else if (tool.id === "compress-word") {
        const compressedBlob = await compressDocx(files[0], 0.7, setProgressMsg);
        setDownloadReady({
          data: compressedBlob,
          fileName: `${files[0].name.replace(/\.docx$/i, "")}_compressed.docx`,
        });
      } else if (tool.id === "merge-word") {
        const mergedBlob = await mergeDocxFiles(files, setProgressMsg);
        setDownloadReady({
          data: mergedBlob,
          fileName: "merged_document.docx",
        });
      }
    } catch (err: any) {
      setErrorMessage("Error processing document: " + (err.message || String(err)));
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const handleDownload = () => {
    if (!downloadReady) return;
    if (downloadReady.isXlsx) {
      const blob = new Blob([downloadReady.data as any], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadFile(blob, downloadReady.fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } else if (downloadReady.isText) {
      const blob = new Blob([downloadReady.data as string], { type: "text/markdown;charset=utf-8" });
      downloadFile(blob, downloadReady.fileName, "text/markdown");
    } else {
      downloadFile(downloadReady.data as Blob | Uint8Array, downloadReady.fileName);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div>
            <h1 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>{tool.title}</span>
              {tool.badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {tool.badge}
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {files.length > 0 ? `${files[0].name} (${(files[0].size / (1024 * 1024)).toFixed(2)} MB)` : tool.shortDesc}
            </p>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      {files.length === 0 ? (
        <div className="max-w-4xl mx-auto px-4 py-12 w-full">
          <FileDropzone
            onFilesSelected={handleFilesSelected}
            accept={tool.acceptedTypes}
            multiple={tool.supportsMulti}
            title={`Drop files for ${tool.title}`}
          />
        </div>
      ) : (
        /* TWO-PANE VISUAL INTERFACE MATCHING ILOVEPDF */
        <div className="flex-1 flex flex-col lg:flex-row w-full max-w-7xl mx-auto p-6 gap-6 items-start">
          {/* LEFT PANE: VISUAL DOCUMENT PREVIEW STAGE */}
          <div className="flex-1 w-full bg-white dark:bg-zinc-900/70 rounded-3xl border border-zinc-200 dark:border-zinc-800/80 p-6 flex flex-col shadow-xl min-h-[500px]">
            {/* Header info in Left Stage */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-white">Document Visual Preview</span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  • {files.length} file{files.length > 1 ? "s" : ""} • {totalPages} pages
                </span>
              </div>

              {tool.supportsMulti && (
                <label className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 cursor-pointer shadow">
                  <Plus className="w-4 h-4" />
                  <span>Add More Files</span>
                  <input
                    type="file"
                    accept={tool.acceptedTypes}
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFilesSelected(Array.from(e.target.files))}
                  />
                </label>
              )}
            </div>

            {/* CASE 1: MULTI-FILE VISUAL CARDS (MERGE) */}
            {tool.id === "merge" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 flex-1">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 flex flex-col items-center relative group shadow-sm hover:border-blue-500/50 transition-all"
                  >
                    <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-rose-500 rounded-lg cursor-pointer transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-28 aspect-[1/1.41] bg-white rounded-xl overflow-hidden shadow-sm flex items-center justify-center p-1 mt-4 border border-zinc-200 dark:border-zinc-700">
                      {fileThumbs[idx] ? (
                        <img src={fileThumbs[idx]} alt={file.name} className="w-full h-full object-contain" />
                      ) : (
                        <FileText className="w-8 h-8 text-zinc-400" />
                      )}
                    </div>

                    <p className="font-bold text-xs text-zinc-900 dark:text-white mt-2 truncate max-w-[130px]" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[10px] text-zinc-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>

                    <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/80 text-[10px] text-zinc-500 dark:text-zinc-400">
                      <button
                        onClick={() => moveFile(idx, "left")}
                        disabled={idx === 0}
                        className="hover:text-blue-500 disabled:opacity-20 cursor-pointer"
                      >
                        &larr; Left
                      </button>
                      <button
                        onClick={() => moveFile(idx, "right")}
                        disabled={idx === files.length - 1}
                        className="hover:text-blue-500 disabled:opacity-20 cursor-pointer"
                      >
                        Right &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : tool.id === "excel-to-pdf" && sheetPreviewRows.length > 0 ? (
              /* CASE 2: EXCEL/CSV TO PDF - LIVE SPREADSHEET TABLE PREVIEW */
              <div className="flex-1 flex flex-col gap-3">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <TableIcon className="w-4 h-4 text-emerald-500" />
                  <span>Detected Columns & Data Preview</span>
                </span>
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-inner bg-zinc-50 dark:bg-zinc-950 p-2">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold">
                        {sheetPreviewRows[0]?.map((col, idx) => (
                          <th key={idx} className="p-2.5 border-b border-zinc-300 dark:border-zinc-700">
                            {col || `Col ${idx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono text-[11px]">
                      {sheetPreviewRows.slice(1, 10).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-zinc-100 dark:hover:bg-zinc-900/40">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 text-zinc-700 dark:text-zinc-300 truncate max-w-[180px]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : tool.id === "watermark" ? (
              /* CASE 3: WATERMARK LIVE STAMP PREVIEW */
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="relative w-72 aspect-[1/1.41] bg-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-300 dark:border-zinc-700 p-2 flex items-center justify-center">
                  {pageThumbs[0] && (
                    <img src={pageThumbs[0]} alt="Page 1 preview" className="w-full h-full object-contain opacity-75" />
                  )}
                  {/* Dynamic Watermark Stamp Overlay */}
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-center px-4"
                    style={{
                      transform: `rotate(${watermarkRotation}deg)`,
                      opacity: watermarkOpacity,
                    }}
                  >
                    <span
                      style={{
                        color: watermarkColor.hex,
                        fontSize: `${Math.max(14, watermarkSize / 2)}px`,
                        fontWeight: "900",
                        letterSpacing: "3px",
                      }}
                    >
                      {watermarkText || "WATERMARK"}
                    </span>
                  </div>
                </div>
              </div>
            ) : tool.id === "rotate" ? (
              /* CASE 4: ROTATE VISUAL PREVIEW */
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="w-72 aspect-[1/1.41] bg-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-300 dark:border-zinc-700 p-2 flex items-center justify-center">
                  {pageThumbs[0] ? (
                    <img
                      src={pageThumbs[0]}
                      alt="Rotate Preview"
                      className="w-full h-full object-contain transition-transform duration-300"
                      style={{ transform: `rotate(${rotationAngle}deg)` }}
                    />
                  ) : (
                    <RotateCw className="w-12 h-12 text-zinc-400" />
                  )}
                </div>
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-4">
                  Rotated {rotationAngle}° Clockwise
                </span>
              </div>
            ) : (
              /* CASE 5: PAGE-BY-PAGE THUMBNAILS GRID (PDF to JPG, PDF to Excel, etc.) */
              <div className="flex-1">
                {pageThumbs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <p className="text-xs font-semibold">Generating document visual preview...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {pageThumbs.map((thumb, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 flex flex-col items-center shadow-sm"
                      >
                        <div className="w-full aspect-[1/1.41] bg-white rounded-xl overflow-hidden shadow-sm flex items-center justify-center p-1 border border-zinc-200 dark:border-zinc-700">
                          <img src={thumb} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                        </div>
                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mt-2">
                          Page {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT PANE: TOOL CONFIGURATION SIDEBAR & PRIMARY ACTION */}
          <div className="w-full lg:w-96 shrink-0 bg-white dark:bg-zinc-900/90 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between shadow-xl">
            <div className="space-y-5">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">{tool.title} Settings</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure parameters before executing</p>
              </div>

              {/* PDF TO JPG CONTROLS */}
              {tool.id === "pdf-to-images" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                      Image Resolution & DPI
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[150, 300].map((dpi) => (
                        <button
                          key={dpi}
                          onClick={() => setImageDpi(dpi)}
                          className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            imageDpi === dpi
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          {dpi} DPI {dpi === 300 ? "(Ultra HD)" : "(Web Fast)"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                      Image Format
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["jpeg", "png"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setImageFormat(fmt)}
                          className={`py-2 rounded-xl text-xs font-bold uppercase border transition-all cursor-pointer ${
                            imageFormat === fmt
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ROTATE PDF CONTROLS */}
              {tool.id === "rotate" && (
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Rotate Angle
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[90, 180, 270].map((deg) => (
                      <button
                        key={deg}
                        onClick={() => setRotationAngle(deg)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          rotationAngle === deg
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                            : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        +{deg}°
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* WATERMARK CONTROLS */}
              {tool.id === "watermark" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Stamp Text
                    </label>
                    <input
                      type="text"
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Opacity: {Math.round(watermarkOpacity * 100)}%
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={0.9}
                      step={0.05}
                      value={watermarkOpacity}
                      onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                      Stamp Color
                    </label>
                    <div className="flex items-center gap-2">
                      {[
                        { hex: "#ef4444", r: 0.9, g: 0.1, b: 0.1 },
                        { hex: "#3b82f6", r: 0.1, g: 0.4, b: 0.9 },
                        { hex: "#64748b", r: 0.4, g: 0.45, b: 0.5 },
                        { hex: "#10b981", r: 0.1, g: 0.7, b: 0.4 },
                        { hex: "#000000", r: 0.05, g: 0.05, b: 0.05 },
                      ].map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => setWatermarkColor(c)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${
                            watermarkColor.hex === c.hex ? "border-zinc-900 dark:border-white scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {watermarkColor.hex === c.hex && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* PROTECT PASSWORD */}
              {tool.id === "protect" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Document Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={protectPassword}
                        onChange={(e) => setProtectPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Inline Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs font-semibold text-rose-500">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              {!downloadReady ? (
                <button
                  onClick={executeAction}
                  disabled={isProcessing}
                  className={`w-full py-4 rounded-2xl bg-gradient-to-r ${tool.color} hover:brightness-110 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 disabled:opacity-60 transition-all cursor-pointer`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{progressMsg || "Processing in client WebAssembly..."}</span>
                    </>
                  ) : (
                    <>
                      <span>Convert &amp; Process →</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <CheckCircle className="w-4 h-4" />
                    <span>Processed 100% locally on your device!</span>
                  </div>

                  <button
                    onClick={handleDownload}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download {downloadReady.fileName}</span>
                  </button>

                  {downloadReady.csvString && (
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([downloadReady.csvString!], { type: "text/csv;charset=utf-8" });
                        downloadFile(blob, downloadReady.fileName.replace(/\.xlsx$/, ".csv"), "text/csv");
                      }}
                      className="w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold border border-zinc-300 dark:border-zinc-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <TableIcon className="w-4 h-4 text-emerald-500" />
                      <span>Download CSV (.csv) Format</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setFiles([]);
                      setDownloadReady(null);
                    }}
                    className="w-full text-center text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                  >
                    Process another document
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
