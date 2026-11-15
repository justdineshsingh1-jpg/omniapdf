"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Type,
  Eraser,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Move,
  Loader2,
  PenTool,
  Edit3,
  Search,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Layers,
  Save,
  Replace,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { downloadFile, getAssetUrl } from "@/lib/pdf-ops";

interface DetectedTextItem {
  id: string;
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  pdfFontSize: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  ascent: number;
  descent: number;
  detectedColor: string;
  detectedBgColor?: string;
  fontFamily: "Helvetica" | "Times" | "Courier";
  isBold?: boolean;
  isItalic?: boolean;
  page: number;
}

interface TextElement {
  id: string;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily: "Helvetica" | "Times" | "Courier";
  isBold: boolean;
  isItalic: boolean;
  align: "left" | "center" | "right";
  isBackgroundBlock: boolean;
  bgColor: string;
  pdfX?: number;
  pdfY?: number;
  pdfOriginalWidth?: number;
  ascent?: number;
  descent?: number;
  maskPadding?: number;
}

interface EraseBox {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface HistoryState {
  textElements: TextElement[];
  eraseBoxes: EraseBox[];
}

interface PdfEditorStudioProps {
  file: File;
  onBack: () => void;
}

export const PdfEditorStudio: React.FC<PdfEditorStudioProps> = ({ file, onBack }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.25);
  const [activeTool, setActiveTool] = useState<"edit-text" | "erase-drag" | "add-text" | "select">("edit-text");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Loading document pages...");

  // Detected text items from PDF.js
  const [detectedTextItems, setDetectedTextItems] = useState<DetectedTextItem[]>([]);
  const [allDocDetectedItems, setAllDocDetectedItems] = useState<DetectedTextItem[]>([]);
  const [searchFilter, setSearchFilter] = useState("");

  // Find & Replace Modal state
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [findWord, setFindWord] = useState("");
  const [replaceWord, setReplaceWord] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [findReplaceStats, setFindReplaceStats] = useState<string | null>(null);

  // Save session state indicator
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // Multiple selection: set of IDs
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // State with Undo / Redo
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [eraseBoxes, setEraseBoxes] = useState<EraseBox[]>([]);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Dragging to create erase box
  const [isDrawingErase, setIsDrawingErase] = useState(false);
  const [eraseStartPos, setEraseStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentDragBox, setCurrentDragBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Dragging existing elements
  const [draggedElementId, setDraggedElementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas and viewport refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
  const [pageViewport, setPageViewport] = useState<any>(null);

  // Local storage storage key based on file name & size
  const storageKey = `omniapdf_project_${file.name}_${file.size}`;

  // Push to history for undo/redo
  const pushHistory = useCallback(
    (newTexts: TextElement[], newErases: EraseBox[]) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, { textElements: newTexts, eraseBoxes: newErases }];
      });
      setHistoryIndex((prev) => prev + 1);

