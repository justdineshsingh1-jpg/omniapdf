"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  GitCompare,
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  CheckCircle,
  AlertCircle,
  FileText,
  Sliders,
  Eye,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { getPdfPageCount, renderPageThumbnail } from "@/lib/pdf-renderer";

interface ComparePdfProps {
  onBack: () => void;
}

export const ComparePdf: React.FC<ComparePdfProps> = ({ onBack }) => {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  const [pageCount1, setPageCount1] = useState<number>(1);
  const [pageCount2, setPageCount2] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [thumb1, setThumb1] = useState<string | null>(null);
  const [thumb2, setThumb2] = useState<string | null>(null);
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null);
  const [diffPercentage, setDiffPercentage] = useState<number>(0);

  const [viewMode, setViewMode] = useState<"side-by-side" | "diff-only">("side-by-side");
  const [isLoading, setIsLoading] = useState(false);

  // Load sample demo files
  const handleLoadDemo = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/panel_test.pdf");
      const blob = await res.blob();
      const f1 = new File([blob], "Panel_APDCL_Original_V1.pdf", { type: "application/pdf" });
      const f2 = new File([blob], "Panel_APDCL_Revised_V2.pdf", { type: "application/pdf" });
      setFile1(f1);
      setFile2(f2);
    } catch (err) {
      console.error("Demo load failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  // When files change, load page counts
  useEffect(() => {
    async function loadMeta() {
      if (file1) {
        const c1 = await getPdfPageCount(file1);
        setPageCount1(c1);
      }
      if (file2) {
        const c2 = await getPdfPageCount(file2);
        setPageCount2(c2);
      }
    }
    loadMeta();
  }, [file1, file2]);

  // Render current page for both files and compute pixel diff
  useEffect(() => {
    const f1 = file1;
    const f2 = file2;
    if (!f1 || !f2) return;
    let cancelled = false;

    async function computeDiff() {
      if (!f1 || !f2) return;
      setIsLoading(true);
      try {
        const t1 = await renderPageThumbnail(f1, Math.min(currentPage, pageCount1), 0.8);
        const t2 = await renderPageThumbnail(f2, Math.min(currentPage, pageCount2), 0.8);

        if (cancelled) return;
        setThumb1(t1);
        setThumb2(t2);

        // Compute pixel diff on offscreen canvases
        const img1 = new Image();
        const img2 = new Image();
        img1.src = t1;
        img2.src = t2;

        await Promise.all([
          new Promise((r) => (img1.onload = r)),
          new Promise((r) => (img2.onload = r)),
        ]);

        const w = Math.max(img1.width, img2.width);
        const h = Math.max(img1.height, img2.height);

        const canvasDiff = document.createElement("canvas");
        canvasDiff.width = w;
        canvasDiff.height = h;
        const ctxDiff = canvasDiff.getContext("2d");

        const canvas1 = document.createElement("canvas");
        canvas1.width = w;
        canvas1.height = h;
        const ctx1 = canvas1.getContext("2d");
        ctx1?.drawImage(img1, 0, 0);

        const canvas2 = document.createElement("canvas");
        canvas2.width = w;
        canvas2.height = h;
        const ctx2 = canvas2.getContext("2d");
        ctx2?.drawImage(img2, 0, 0);

        if (ctx1 && ctx2 && ctxDiff) {
          const d1 = ctx1.getImageData(0, 0, w, h).data;
          const d2 = ctx2.getImageData(0, 0, w, h).data;
          const outImgData = ctxDiff.createImageData(w, h);
          const out = outImgData.data;

          let diffPixels = 0;
          const totalPixels = w * h;

          for (let i = 0; i < d1.length; i += 4) {
            const rDiff = Math.abs(d1[i] - d2[i]);
            const gDiff = Math.abs(d1[i + 1] - d2[i + 1]);
            const bDiff = Math.abs(d1[i + 2] - d2[i + 2]);
            const delta = (rDiff + gDiff + bDiff) / 3;

            if (delta > 20) {
              diffPixels++;
              // Highlight modified pixel in vivid magenta/rose
              out[i] = 239;     // R
              out[i + 1] = 68;  // G
              out[i + 2] = 68;  // B
              out[i + 3] = 220; // Alpha
            } else {
              // Dim identical pixels in light grayscale
              const gray = Math.round((d1[i] + d1[i + 1] + d1[i + 2]) / 3);
              out[i] = gray;
              out[i + 1] = gray;
              out[i + 2] = gray;
              out[i + 3] = 70;
            }
          }

          ctxDiff.putImageData(outImgData, 0, 0);
          setDiffDataUrl(canvasDiff.toDataURL());
          setDiffPercentage(Math.round((diffPixels / totalPixels) * 1000) / 10);
        }
      } catch (err) {
        console.error("Diff error", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    computeDiff();
    return () => {
      cancelled = true;
    };
  }, [file1, file2, currentPage, pageCount1, pageCount2]);

  const maxPages = Math.max(pageCount1, pageCount2);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-indigo-400" />
              <span>Compare PDF Revisions</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Visual Diff
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Spot textual and layout changes side-by-side with pixel highlight overlays
            </p>
          </div>
        </div>

        {file1 && file2 && (
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="bg-zinc-800 rounded-xl p-1 flex items-center gap-1 border border-zinc-700">
              <button
                onClick={() => setViewMode("side-by-side")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "side-by-side" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                Side by Side
              </button>
              <button
                onClick={() => setViewMode("diff-only")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === "diff-only" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                Diff Highlight Overlay
              </button>
            </div>

            {/* Page Navigator */}
            <div className="flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-200">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ArrowLeftIcon className="w-3.5 h-3.5" />
              </button>
              <span>
                Page {currentPage} of {maxPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(maxPages, p + 1))}
                disabled={currentPage >= maxPages}
                className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Container */}
      {!file1 || !file2 ? (
        <div className="max-w-4xl mx-auto w-full p-8 flex flex-col items-center">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">Select Two PDF Documents to Compare</h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              Drop original and revised versions to visually pinpoint every modified word, number, or design shift.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
            {/* Slot 1: Original */}
            <div className="bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-800 p-8 flex flex-col items-center justify-center text-center">
              <FileText className="w-10 h-10 text-blue-400 mb-3" />
              <h3 className="font-bold text-sm text-white mb-1">
                {file1 ? file1.name : "Original PDF (V1)"}
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                {file1 ? `${pageCount1} pages` : "Select base document"}
              </p>
              <input
                type="file"
                accept="application/pdf"
                id="file1-input"
                className="hidden"
                onChange={(e) => e.target.files && setFile1(e.target.files[0])}
              />
              <button
                onClick={() => document.getElementById("file1-input")?.click()}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer border border-zinc-700"
              >
                {file1 ? "Change File" : "Choose V1 Document"}
              </button>
            </div>

            {/* Slot 2: Revised */}
            <div className="bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-800 p-8 flex flex-col items-center justify-center text-center">
              <FileText className="w-10 h-10 text-indigo-400 mb-3" />
              <h3 className="font-bold text-sm text-white mb-1">
                {file2 ? file2.name : "Revised PDF (V2)"}
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                {file2 ? `${pageCount2} pages` : "Select modified document"}
              </p>
              <input
                type="file"
                accept="application/pdf"
                id="file2-input"
                className="hidden"
                onChange={(e) => e.target.files && setFile2(e.target.files[0])}
              />
              <button
                onClick={() => document.getElementById("file2-input")?.click()}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer border border-zinc-700"
              >
                {file2 ? "Change File" : "Choose V2 Document"}
              </button>
            </div>
          </div>

          <button
            onClick={handleLoadDemo}
            className="px-5 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 border border-zinc-700 transition-all cursor-pointer shadow-md"
          >
            <RefreshCw className="w-4 h-4 text-indigo-400" />
            <span>Load Sample Revisions (Instant Demo)</span>
          </button>
        </div>
      ) : (
        /* Active Comparison View */
        <main className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col gap-4">
          {/* Status Bar */}
          <div className="flex items-center justify-between bg-zinc-900 px-5 py-2.5 rounded-2xl border border-zinc-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  diffPercentage > 0 ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                }`}
              />
              <span className="text-xs font-bold text-zinc-200">
                {diffPercentage > 0
                  ? `Page Diff Detected: ${diffPercentage}% visual variation`
                  : "Pages are visually 100% identical"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="truncate max-w-[160px] font-semibold text-zinc-300">{file1.name}</span>
              <span>vs</span>
              <span className="truncate max-w-[160px] font-semibold text-zinc-300">{file2.name}</span>
            </div>
          </div>

          {/* Viewport */}
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
              <p className="text-xs text-zinc-400 font-semibold">Comparing page vectors & pixels...</p>
            </div>
          ) : viewMode === "side-by-side" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 items-start">
              {/* Left Document */}
              <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 flex flex-col items-center">
                <span className="text-xs font-bold text-blue-400 mb-2">Original (V1) - Page {currentPage}</span>
                <div className="w-full bg-white rounded-2xl overflow-hidden shadow-lg p-2 border border-zinc-700 flex items-center justify-center">
                  {thumb1 && <img src={thumb1} alt="V1" className="w-full object-contain" />}
                </div>
              </div>

              {/* Right Document */}
              <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-4 flex flex-col items-center">
                <span className="text-xs font-bold text-indigo-400 mb-2">Revised (V2) - Page {currentPage}</span>
                <div className="w-full bg-white rounded-2xl overflow-hidden shadow-lg p-2 border border-zinc-700 flex items-center justify-center">
                  {thumb2 && <img src={thumb2} alt="V2" className="w-full object-contain" />}
                </div>
              </div>
            </div>
          ) : (
            /* Diff Overlay Mode */
            <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 flex flex-col items-center max-w-2xl mx-auto w-full">
              <span className="text-xs font-bold text-rose-400 mb-2 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Modified Pixels Highlighted in Red/Magenta</span>
              </span>
              <div className="w-full bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl p-2 border border-zinc-700 flex items-center justify-center">
                {diffDataUrl && <img src={diffDataUrl} alt="Diff" className="w-full object-contain" />}
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
};
