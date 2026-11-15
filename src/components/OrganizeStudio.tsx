"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  RotateCw,
  RotateCcw,
  Trash2,
  ArrowLeftRight,
  Plus,
  Download,
  Loader2,
  CheckCircle,
  FileText,
  SortAsc,
  SortDesc,
  RefreshCw,
} from "lucide-react";
import { renderPageThumbnail, getPdfPageCount } from "@/lib/pdf-renderer";
import { organizeAndSavePdf, downloadFile, OrganizePageItem } from "@/lib/pdf-ops";

interface OrganizeStudioProps {
  initialFiles: File[];
  onBack: () => void;
}

export const OrganizeStudio: React.FC<OrganizeStudioProps> = ({ initialFiles, onBack }) => {
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [pages, setPages] = useState<OrganizePageItem[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [downloadReady, setDownloadReady] = useState<{ data: Uint8Array; fileName: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load pages and generate thumbnails
  useEffect(() => {
    let isCancelled = false;

    async function loadThumbnails() {
      setLoadingThumbnails(true);
      const newPages: OrganizePageItem[] = [];

      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        try {
          const count = await getPdfPageCount(file);
          for (let p = 1; p <= count; p++) {
            const thumb = await renderPageThumbnail(file, p, 0.4);
            if (isCancelled) return;
            newPages.push({
              id: `${file.name}_${fIdx}_${p}_${Math.random()}`,
              fileIndex: fIdx,
              fileName: file.name,
              originalPageIndex: p - 1,
              rotation: 0,
              thumbnailUrl: thumb,
            });
          }
        } catch (err) {
          console.error("Error generating thumbnail for", file.name, err);
        }
      }

      if (!isCancelled) {
        setPages(newPages);
        setLoadingThumbnails(false);
      }
    }

    loadThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [files]);

  // Rotate single page
  const handleRotatePage = (index: number, angleDelta: number) => {
    setPages((prev) =>
      prev.map((page, idx) => {
        if (idx === index) {
          const nextRot = (page.rotation + angleDelta + 360) % 360;
          return { ...page, rotation: nextRot };
        }
        return page;
      })
    );
  };

  // Delete page
  const handleDeletePage = (index: number) => {
    setPages((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Move page left
  const handleMoveLeft = (index: number) => {
    if (index <= 0) return;
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Move page right
  const handleMoveRight = (index: number) => {
    if (index >= pages.length - 1) return;
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Rotate all pages
  const handleRotateAll = (delta: number) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + delta + 360) % 360,
      }))
    );
  };

  // Sort ascending / descending
  const handleSort = (dir: "asc" | "desc") => {
    setPages((prev) => {
      const copy = [...prev];
      copy.sort((a, b) => {
        if (dir === "asc") {
          return a.originalPageIndex - b.originalPageIndex;
        } else {
          return b.originalPageIndex - a.originalPageIndex;
        }
      });
      return copy;
    });
  };

  // Add more PDF files
  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  // Execute Organize & Download
  const handleOrganizePdf = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    setProgressMsg("Starting organize engine...");

    try {
      const outputBytes = await organizeAndSavePdf(files, pages, setProgressMsg);
      const outName = `${files[0].name.replace(/\.pdf$/i, "")}_organized.pdf`;
      setDownloadReady({
        data: outputBytes,
        fileName: outName,
      });
      downloadFile(outputBytes, outName);
    } catch (err: any) {
      alert("Error organizing PDF: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Header Bar */}
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
              <span>Organize PDF</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Visual Grid
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Drag, reorder, rotate, or remove pages from {files.length} document{files.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRotateAll(90)}
            className="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            title="Rotate All Pages 90° Clockwise"
          >
            <RotateCw className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Rotate All</span>
          </button>

          <button
            onClick={() => handleSort("asc")}
            className="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            title="Sort 1 to N"
          >
            <SortAsc className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Sort Asc</span>
          </button>

          <button
            onClick={() => handleSort("desc")}
            className="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            title="Sort N to 1"
          >
            <SortDesc className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Sort Desc</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAddFiles}
            accept="application/pdf"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border border-zinc-700"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Files</span>
          </button>

          <button
            onClick={handleOrganizePdf}
            disabled={isProcessing || pages.length === 0}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Organize PDF ({pages.length})</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {loadingThumbnails ? (
          <div className="flex flex-col items-center justify-center h-80 gap-3 text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium">Generating visual page thumbnails...</p>
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-base font-semibold">No pages remaining in document.</p>
            <p className="text-xs mt-1">Add another PDF or click Reset to reload.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="group relative bg-zinc-900 rounded-2xl border border-zinc-800/80 hover:border-blue-500/60 transition-all p-3 shadow-md hover:shadow-xl hover:shadow-blue-500/10 flex flex-col items-center"
              >
                {/* Top Action Overlay */}
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700/80 text-[11px] font-bold text-zinc-300 flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRotatePage(index, 90)}
                      className="p-1 rounded-lg bg-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Rotate 90° Clockwise"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePage(index)}
                      className="p-1 rounded-lg bg-zinc-800 hover:bg-rose-600 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Remove Page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Page Thumbnail Preview */}
                <div className="relative w-full aspect-[1/1.41] bg-white rounded-xl overflow-hidden shadow-inner flex items-center justify-center p-1">
                  {page.thumbnailUrl ? (
                    <img
                      src={page.thumbnailUrl}
                      alt={`Page ${index + 1}`}
                      className="max-w-full max-h-full object-contain transition-transform duration-200"
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                  ) : (
                    <div className="text-zinc-400 text-xs">Page {index + 1}</div>
                  )}

                  {page.rotation !== 0 && (
                    <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm text-[9px] font-bold text-blue-400 px-1.5 py-0.5 rounded">
                      {page.rotation}°
                    </div>
                  )}
                </div>

                {/* Bottom Move Controls */}
                <div className="w-full flex items-center justify-between mt-2 pt-1 border-t border-zinc-800/60">
                  <button
                    onClick={() => handleMoveLeft(index)}
                    disabled={index === 0}
                    className="text-[10px] text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer"
                  >
                    &larr; Left
                  </button>
                  <span className="text-[9px] text-zinc-500 truncate max-w-[80px]" title={page.fileName}>
                    {page.fileName}
                  </span>
                  <button
                    onClick={() => handleMoveRight(index)}
                    disabled={index === pages.length - 1}
                    className="text-[10px] text-zinc-400 hover:text-white disabled:opacity-20 cursor-pointer"
                  >
                    Right &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Bottom Notification if Ready */}
      {downloadReady && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950/90 border border-emerald-500/40 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-xs font-bold text-white">Organized PDF Ready!</p>
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