      // Auto-save to LocalStorage
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            textElements: newTexts,
            eraseBoxes: newErases,
            updatedAt: Date.now(),
          })
        );
      } catch (e) {
        console.warn("Could not save to localStorage:", e);
      }
    },
    [historyIndex, storageKey]
  );

  const handleClearAllEdits = () => {
    if (confirm("Reset all edits and start fresh with the original document?")) {
      setTextElements([]);
      setEraseBoxes([]);
      setSelectedIds([]);
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        console.warn("Could not clear storage:", e);
      }
      setHistory([{ textElements: [], eraseBoxes: [] }]);
      setHistoryIndex(0);
      setSavedNotification("Document reset to clean original state!");
      setTimeout(() => setSavedNotification(null), 3000);
    }
  };

  const handleManualSave = () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          textElements,
          eraseBoxes,
          updatedAt: Date.now(),
        })
      );
      setSavedNotification("Project state saved locally in app!");
      setTimeout(() => setSavedNotification(null), 3000);
    } catch (e) {
      alert("Error saving project state to local storage.");
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setTextElements(prev.textElements);
      setEraseBoxes(prev.eraseBoxes);
      setHistoryIndex((idx) => idx - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setTextElements(next.textElements);
      setEraseBoxes(next.eraseBoxes);
      setHistoryIndex((idx) => idx + 1);
    }
  };

  // Keyboard shortcuts for Undo/Redo & Find
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setIsFindReplaceOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleManualSave();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea" && selectedIds.length > 0) {
          e.preventDefault();
          const nextTexts = textElements.filter((t) => !selectedIds.includes(t.id));
          setTextElements(nextTexts);
          pushHistory(nextTexts, eraseBoxes);
          setSelectedIds([]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyIndex, history, selectedIds, textElements, eraseBoxes, pushHistory]);

  // Load PDF with PDF.js and restore saved local state if available
  useEffect(() => {
    let isMounted = true;
    async function loadPdf() {
      setIsProcessing(true);
      setStatusMsg("Loading document into interactive editor...");
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = getAssetUrl("/pdf.worker.min.mjs");

        const buffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;

        if (isMounted) {
          setPdfDocProxy(pdf);
          setTotalPages(pdf.numPages);
          setCurrentPage(1);
          setIsProcessing(false);

          // Restore saved session from LocalStorage
          let initialTexts: TextElement[] = [];
          let initialErases: EraseBox[] = [];
          try {
            const savedData = localStorage.getItem(storageKey);
            if (savedData) {
              const parsed = JSON.parse(savedData);
              if (parsed.textElements) initialTexts = parsed.textElements;
              if (parsed.eraseBoxes) initialErases = parsed.eraseBoxes;
              setSavedNotification("Restored previously saved edits for this file!");
              setTimeout(() => setSavedNotification(null), 4000);
            }
          } catch (e) {
            console.warn("Could not parse saved storage:", e);
          }

          setTextElements(initialTexts);
          setEraseBoxes(initialErases);
          setHistory([{ textElements: initialTexts, eraseBoxes: initialErases }]);
          setHistoryIndex(0);

          // Extract text for all pages in background for global find-and-replace
          extractAllPagesText(pdf);
        }
      } catch (err: any) {
        alert("Error loading PDF: " + (err.message || String(err)));
        setIsProcessing(false);
      }
    }
    loadPdf();
    return () => {
      isMounted = false;
    };
  }, [file, storageKey]);

  // Font and typography detection helpers
  const resolveFontFamily = (fontName?: string, styleFamily?: string): "Helvetica" | "Times" | "Courier" => {
    const fontNameLower = (fontName || "").toLowerCase();
    const styleFamilyLower = (styleFamily || "").toLowerCase();

    if (
      fontNameLower.includes("courier") ||
      fontNameLower.includes("mono") ||
      fontNameLower.includes("consolas") ||
      styleFamilyLower.includes("mono")
    ) {
      return "Courier";
    }
    if (
      (fontNameLower.includes("times") ||
       fontNameLower.includes("georgia") ||
       fontNameLower.includes("garamond") ||
       fontNameLower.includes("cambria") ||
       fontNameLower.includes("minion") ||
       fontNameLower.includes("baskerville") ||
       fontNameLower.includes("palatino") ||
       (styleFamilyLower.includes("serif") && !styleFamilyLower.includes("sans"))) &&
      !fontNameLower.includes("sans") &&
      !fontNameLower.includes("arial")
    ) {
      return "Times";
    }
    return "Helvetica";
  };

  const resolveIsBold = (fontName?: string, styleFamily?: string, fontWeight?: number): boolean => {
    const fontNameLower = (fontName || "").toLowerCase();
    const styleFamilyLower = (styleFamily || "").toLowerCase();
    return (
      fontNameLower.includes("bold") ||
      fontNameLower.includes("black") ||
      fontNameLower.includes("heavy") ||
      fontNameLower.includes("semibold") ||
      fontNameLower.includes("medium") ||
      styleFamilyLower.includes("bold") ||
      (fontWeight !== undefined && fontWeight >= 600)
    );
  };

  const resolveIsItalic = (fontName?: string, styleFamily?: string): boolean => {
    const fontNameLower = (fontName || "").toLowerCase();
    const styleFamilyLower = (styleFamily || "").toLowerCase();
    return (
      fontNameLower.includes("italic") ||
      fontNameLower.includes("oblique") ||
      fontNameLower.includes("slanted") ||
      styleFamilyLower.includes("italic") ||
      styleFamilyLower.includes("oblique")
    );
  };

  // Helper to sample pixel color from rendered canvas to match original text
  const sampleTextColor = (
    ctx: CanvasRenderingContext2D,
    vx: number,
    vy: number,
    fontHeight: number,
    itemWidth: number
  ): string => {
    try {
      const sampleX = Math.max(0, Math.round(vx + 1));
      const sampleY = Math.max(0, Math.round(vy - fontHeight * 0.8));
      const sampleW = Math.max(2, Math.min(Math.round(itemWidth), 25));
      const sampleH = Math.max(2, Math.round(fontHeight * 0.75));

      if (sampleX + sampleW > ctx.canvas.width || sampleY + sampleH > ctx.canvas.height) {
        return "#000000";
      }

      const imgData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH);
      const data = imgData.data;

      let bestColor = "#000000";
      let minBrightness = 255 * 3;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 50 || (r > 235 && g > 235 && b > 235)) continue;

        // Detect genuine blue text (hyperlink / colored table cell)
        if (b > 130 && b > r * 1.4 && b > g * 1.2) {
          return "#0000ee";
        }
        // Detect genuine red text (table serials / alerts)
        if (r > 130 && r > g * 1.5 && r > b * 1.5) {
          return "#cc0000";
        }

        const brightness = r + g + b;
        if (brightness < minBrightness) {
          minBrightness = brightness;
          const hex =
            "#" +
            [r, g, b]
              .map((v) => {
                const h = v.toString(16);
                return h.length === 1 ? "0" + h : h;
              })
              .join("");
          bestColor = hex;
        }
      }

      if (minBrightness < 120) return "#000000";
      return bestColor;
    } catch {
      return "#000000";
    }
  };

  // Helper to sample background color around text to blend seamlessly with cell/page background
  const sampleBgColor = (
    ctx: CanvasRenderingContext2D,
    vx: number,
    vy: number,
    fontHeight: number
  ): string => {
    try {
      const samplePoints = [
        { x: Math.max(0, Math.round(vx - 2)), y: Math.max(0, Math.round(vy - fontHeight * 0.5)) },
        { x: Math.max(0, Math.round(vx + 4)), y: Math.max(0, Math.round(vy - fontHeight - 1)) },
        { x: Math.max(0, Math.round(vx + 4)), y: Math.min(ctx.canvas.height - 1, Math.round(vy + 1)) },
      ];
      for (const pt of samplePoints) {
        if (pt.x < ctx.canvas.width && pt.y < ctx.canvas.height) {
          const pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
          if (pixel[3] > 80) {
            const brightness = pixel[0] + pixel[1] + pixel[2];
            // If it's a bright background pixel (not dark text), pick it
            if (brightness > 480) {
              if (pixel[0] > 248 && pixel[1] > 248 && pixel[2] > 248) return "#ffffff";
              return "#" + [pixel[0], pixel[1], pixel[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
            }
          }
        }
      }
      return "#ffffff";
    } catch {
      return "#ffffff";
    }
  };

  // Background extraction of all pages for Global Find & Replace with accurate sampled colors
  const extractAllPagesText = async (pdf: any) => {
    const allItems: DetectedTextItem[] = [];
    try {
      const offscreenCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
      const offscreenCtx = offscreenCanvas?.getContext("2d");

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();

        let pageCtx: CanvasRenderingContext2D | null = null;
        if (offscreenCtx && offscreenCanvas) {
          offscreenCanvas.width = viewport.width;
          offscreenCanvas.height = viewport.height;
          try {
            await page.render({
              canvasContext: offscreenCtx,
              viewport,
            }).promise;
            pageCtx = offscreenCtx;
          } catch {
            pageCtx = null;
          }
        }

        textContent.items.forEach((item: any, idx: number) => {
          if (!item.str || !item.str.trim()) return;

          const tx = item.transform;
          const pdfFontSize = Math.round(Math.abs(tx[3] || tx[0] || 11) * 10) / 10;
          const fontHeight = pdfFontSize;
          const [vx, vy] = viewport.convertToViewportPoint(tx[4], tx[5]);
          const itemWidth = item.width ? item.width : item.str.length * (fontHeight * 0.55);
          
          const style = textContent.styles[item.fontName];
          const ascent = style?.ascent || 0.85;
          const descent = style?.descent || -0.22;
          const itemHeight = Math.max(12, (ascent - descent) * fontHeight);

          const family = resolveFontFamily(item.fontName, style?.fontFamily);
          const isBold = resolveIsBold(item.fontName, style?.fontFamily, style?.fontWeight);
          const isItalic = resolveIsItalic(item.fontName, style?.fontFamily);

          const sampledColor = pageCtx
            ? sampleTextColor(pageCtx, vx, vy, fontHeight, itemWidth)
            : "#000000";
          const sampledBg = pageCtx
            ? sampleBgColor(pageCtx, vx, vy, fontHeight)
            : "#ffffff";

          allItems.push({
            id: `det_all_${p}_${idx}`,
            str: item.str,
            x: vx,
            y: vy - ascent * fontHeight,
            width: itemWidth,
            height: itemHeight,
            fontSize: pdfFontSize,
            pdfFontSize,
            pdfX: tx[4],
            pdfY: tx[5],
            pdfWidth: item.width || 0,
            ascent,
            descent,
            detectedColor: sampledColor,
            detectedBgColor: sampledBg,
            fontFamily: family,
            isBold,
            isItalic,
            page: p,
          });
        });
      }
      setAllDocDetectedItems(allItems);
    } catch (e) {
      console.warn("Could not scan all pages for find & replace:", e);
    }
  };

  // Render active page on canvas and extract text coordinates
  useEffect(() => {
    if (!pdfDocProxy || !canvasRef.current) return;
    let renderTask: any = null;

    async function renderPage() {
      try {
        const page = await pdfDocProxy.getPage(currentPage);
        const viewport = page.getViewport({ scale: zoomScale });
        setPageViewport(viewport);

        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({
          canvasContext: context,
          viewport,
        });
        await renderTask.promise;

        // Extract text items for active page with precise baseline & canvas sampled color
        try {
          const textContent = await page.getTextContent();
          const extracted: DetectedTextItem[] = [];

          textContent.items.forEach((item: any, idx: number) => {
            if (!item.str || !item.str.trim()) return;

            const tx = item.transform;
            const pdfFontSize = Math.round(Math.abs(tx[3] || tx[0] || 11) * 10) / 10;
            const fontHeight = pdfFontSize * zoomScale;
            const [vx, vy] = viewport.convertToViewportPoint(tx[4], tx[5]);

            const itemWidth = item.width ? item.width * zoomScale : item.str.length * (fontHeight * 0.55);

            const style = textContent.styles[item.fontName];
            const ascent = style?.ascent || 0.85;
            const descent = style?.descent || -0.22;
            const itemHeight = Math.max(12, (ascent - descent) * fontHeight);

            const family = resolveFontFamily(item.fontName, style?.fontFamily);
            const isBold = resolveIsBold(item.fontName, style?.fontFamily, style?.fontWeight);
            const isItalic = resolveIsItalic(item.fontName, style?.fontFamily);

            // Sample exact text color and surrounding background color from canvas
            const sampledColor = sampleTextColor(context, vx, vy, fontHeight, itemWidth);
            const sampledBg = sampleBgColor(context, vx, vy, fontHeight);

            extracted.push({
              id: `det_${currentPage}_${idx}`,
              str: item.str,
              x: vx,
              y: vy - ascent * fontHeight,
              width: itemWidth,
              height: itemHeight,
              fontSize: pdfFontSize,
              pdfFontSize,
              pdfX: tx[4],
              pdfY: tx[5],
              pdfWidth: item.width || 0,
              ascent,
              descent,
              detectedColor: sampledColor,
              detectedBgColor: sampledBg,
              fontFamily: family,
              isBold,
              isItalic,
              page: currentPage,
            });
          });

          setDetectedTextItems(extracted);
        } catch (e) {
          console.warn("Could not extract embedded text items:", e);
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Render error:", err);
        }
      }
    }

    renderPage();
    return () => {
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDocProxy, currentPage, zoomScale]);

  // Execute Find & Replace Across Entire Document without duplicate stacking
  const handleExecuteFindReplace = (scope: "page" | "all") => {
    if (!findWord.trim()) return;

    // 1. Update matching items already in textElements (prior edits)
    let updatedExisting = textElements.map((txt) => {
      if (scope === "page" && txt.page !== currentPage) return txt;
      let isMatch = false;
      if (matchCase) {
        isMatch = txt.text.includes(findWord);
      } else {
        isMatch = txt.text.toLowerCase().includes(findWord.toLowerCase());
      }
      if (!isMatch) return txt;
      const replaced = matchCase
        ? txt.text.replaceAll(findWord, replaceWord)
        : txt.text.replaceAll(new RegExp(findWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replaceWord);
      return {
        ...txt,
        text: replaced,
      };
    });

    // 2. Find matches in detected PDF text
    const targetList = scope === "page" ? detectedTextItems : allDocDetectedItems;
    const matches = targetList.filter((item) => {
      if (matchCase) {
        return item.str.includes(findWord);
      }
      return item.str.toLowerCase().includes(findWord.toLowerCase());
    });

    let replacementsAdded = 0;
    const newReplacements: TextElement[] = [];

    matches.forEach((item) => {
      // Check if this item is ALREADY covered by an existing element in updatedExisting
      const alreadyHandled = updatedExisting.some(
        (t) =>
          t.page === item.page &&
          ((t.pdfX !== undefined && item.pdfX !== undefined && Math.abs(t.pdfX - item.pdfX) < 10 && Math.abs(t.pdfY! - item.pdfY!) < 6) ||
           (Math.abs(t.x - item.x) < 12 && Math.abs(t.y - item.y) < 12))
      );
      if (alreadyHandled) return;

      let replacedStr = item.str;
      if (matchCase) {
        replacedStr = item.str.replaceAll(findWord, replaceWord);
      } else {
        const regex = new RegExp(findWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        replacedStr = item.str.replaceAll(regex, replaceWord);
      }

      newReplacements.push({
        id: "rep_" + item.page + "_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        page: item.page,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        text: replacedStr,
        fontSize: item.pdfFontSize || 10,
        color: item.detectedColor || "#000000",
        fontFamily: item.fontFamily || "Helvetica",
        isBold: !!item.isBold,
        isItalic: !!item.isItalic,
        align: "left",
        isBackgroundBlock: true,
        bgColor: item.detectedBgColor || "#ffffff",
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        pdfOriginalWidth: item.pdfWidth,
        ascent: item.ascent,
        descent: item.descent,
        maskPadding: 0,
      });
      replacementsAdded++;
    });

    const updatedCount = updatedExisting.filter((t, i) => t.text !== textElements[i].text).length;
    const totalCount = replacementsAdded + updatedCount;

    if (totalCount === 0) {
      setFindReplaceStats(`No matches found for "${findWord}".`);
      return;
    }

    const nextTexts = [...updatedExisting, ...newReplacements];
    setTextElements(nextTexts);
    pushHistory(nextTexts, eraseBoxes);

    setFindReplaceStats(
      `Successfully replaced in ${totalCount} place(s) across the ${scope === "page" ? "current page" : "entire document"}!`
    );
    setTimeout(() => {
      setIsFindReplaceOpen(false);
      setFindReplaceStats(null);
    }, 2000);
  };

  // Direct Click to Edit on any detected existing word
  const handleExistingTextClick = (item: DetectedTextItem, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if an existing edit already covers this word in textElements
    const existing = textElements.find(
      (t) =>
        t.page === currentPage &&
        ((t.pdfX !== undefined && item.pdfX !== undefined && Math.abs(t.pdfX - item.pdfX) < 10 && Math.abs(t.pdfY! - item.pdfY!) < 6) ||
         (Math.abs(t.x - item.x) < 12 && Math.abs(t.y - item.y) < 12))
    );

    if (existing) {
      if (e.shiftKey) {
        setSelectedIds((prev) => (prev.includes(existing.id) ? prev.filter((x) => x !== existing.id) : [...prev, existing.id]));
      } else {
        setSelectedIds([existing.id]);
      }
      return;
    }

    const newReplacement: TextElement = {
      id: "txt_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      page: currentPage,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      text: item.str,
      fontSize: item.pdfFontSize || 10,
      color: item.detectedColor || "#000000",
      fontFamily: item.fontFamily || "Helvetica",
      isBold: !!item.isBold,
      isItalic: !!item.isItalic,
      align: "left",
      isBackgroundBlock: true,
      bgColor: item.detectedBgColor || "#ffffff",
      pdfX: item.pdfX,
      pdfY: item.pdfY,
      pdfOriginalWidth: item.pdfWidth,
      ascent: item.ascent,
      descent: item.descent,
      maskPadding: 0,
    };

    const nextTexts = [...textElements, newReplacement];
    setTextElements(nextTexts);
    pushHistory(nextTexts, eraseBoxes);

    if (e.shiftKey) {
      setSelectedIds((prev) => [...prev, newReplacement.id]);
    } else {
      setSelectedIds([newReplacement.id]);
    }
  };

  // Erase existing word directly with 1 click
  const handleExistingTextErase = (item: DetectedTextItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const newErase: EraseBox = {
      id: "erase_" + Date.now(),
      page: currentPage,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      color: "#ffffff",
    };
    const nextErases = [...eraseBoxes, newErase];
    setEraseBoxes(nextErases);
    pushHistory(textElements, nextErases);
  };

  // Canvas Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !pageViewport) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (activeTool === "erase-drag") {
      setIsDrawingErase(true);
      setEraseStartPos({ x: clickX, y: clickY });
      setCurrentDragBox({ x: clickX, y: clickY, width: 0, height: 0 });
    } else if (activeTool === "add-text") {
      const newElem: TextElement = {
        id: "txt_" + Date.now(),
        page: currentPage,
        x: Math.max(10, clickX - 20),
        y: Math.max(10, clickY - 10),
        text: "New Text",
        fontSize: 14,
        color: "#000000",
        fontFamily: "Helvetica",
        isBold: false,
        isItalic: false,
        align: "left",
        isBackgroundBlock: false,
        bgColor: "#ffffff",
      };
      const nextTexts = [...textElements, newElem];
      setTextElements(nextTexts);
      pushHistory(nextTexts, eraseBoxes);
      setSelectedIds([newElem.id]);
    } else if (activeTool === "select") {
      setSelectedIds([]);
    }
  };

  // Canvas Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (isDrawingErase && eraseStartPos) {
      const x = Math.min(eraseStartPos.x, currentX);
      const y = Math.min(eraseStartPos.y, currentY);
      const width = Math.abs(currentX - eraseStartPos.x);
      const height = Math.abs(currentY - eraseStartPos.y);
      setCurrentDragBox({ x, y, width, height });
    } else if (draggedElementId) {
      setTextElements((prev) =>
        prev.map((item) =>
          item.id === draggedElementId
            ? { ...item, x: currentX - dragOffset.x, y: currentY - dragOffset.y }
            : item
        )
      );
    }
  };

  // Canvas Mouse Up
  const handleMouseUp = () => {
    if (isDrawingErase && currentDragBox && currentDragBox.width > 3 && currentDragBox.height > 3) {
      const nextErases = [
        ...eraseBoxes,
        {
          id: "erase_" + Date.now(),
          page: currentPage,
          ...currentDragBox,
          color: "#ffffff",
        },
      ];
      setEraseBoxes(nextErases);
      pushHistory(textElements, nextErases);
    }
    setIsDrawingErase(false);
    setEraseStartPos(null);
    setCurrentDragBox(null);
    if (draggedElementId) {
      pushHistory(textElements, eraseBoxes);
      setDraggedElementId(null);
    }
  };

  // Batch Update helper for selected text items
  const updateSelectedProps = (updates: Partial<TextElement>) => {
    const nextTexts = textElements.map((item) => {
      if (selectedIds.includes(item.id)) {
        return { ...item, ...updates };
      }
      return item;
    });
    setTextElements(nextTexts);
    pushHistory(nextTexts, eraseBoxes);
  };

  // Export modified PDF
  const handleExportPdf = async () => {
    if (!pageViewport) return;
    setIsProcessing(true);
    setStatusMsg("Applying text changes, erasures, and font styles...");

    try {
      const originalBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();

      const fonts = {
        Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
        HelveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        HelveticaOblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
        HelveticaBoldOblique: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
        Times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
        TimesBold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
        TimesItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
        TimesBoldItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
        Courier: await pdfDoc.embedFont(StandardFonts.Courier),
        CourierBold: await pdfDoc.embedFont(StandardFonts.CourierBold),
        CourierOblique: await pdfDoc.embedFont(StandardFonts.CourierOblique),
        CourierBoldOblique: await pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
      };

      const resolveFont = (family: "Helvetica" | "Times" | "Courier", isBold: boolean, isItalic: boolean) => {
        if (family === "Times") {
          if (isBold && isItalic) return fonts.TimesBoldItalic;
          if (isBold) return fonts.TimesBold;
          if (isItalic) return fonts.TimesItalic;
          return fonts.Times;
        }
        if (family === "Courier") {
          if (isBold && isItalic) return fonts.CourierBoldOblique;
          if (isBold) return fonts.CourierBold;
          if (isItalic) return fonts.CourierOblique;
          return fonts.Courier;
        }
        if (isBold && isItalic) return fonts.HelveticaBoldOblique;
        if (isBold) return fonts.HelveticaBold;
        if (isItalic) return fonts.HelveticaOblique;
        return fonts.Helvetica;
      };

      const hexToRgb = (hex: string) => {
        const clean = hex.replace("#", "");
        const num = parseInt(clean, 16);
        return {
          r: ((num >> 16) & 255) / 255,
          g: ((num >> 8) & 255) / 255,
          b: (num & 255) / 255,
        };
      };

      // 1. Draw all Erase Boxes (Whiteouts)
      for (const box of eraseBoxes) {
        const targetPage = pages[box.page - 1];
        if (!targetPage) continue;
        const { height: pdfHeight, width: pdfWidth } = targetPage.getSize();
        const scaleX = pdfWidth / pageViewport.width;
        const scaleY = pdfHeight / pageViewport.height;

        const c = hexToRgb(box.color);
        targetPage.drawRectangle({
          x: box.x * scaleX,
          y: pdfHeight - (box.y + box.height) * scaleY,
          width: box.width * scaleX,
          height: box.height * scaleY,
          color: rgb(c.r, c.g, c.b),
        });
      }

      // 2. Draw all Text Additions and Replacements
      for (const txt of textElements) {
        const targetPage = pages[txt.page - 1];
        if (!targetPage) continue;
        const { height: pdfHeight, width: pdfWidth } = targetPage.getSize();
        const scaleX = pdfWidth / pageViewport.width;
        const scaleY = pdfHeight / pageViewport.height;

        const font = resolveFont(txt.fontFamily, txt.isBold, txt.isItalic);
        let fontSize = txt.fontSize;
        let textWidth = font.widthOfTextAtSize(txt.text, fontSize);

        const ascent = txt.ascent ? Math.max(0.82, txt.ascent) : 0.85;
        const descent = txt.descent ? Math.abs(txt.descent) : 0.22;
        const maskPad = txt.maskPadding ?? 0;

        // Determine exact baseline X & Y in PDF coordinates
        let baselineX: number;
        let baselineY: number;

        if (txt.pdfX !== undefined && txt.pdfY !== undefined) {
          baselineX = txt.pdfX;
          baselineY = txt.pdfY;
        } else {
          baselineX = txt.x * scaleX;
          // In viewport coordinates, txt.y is the top-left of the box:
          baselineY = pdfHeight - (txt.y * scaleY + ascent * fontSize);
        }

        const origWidth = txt.pdfOriginalWidth ?? (txt.width ? txt.width * scaleX : textWidth);

        // Table & column fit protection: if replacement text exceeds the column width / original boundary
        if (txt.pdfOriginalWidth && textWidth > txt.pdfOriginalWidth * 1.05 && txt.pdfOriginalWidth > 35) {
          const fitRatio = txt.pdfOriginalWidth / textWidth;
          fontSize = Math.max(fontSize * 0.88, fontSize * fitRatio);
          textWidth = font.widthOfTextAtSize(txt.text, fontSize);
        }

        // Complete, impenetrable whiteout covering ascenders, descenders, and side margins
        const maskWidth = Math.max(origWidth, textWidth) + maskPad * 2 + 1;
        const maskHeight = fontSize * (ascent + descent) + maskPad * 2;
        const maskY = baselineY - (descent * fontSize) - maskPad;
        const maskX = baselineX - maskPad - 0.5;

        let drawX = baselineX;
        if (txt.align === "center") {
          drawX = baselineX + (maskWidth - textWidth) / 2;
        } else if (txt.align === "right") {
          drawX = baselineX + (maskWidth - textWidth);
        }

        // Only draw background mask if user enabled it! If false, background remains 100% transparent.
        const shouldMask = txt.isBackgroundBlock === true;
        if (shouldMask) {
          const bgRgb = hexToRgb(txt.bgColor || "#ffffff");
          targetPage.drawRectangle({
            x: maskX,
            y: maskY,
            width: maskWidth,
            height: maskHeight,
            color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
          });
        }

        // Draw text at EXACT font baseline
        const textColor = hexToRgb(txt.color);
        targetPage.drawText(txt.text, {
          x: drawX,
          y: baselineY,
          size: fontSize,
          font,
          color: rgb(textColor.r, textColor.g, textColor.b),
        });
      }

      const modifiedBytes = await pdfDoc.save();
      downloadFile(modifiedBytes, `${file.name.replace(/\.pdf$/i, "")}_edited.pdf`);
    } catch (err: any) {
      alert("Error saving edited document: " + (err.message || String(err)));
    } finally {
      setIsProcessing(false);
      setStatusMsg("");
    }
  };

  const selectedElements = textElements.filter((t) => selectedIds.includes(t.id));
  const primarySelected = selectedElements[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top Studio Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            &larr; Exit Editor
          </button>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <span>Edit PDF Pro</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Auto-Saved &bull; Find &amp; Replace
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-sm">
              {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          </div>
        </div>

        {/* Action Tools Palette */}
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 pr-1 border-r border-zinc-300 dark:border-zinc-700">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 transition-all cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 transition-all cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* 1. DIRECT CLICK-TO-EDIT EXISTING TEXT */}
          <button
            onClick={() => setActiveTool("edit-text")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "edit-text"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
            title="Click directly on any existing word or number to edit it in place"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Click to Edit</span>
          </button>

          {/* 2. FIND & REPLACE BUTTON */}
          <button
            onClick={() => setIsFindReplaceOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm cursor-pointer transition-all"
            title="Find & Replace words across document (Ctrl+F)"
          >
            <Replace className="w-3.5 h-3.5" />
            <span>Find &amp; Replace</span>
          </button>

          {/* 3. ERASE BOX (DRAG) */}
          <button
            onClick={() => setActiveTool("erase-drag")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "erase-drag"
                ? "bg-rose-600 text-white shadow-md shadow-rose-500/30 scale-105"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            }`}
            title="Click and drag across any word, sentence, or table row to erase it"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Erase Area</span>
          </button>

          {/* 4. ADD NEW TEXT */}
          <button
            onClick={() => setActiveTool("add-text")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "add-text"
                ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
            title="Click anywhere to insert new text"
          >
            <Type className="w-3.5 h-3.5" />
            <span>+ Add Text</span>
          </button>

          {/* 5. MOVE / MULTI-SELECT */}
          <button
            onClick={() => setActiveTool("select")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "select"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
            title="Select & drag multiple text items (Hold Shift to select multiple)"
          >
            <Move className="w-3.5 h-3.5" />
            <span>Move</span>
          </button>

          <div className="h-5 w-[1px] bg-zinc-300 dark:bg-zinc-700 mx-1" />

          {/* Zoom Controls */}
          <button
            onClick={() => setZoomScale((z) => Math.max(0.75, z - 0.25))}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 w-12 text-center">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.25))}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Action Controls: Reset, Save in App & Download PDF */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAllEdits}
            className="px-3.5 py-2.5 rounded-2xl bg-zinc-200 dark:bg-zinc-800 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-zinc-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Clear all edits and start fresh with original document"
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
            <span>Reset / Clear All</span>
          </button>

          <button
            onClick={handleManualSave}
            className="px-3.5 py-2.5 rounded-2xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Save all changes locally in app (Ctrl+S)"
          >
            <Save className="w-4 h-4 text-blue-500" />
            <span>Save in App</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 cursor-pointer transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{statusMsg || "Saving..."}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Notification Toast */}
      {savedNotification && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedNotification}</span>
        </div>
      )}

      {/* Formatting Ribbon (Microsoft Word Style) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 px-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Bold, Italic Buttons */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => updateSelectedProps({ isBold: !(primarySelected?.isBold) })}
              disabled={selectedIds.length === 0}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                primarySelected?.isBold
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => updateSelectedProps({ isItalic: !(primarySelected?.isItalic) })}
              disabled={selectedIds.length === 0}
              className={`p-1.5 rounded-lg text-xs font-italic transition-all cursor-pointer ${
                primarySelected?.isItalic
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-4 h-4" />
            </button>
          </div>

          {/* Alignment Buttons: Left, Center, Right */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => updateSelectedProps({ align: "left" })}
              disabled={selectedIds.length === 0}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                primarySelected?.align === "left" || !primarySelected?.align
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
              title="Align Left"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => updateSelectedProps({ align: "center" })}
              disabled={selectedIds.length === 0}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                primarySelected?.align === "center"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
              title="Align Center"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              onClick={() => updateSelectedProps({ align: "right" })}
              disabled={selectedIds.length === 0}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                primarySelected?.align === "right"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
              title="Align Right"
            >
              <AlignRight className="w-4 h-4" />
            </button>
          </div>

          {/* Font Family Selector */}
          <select
            value={primarySelected?.fontFamily || "Helvetica"}
            onChange={(e) => updateSelectedProps({ fontFamily: e.target.value as any })}
            disabled={selectedIds.length === 0}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
          >
            <option value="Helvetica">Arial / Helvetica (Sans)</option>
            <option value="Times">Times New Roman (Serif)</option>
            <option value="Courier">Courier New (Monospace)</option>
          </select>

          {/* Font Size Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 font-medium">Size:</span>
            <input
              type="number"
              min={6}
              max={72}
              value={primarySelected ? primarySelected.fontSize : 10}
              onChange={(e) => updateSelectedProps({ fontSize: parseInt(e.target.value, 10) || 10 })}
              disabled={selectedIds.length === 0}
              className="w-14 px-2 py-1 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-center"
            />
          </div>

          {/* Font Color Picker with Quick Swatches */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400 font-medium">Color:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => updateSelectedProps({ color: "#000000" })}
                disabled={selectedIds.length === 0}
                className="w-5 h-5 rounded-full bg-black border border-zinc-400 hover:scale-110 transition-transform cursor-pointer"
                title="Black (#000000)"
              />
              <button
                type="button"
                onClick={() => updateSelectedProps({ color: "#0000ee" })}
                disabled={selectedIds.length === 0}
                className="w-5 h-5 rounded-full bg-blue-600 border border-zinc-400 hover:scale-110 transition-transform cursor-pointer"
                title="Table Link Blue (#0000ee)"
              />
              <button
                type="button"
                onClick={() => updateSelectedProps({ color: "#cc0000" })}
                disabled={selectedIds.length === 0}
                className="w-5 h-5 rounded-full bg-red-600 border border-zinc-400 hover:scale-110 transition-transform cursor-pointer"
                title="Table Red (#cc0000)"
              />
              <input
                type="color"
                value={primarySelected?.color || "#000000"}
                onChange={(e) => updateSelectedProps({ color: e.target.value })}
                disabled={selectedIds.length === 0}
                className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 ml-0.5"
                title="Custom Color"
              />
            </div>
          </div>

          {/* Mask Padding / Table Safe selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400 font-medium">Fit:</span>
            <select
              value={primarySelected?.maskPadding ?? 0}
              onChange={(e) => updateSelectedProps({ maskPadding: parseInt(e.target.value, 10) || 0 })}
              disabled={selectedIds.length === 0}
              className="px-2 py-1 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
              title="Mask fit around text: 0px is Table-Safe and will never clip table lines"
            >
              <option value={0}>0px (Table Safe)</option>
              <option value={1}>1px (Normal)</option>
              <option value={2}>2px (Wide)</option>
            </select>
          </div>

          {/* Background Mode: Mask vs Transparent */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => updateSelectedProps({ isBackgroundBlock: true })}
              disabled={selectedIds.length === 0}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                primarySelected?.isBackgroundBlock !== false
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
              title="Mask Background: Whiteout underlying text with auto-matched color"
            >
              Mask
            </button>
            <button
              type="button"
              onClick={() => updateSelectedProps({ isBackgroundBlock: false })}
              disabled={selectedIds.length === 0}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                primarySelected?.isBackgroundBlock === false
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
              }`}
              title="Transparent: No background fill or whiteout box"
            >
              Transparent
            </button>
            {primarySelected?.isBackgroundBlock !== false && (
              <input
                type="color"
                value={primarySelected?.bgColor || "#ffffff"}
                onChange={(e) => updateSelectedProps({ bgColor: e.target.value })}
                disabled={selectedIds.length === 0}
                className="w-5 h-5 rounded cursor-pointer border-0 p-0 ml-0.5"
                title="Mask Color"
              />
            )}
          </div>
        </div>

        {/* Selection Status indicator */}
        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {selectedIds.length > 1 ? (
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              ⚡ Multi-Selected: {selectedIds.length} items (editing together)
            </span>
          ) : selectedIds.length === 1 ? (
            <span>1 item selected</span>
          ) : (
            <span className="opacity-75">Click any text to format (Hold Shift for multiple)</span>
          )}
        </div>
      </div>

      {/* Editor Main Canvas & Property Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Canvas Workspace Area */}
        <div className="lg:col-span-3 flex flex-col items-center">
          {/* Page Paginator */}
          <div className="flex items-center gap-3 mb-3 bg-white dark:bg-zinc-900 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs shadow-sm">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 disabled:opacity-30 hover:text-blue-500 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 disabled:opacity-30 hover:text-blue-500 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Page Container */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`relative rounded-2xl border shadow-2xl bg-white overflow-hidden transition-all select-none ${
              activeTool === "erase-drag"
                ? "cursor-crosshair ring-2 ring-rose-500/50"
                : activeTool === "edit-text"
                ? "cursor-pointer ring-2 ring-blue-500/50"
                : activeTool === "add-text"
                ? "cursor-text ring-2 ring-purple-500/50"
                : "cursor-default border-zinc-300 dark:border-zinc-700"
            }`}
          >
            <canvas ref={canvasRef} className="block pointer-events-none" />

            {/* Click-to-Edit Layer: Overlays detected words directly on the page */}
            {activeTool === "edit-text" &&
              detectedTextItems.map((item) => (
                <div
                  key={item.id}
                  onClick={(e) => handleExistingTextClick(item, e)}
                  style={{
                    position: "absolute",
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                    width: `${item.width}px`,
                    height: `${item.height}px`,
                  }}
                  className="group hover:bg-blue-500/20 hover:ring-1 hover:ring-blue-500/70 rounded cursor-pointer transition-all"
                  title={`Click to edit: "${item.str}" (Shift+Click to multi-select)`}
                >
                  <button
                    onClick={(e) => handleExistingTextErase(item, e)}
                    className="absolute -top-3 -right-3 p-1 rounded-full bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow text-[9px] z-20 cursor-pointer"
                    title="Quick Erase Word"
                  >
                    <Eraser className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}

            {/* Overlaid Erase Boxes (Whiteouts) */}
            {eraseBoxes
              .filter((r) => r.page === currentPage)
              .map((box) => (
                <div
                  key={box.id}
                  style={{
                    position: "absolute",
                    left: `${box.x}px`,
                    top: `${box.y}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                    backgroundColor: box.color,
                  }}
                  className="border border-dashed border-zinc-400/60 group shadow-sm z-10"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextErases = eraseBoxes.filter((x) => x.id !== box.id);
                      setEraseBoxes(nextErases);
                      pushHistory(textElements, nextErases);
                    }}
                    className="absolute -top-3 -right-3 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow z-20 cursor-pointer"
                    title="Undo Erase"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}

            {/* Active Drawing Drag Box */}
            {currentDragBox && (
              <div
                style={{
                  position: "absolute",
                  left: `${currentDragBox.x}px`,
                  top: `${currentDragBox.y}px`,
                  width: `${currentDragBox.width}px`,
                  height: `${currentDragBox.height}px`,
                }}
                className="bg-rose-500/30 border-2 border-dashed border-rose-600 pointer-events-none z-30"
              />
            )}

            {/* Overlaid Text Additions / Replacements */}
            {textElements
              .filter((t) => t.page === currentPage)
              .map((txt) => {
                const isSelected = selectedIds.includes(txt.id);
                return (
                  <div
                    key={txt.id}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey) {
                        setSelectedIds((prev) =>
                          prev.includes(txt.id) ? prev.filter((x) => x !== txt.id) : [...prev, txt.id]
                        );
                      } else {
                        setSelectedIds([txt.id]);
                      }

                      if (activeTool === "select") {
                        setDraggedElementId(txt.id);
                        setDragOffset({
                          x: e.clientX - (containerRef.current?.getBoundingClientRect().left || 0) - txt.x,
                          y: e.clientY - (containerRef.current?.getBoundingClientRect().top || 0) - txt.y,
                        });
                      }
                    }}
                    style={{
                      position: "absolute",
                      left: `${txt.x}px`,
                      top: `${txt.y}px`,
                      minWidth: txt.width ? `${txt.width}px` : undefined,
                      whiteSpace: "nowrap",
                      fontSize: `${txt.fontSize * zoomScale}px`,
                      lineHeight: "1.15",
                      color: txt.color,
                      fontFamily:
                        txt.fontFamily === "Times"
                          ? "'Times New Roman', Times, serif"
                          : txt.fontFamily === "Courier"
                          ? "'Courier New', Courier, monospace"
                          : "Arial, Helvetica, sans-serif",
                      fontWeight: txt.isBold ? "bold" : "normal",
                      fontStyle: txt.isItalic ? "italic" : "normal",
                      textAlign: txt.align,
                      backgroundColor: txt.isBackgroundBlock ? txt.bgColor || "#ffffff" : "transparent",
                    }}
                    className={`px-0.5 rounded cursor-move border transition-all z-20 ${
                      isSelected
                        ? "border-blue-500 shadow-md ring-1 ring-blue-500/50"
                        : "border-transparent hover:border-zinc-300"
                    }`}
                  >
                    <span>{txt.text}</span>
                  </div>
                );
              })}
          </div>

          <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 mt-3 text-center">
            {activeTool === "edit-text" && "👆 Click any text on the document to edit it. Press Ctrl+F for Find & Replace. Hold Shift for multi-select!"}
            {activeTool === "erase-drag" && "🎯 Click and drag your mouse across any word, number, or line to erase it permanently."}
            {activeTool === "add-text" && "✍️ Click anywhere on the document to place new text or numbers."}
            {activeTool === "select" && "✋ Drag to move any text element. Use Ctrl+Z to Undo, Ctrl+Y to Redo."}
          </p>
        </div>

        {/* Text Properties & Words Palette Sidebar */}
        <div className="bg-white dark:bg-zinc-900/60 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 h-fit space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-blue-500" />
              Word &amp; Text Inspector
            </h3>
            {selectedIds.length > 0 && (
              <button
                onClick={() => {
                  const nextTexts = textElements.filter((x) => !selectedIds.includes(x.id));
                  setTextElements(nextTexts);
                  pushHistory(nextTexts, eraseBoxes);
                  setSelectedIds([]);
                }}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedIds.length})
              </button>
            )}
          </div>

          {selectedElements.length > 0 ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1.5">
                  {selectedElements.length > 1
                    ? `Editing ${selectedElements.length} Selected Items (Text field updates all)`
                    : "Content / Replacement Text"}
                </label>
                <textarea
                  rows={2}
                  value={primarySelected?.text || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const nextTexts = textElements.map((item) =>
                      selectedIds.includes(item.id) ? { ...item, text: val } : item
                    );
                    setTextElements(nextTexts);
                    pushHistory(nextTexts, eraseBoxes);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Exact Position coordinates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">X Position (px)</label>
                  <input
                    type="number"
                    value={Math.round(primarySelected?.x || 0)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      updateSelectedProps({ x: val });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Y Position (px)</label>
                  <input
                    type="number"
                    value={Math.round(primarySelected?.y || 0)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      updateSelectedProps({ y: val });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Box Width */}
              <div>
                <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Text Box Width (px)</label>
                <input
                  type="number"
                  value={Math.round(primarySelected?.width || 100)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 100;
                    updateSelectedProps({ width: val });
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-semibold"
                />
              </div>

              {/* Typography controls in Inspector */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Font Size (pt)</label>
                  <input
                    type="number"
                    min={6}
                    max={72}
                    value={primarySelected ? primarySelected.fontSize : 10}
                    onChange={(e) => updateSelectedProps({ fontSize: parseInt(e.target.value, 10) || 10 })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Font Family</label>
                  <select
                    value={primarySelected?.fontFamily || "Helvetica"}
                    onChange={(e) => updateSelectedProps({ fontFamily: e.target.value as any })}
                    className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-semibold"
                  >
                    <option value="Helvetica">Helvetica / Arial</option>
                    <option value="Times">Times New Roman</option>
                    <option value="Courier">Courier New</option>
                  </select>
                </div>
              </div>

              {/* Text Color & Quick Swatches */}
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primarySelected?.color || "#000000"}
                    onChange={(e) => updateSelectedProps({ color: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                  />
                  <span className="text-xs font-mono text-zinc-600 dark:text-zinc-300">
                    {primarySelected?.color || "#000000"}
                  </span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => updateSelectedProps({ color: "#000000" })}
                      className="px-2 py-1 text-[10px] font-bold rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:border-black cursor-pointer"
                    >
                      Black
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedProps({ color: "#0000ee" })}
                      className="px-2 py-1 text-[10px] font-bold rounded bg-blue-50 text-blue-600 border border-blue-200 hover:border-blue-500 cursor-pointer"
                    >
                      Blue
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedProps({ color: "#cc0000" })}
                      className="px-2 py-1 text-[10px] font-bold rounded bg-red-50 text-red-600 border border-red-200 hover:border-red-500 cursor-pointer"
                    >
                      Red
                    </button>
                  </div>
                </div>
              </div>

              {/* Mask Background & Table-Safe Padding Toggle */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1 font-medium">
                    Background Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateSelectedProps({ isBackgroundBlock: true })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        primarySelected?.isBackgroundBlock !== false
                          ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      ⚪ Mask Background
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedProps({ isBackgroundBlock: false })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        primarySelected?.isBackgroundBlock === false
                          ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      🔲 Transparent
                    </button>
                  </div>
                </div>

                {primarySelected?.isBackgroundBlock !== false && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Mask Fill Color:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={primarySelected?.bgColor || "#ffffff"}
                        onChange={(e) => updateSelectedProps({ bgColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                      />
                      <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                        {primarySelected?.bgColor || "#ffffff"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Mask Border Safety:</span>
                  <select
                    value={primarySelected?.maskPadding ?? 0}
                    onChange={(e) => updateSelectedProps({ maskPadding: parseInt(e.target.value, 10) || 0 })}
                    className="px-2 py-1 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value={0}>0px (Table Safe &mdash; No Bleed)</option>
                    <option value={1}>1px (Normal Padding)</option>
                    <option value={2}>2px (Wide Padding)</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-2 text-zinc-400 text-xs leading-relaxed space-y-1">
                <Edit3 className="w-6 h-6 mx-auto text-blue-500 opacity-60" />
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">Click Any Word to Edit It</p>
                <p>Or open Find &amp; Replace (Ctrl+F) to replace words in batch.</p>
              </div>

              {/* Quick Search & Detected Words Picker */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search words on this page..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {detectedTextItems
                    .filter((i) => (searchFilter ? i.str.toLowerCase().includes(searchFilter.toLowerCase()) : true))
                    .slice(0, 50)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={(e) => handleExistingTextClick(item, e)}
                        className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50 hover:border-blue-500 cursor-pointer text-xs group"
                      >
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]">
                          {item.str}
                        </span>
                        <button
                          onClick={(e) => handleExistingTextErase(item, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-rose-500 hover:text-rose-600 transition-opacity cursor-pointer"
                          title="Erase"
                        >
                          <Eraser className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Find and Replace Modal */}
      {isFindReplaceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <Replace className="w-5 h-5 text-amber-500" />
                Find &amp; Replace in Document
              </h3>
              <button
                onClick={() => {
                  setIsFindReplaceOpen(false);
                  setFindReplaceStats(null);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">
                  Find Word or Phrase
                </label>
                <input
                  type="text"
                  value={findWord}
                  onChange={(e) => setFindWord(e.target.value)}
                  placeholder="e.g. Adarshapur or 25"
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-sm font-semibold"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 block mb-1">
                  Replace With
                </label>
                <input
                  type="text"
                  value={replaceWord}
                  onChange={(e) => setReplaceWord(e.target.value)}
                  placeholder="e.g. New Colony Road or 99"
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-sm font-semibold"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={matchCase}
                    onChange={(e) => setMatchCase(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-0"
                  />
                  <span>Match Case (Exact capitalization)</span>
                </label>
              </div>

              {findReplaceStats && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-xs font-medium text-amber-800 dark:text-amber-300">
                  {findReplaceStats}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => handleExecuteFindReplace("page")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer transition-all"
              >
                Replace on This Page
              </button>
              <button
                onClick={() => handleExecuteFindReplace("all")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/20 cursor-pointer transition-all"
              >
                Replace All in Entire PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
