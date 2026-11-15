"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Scissors,
  Plus,
  Trash2,
  Download,
  Loader2,
  CheckCircle,
  FileText,
  Layers,
  Check,
} from "lucide-react";
import { renderPageThumbnail, getPdfPageCount } from "@/lib/pdf-renderer";
import { splitCustomRanges, splitPDF, downloadFile, CustomRangeItem } from "@/lib/pdf-ops";

interface SplitStudioProps {
  file: File;
  onBack: () => void;
  initialTab?: "custom" | "extract" | "fixed";
}

export const SplitStudio: React.FC<SplitStudioProps> = ({ file, onBack, initialTab = "custom" }) => {
  const [totalPages, setTotalPages] = useState<number>(1);
  const [pageThumbs, setPageThumbs] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"custom" | "extract" | "fixed">(initialTab);

  // Custom Ranges State
  const [ranges, setRanges] = useState<CustomRangeItem[]>([
    { id: "range-1", from: 1, to: 1 },
  ]);
  const [mergeRanges, setMergeRanges] = useState<boolean>(true);

  // Extract Pages State
  const [selectedPages, setSelectedPages] = useState<number[]>([1]);

  // Fixed Range State
  const [fixedPageCount, setFixedPageCount] = useState<number>(2);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [downloadReady, setDownloadReady] = useState<{
    data: Uint8Array | Blob;
    fileName: string;
  } | null>(null);

  // Load page count and initial thumbnails
  useEffect(() => {
    let cancelled = false;

    async function loadInfo() {
      try {
        const count = await getPdfPageCount(file);
        if (cancelled) return;
        setTotalPages(count);
        setRanges([{ id: "range-1", from: 1, to: Math.min(2, count) }]);

        // Preload thumbnails for first 10 pages
        const thumbs: Record<number, string> = {};
        for (let p = 1; p <= Math.min(count, 12); p++) {
          const t = await renderPageThumbnail(file, p, 0.35);
          if (cancelled) return;
          thumbs[p] = t;
        }
        setPageThumbs(thumbs);
      } catch (err) {
        console.error("Failed loading PDF metadata", err);
      }
    }

    loadInfo();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Helper to load thumbnail on demand
  const getThumbnail = (pageNum: number) => {
    if (pageThumbs[pageNum]) return pageThumbs[pageNum];
    renderPageThumbnail(file, pageNum, 0.35).then((t) => {
      setPageThumbs((prev) => ({ ...prev, [pageNum]: t }));
    });
    return null;
  };

  // Add range
  const handleAddRange = () => {
    const nextStart = ranges.length > 0 ? Math.min(ranges[ranges.length - 1].to + 1, totalPages) : 1;
    const nextEnd = Math.min(nextStart + 1, totalPages);
    setRanges((prev) => [
      ...prev,
      { id: `range-${Date.now()}`, from: nextStart, to: nextEnd },
    ]);
  };

  // Update range
  const handleUpdateRange = (id: string, field: "from" | "to", val: number) => {
    setRanges((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const clamped = Math.max(1, Math.min(val, totalPages));
          return { ...r, [field]: clamped };
        }
        return r;
      })
    );
  };

  // Delete range
  const handleDeleteRange = (id: string) => {
    if (ranges.length <= 1) return;
    setRanges((prev) => prev.filter((r) => r.id !== id));
  };

  // Toggle page in extract mode
  const handleToggleExtractPage = (pageNum: number) => {
    setSelectedPages((prev) =>
      prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum].sort((a, b) => a - b)
    );
  };

  // Select all or clear in extract mode
  const handleSelectAllExtract = () => {
    if (selectedPages.length === totalPages) {
      setSelectedPages([]);
    } else {
      setSelectedPages(Array.from({ length: totalPages }, (_, i) => i + 1));
    }
  };

  // Execute Split
  const handleExecuteSplit = async () => {
    setIsProcessing(true);
    setProgressMsg("Splitting document...");

    try {
      if (activeTab === "custom") {
        const result = await splitCustomRanges(file, ranges, mergeRanges, setProgressMsg);
        const data = result.pdfData || result.zipData!;
        setDownloadReady({ data, fileName: result.fileName });
        downloadFile(data, result.fileName);
      } else if (activeTab === "extract") {
        if (selectedPages.length === 0) {
          alert("Please select at least one page to extract.");
          setIsProcessing(false);
          return;
        }
        const rangeString = selectedPages.join(",");
        const result = await splitPDF(file, { mode: "range", ranges: rangeString }, setProgressMsg);
        const data = result.pdfData || result.zipData!;
        setDownloadReady({ data, fileName: result.fileName });
        downloadFile(data, result.fileName);
      } else if (activeTab === "fixed") {
        // Build fixed ranges
        const fixedRanges: CustomRangeItem[] = [];
        for (let i = 1; i <= totalPages; i += fixedPageCount) {
          fixedRanges.push({
            id: `fix-${i}`,
            from: i,
            to: Math.min(i + fixedPageCount - 1, totalPages),
          });
        }
        const result = await splitCustomRanges(file, fixedRanges, false, setProgressMsg);
        const data = result.zipData!;
        setDownloadReady({ data, fileName: result.fileName });
        downloadFile(data, result.fileName);
      }
    } catch (err: any) {
      alert("Error splitting PDF: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

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
              <Scissors className="w-4 h-4 text-amber-500" />
              <span>Split PDF</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Visual Ranges
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              {file.name} ({totalPages} pages)
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleExecuteSplit}
          disabled={isProcessing}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Splitting PDF...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>
                {activeTab === "custom"
                  ? mergeRanges
                    ? "Merge & Split PDF"
                    : "Split into Multiple PDFs"
                  : activeTab === "extract"
                  ? `Extract ${selectedPages.length} Pages`
                  : `Split every ${fixedPageCount} Pages`}
              </span>
            </>
          )}
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full p-6 gap-6">
        {/* Left Side: Modes & Options */}
        <div className="w-full md:w-80 shrink-0 flex flex-col gap-4">
          {/* Mode Selector Tabs */}
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-2 flex flex-col gap-1">
            <span className="text-[11px] font-bold text-zinc-400 px-3 py-1 uppercase tracking-wider">
              Split Mode
            </span>
            <button
              onClick={() => setActiveTab("custom")}
              className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === "custom"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              }`}
            >
              <Scissors className="w-4 h-4 text-amber-400" />
              <div>
                <p>Custom Ranges</p>
                <p className="text-[10px] text-zinc-500 font-normal">Define start and end page chunks</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("extract")}
              className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === "extract"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              }`}
            >
              <FileText className="w-4 h-4 text-blue-400" />
              <div>
                <p>Extract Pages</p>
                <p className="text-[10px] text-zinc-500 font-normal">Select specific individual pages</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("fixed")}
              className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                activeTab === "fixed"
                  ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              <div>
                <p>Fixed Ranges</p>
                <p className="text-[10px] text-zinc-500 font-normal">Divide into even sets of pages</p>
              </div>
            </button>
          </div>

          {/* Tab Specific Settings */}
          {activeTab === "custom" && (
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex flex-col gap-3">
              <span className="text-xs font-bold text-zinc-300">Merge Options</span>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mergeRanges}
                  onChange={(e) => setMergeRanges(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-zinc-800 border-zinc-700 focus:ring-0"
                />
                <span className="text-xs text-zinc-300">Merge all ranges in one PDF file</span>
              </label>
              <p className="text-[11px] text-zinc-500">
                {mergeRanges
                  ? "Outputs a single combined PDF with all selected ranges."
                  : "Outputs a ZIP containing each range as its own standalone PDF."}
              </p>
            </div>
          )}

          {activeTab === "extract" && (
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex flex-col gap-3">
              <span className="text-xs font-bold text-zinc-300">Quick Selection</span>
              <button
                onClick={handleSelectAllExtract}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer"
              >
                {selectedPages.length === totalPages ? "Deselect All" : "Select All Pages"}
              </button>
              <p className="text-[11px] text-zinc-500">
                Selected: {selectedPages.length} of {totalPages} pages
              </p>
            </div>
          )}

          {activeTab === "fixed" && (
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex flex-col gap-3">
              <span className="text-xs font-bold text-zinc-300">Split Document by</span>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={fixedPageCount}
                  onChange={(e) => setFixedPageCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-center font-bold text-sm text-white"
                />
                <span className="text-xs text-zinc-400">pages per file</span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Will generate approximately {Math.ceil(totalPages / fixedPageCount)} files in a ZIP archive.
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Visual Stage */}
        <div className="flex-1 bg-zinc-900/60 rounded-3xl border border-zinc-800/80 p-6 flex flex-col overflow-y-auto">
          {activeTab === "custom" && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Defined Page Ranges</h2>
                  <p className="text-xs text-zinc-400">Visual range cards showing start & end previews</p>
                </div>
                <button
                  onClick={handleAddRange}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Add Range</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ranges.map((range, idx) => {
                  const startThumb = getThumbnail(range.from);
                  const endThumb = getThumbnail(range.to);

                  return (
                    <div
                      key={range.id}
                      className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex flex-col gap-3 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400">Range {idx + 1}</span>
                        {ranges.length > 1 && (
                          <button
                            onClick={() => handleDeleteRange(range.id)}
                            className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Visual Cards */}
                      <div className="flex items-center justify-center gap-3 py-2 bg-zinc-950/40 rounded-xl p-2 border border-zinc-800/60">
                        {/* Start Page */}
                        <div className="flex flex-col items-center">
                          <div className="w-20 aspect-[1/1.41] bg-white rounded-lg overflow-hidden flex items-center justify-center shadow">
                            {startThumb ? (
                              <img src={startThumb} alt={`Page ${range.from}`} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-zinc-400 text-xs font-bold">{range.from}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-400 mt-1">Page {range.from}</span>
                        </div>

                        <span className="text-zinc-600 font-bold">&rarr;</span>

                        {/* End Page */}
                        <div className="flex flex-col items-center">
                          <div className="w-20 aspect-[1/1.41] bg-white rounded-lg overflow-hidden flex items-center justify-center shadow">
                            {endThumb ? (
                              <img src={endThumb} alt={`Page ${range.to}`} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-zinc-400 text-xs font-bold">{range.to}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-400 mt-1">Page {range.to}</span>
                        </div>
                      </div>

                      {/* Inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase font-semibold">from page</label>
                          <input
                            type="number"
                            min={1}
                            max={range.to}
                            value={range.from}
                            onChange={(e) => handleUpdateRange(range.id, "from", parseInt(e.target.value) || 1)}
                            className="w-full mt-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl text-center text-xs font-bold text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase font-semibold">to page</label>
                          <input
                            type="number"
                            min={range.from}
                            max={totalPages}
                            value={range.to}
                            onChange={(e) => handleUpdateRange(range.id, "to", parseInt(e.target.value) || range.from)}
                            className="w-full mt-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl text-center text-xs font-bold text-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "extract" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">Select Pages to Extract</h2>
                  <p className="text-xs text-zinc-400">Click individual pages to toggle extraction</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  const isSelected = selectedPages.includes(pageNum);
                  const thumb = getThumbnail(pageNum);

                  return (
                    <div
                      key={pageNum}
                      onClick={() => handleToggleExtractPage(pageNum)}
                      className={`relative bg-zinc-900 rounded-2xl border p-2 flex flex-col items-center cursor-pointer transition-all ${
                        isSelected
                          ? "border-amber-500 shadow-lg shadow-amber-500/10 bg-amber-500/5"
                          : "border-zinc-800/80 hover:border-zinc-700 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {/* Selection Check Badge */}
                      <div
                        className={`absolute top-3 right-3 z-10 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          isSelected ? "bg-amber-500 text-white" : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3 stroke-[3]" /> : pageNum}
                      </div>

                      {/* Thumbnail */}
                      <div className="w-full aspect-[1/1.41] bg-white rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
                        {thumb ? (
                          <img src={thumb} alt={`Page ${pageNum}`} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-zinc-400 text-xs font-bold">{pageNum}</span>
                        )}
                      </div>

                      <span className="text-[10px] font-bold text-zinc-300 mt-2">Page {pageNum}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "fixed" && (
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
              <Layers className="w-12 h-12 text-emerald-500 mb-3" />
              <h3 className="text-base font-bold text-white">Fixed Range Splitting</h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                The document will be automatically sliced into equal sets of {fixedPageCount} pages per PDF. All generated PDFs will be packaged into a convenient ZIP archive.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Ready Notification */}
      {downloadReady && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950/90 border border-emerald-500/40 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-xs font-bold text-white">Split PDF Ready!</p>
            <p className="text-[10px] text-emerald-300">{downloadReady.fileName}</p>
          </div>
          <button
            onClick={() => downloadFile(downloadReady.data, downloadReady.fileName)}
            className="ml-3 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow"
          >
            Download
          </button>
        </div>
      )}
    </div>
  );
};
