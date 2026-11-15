"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Minimize2,
  Download,
  Loader2,
  CheckCircle,
  FileText,
  Plus,
  Trash2,
  Check,
  ArrowRight,
} from "lucide-react";
import { renderPageThumbnail, getPdfPageCount } from "@/lib/pdf-renderer";
import { compressPDF, downloadFile, CompressionLevel } from "@/lib/pdf-ops";

interface CompressStudioProps {
  initialFiles: File[];
  onBack: () => void;
}

interface FileMeta {
  file: File;
  pageCount: number;
  thumbnailUrl: string | null;
}

export const CompressStudio: React.FC<CompressStudioProps> = ({ initialFiles, onBack }) => {
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [fileMetas, setFileMetas] = useState<FileMeta[]>([]);
  const [level, setLevel] = useState<CompressionLevel>("recommended");

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [results, setResults] = useState<{
    data: Uint8Array;
    originalSize: number;
    compressedSize: number;
    fileName: string;
  }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  // Load metadata and thumbnails for all files
  useEffect(() => {
    let cancelled = false;

    async function loadMetas() {
      const metas: FileMeta[] = [];
      for (const f of files) {
        try {
          const count = await getPdfPageCount(f);
          const thumb = await renderPageThumbnail(f, 1, 0.45);
          if (cancelled) return;
          metas.push({ file: f, pageCount: count, thumbnailUrl: thumb });
        } catch (err) {
          metas.push({ file: f, pageCount: 1, thumbnailUrl: null });
        }
      }
      if (!cancelled) {
        setFileMetas(metas);
      }
    }

    loadMetas();
    return () => {
      cancelled = true;
    };
  }, [files]);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...added]);
    }
  };

  const handleRemoveFile = (index: number) => {
    if (files.length <= 1) return;
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCompress = async () => {
    setIsProcessing(true);
    setProgressMsg("Starting compression engine...");
    const compressedResults = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgressMsg(`Compressing ${f.name} (${i + 1}/${files.length})...`);
        const res = await compressPDF(f, level, (msg) => setProgressMsg(msg));
        const outName = `${f.name.replace(/\.pdf$/i, "")}_compressed.pdf`;
        compressedResults.push({
          data: res.data,
          originalSize: res.originalSize,
          compressedSize: res.compressedSize,
          fileName: outName,
        });
        downloadFile(res.data, outName);
      }
      setResults(compressedResults);
    } catch (err: any) {
      alert("Error compressing PDF: " + err.message);
    } finally {
      setIsProcessing(false);
      setProgressMsg("");
    }
  };

  const totalOriginalSize = files.reduce((acc, f) => acc + f.size, 0);

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
              <Minimize2 className="w-4 h-4 text-emerald-400" />
              <span>Compress PDF</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Lossless Optimizer
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Select compression level & shrink file size while preserving crisp quality
            </p>
          </div>
        </div>
      </header>

      {/* Main Studio Area: Side by Side */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-7xl mx-auto p-6 gap-8">
        {/* Left Side: Document Preview Canvas */}
        <div className="flex-1 bg-zinc-900/50 rounded-3xl border border-zinc-800/80 p-8 flex flex-col items-center justify-center relative min-h-[460px]">
          {/* File Cards Grid */}
          <div className="flex flex-wrap items-center justify-center gap-8 w-full">
            {fileMetas.map((meta, idx) => (
              <div
                key={idx}
                className="group relative bg-zinc-900 rounded-2xl border border-zinc-800 p-4 shadow-xl flex flex-col items-center w-52 hover:border-emerald-500/50 transition-all"
              >
                {/* Delete button if multiple */}
                {files.length > 1 && (
                  <button
                    onClick={() => handleRemoveFile(idx)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center text-xs shadow cursor-pointer opacity-90 group-hover:opacity-100"
                    title="Remove File"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Thumbnail */}
                <div className="w-40 aspect-[1/1.41] bg-white rounded-xl overflow-hidden shadow-md flex items-center justify-center p-2 border border-zinc-700">
                  {meta.thumbnailUrl ? (
                    <img src={meta.thumbnailUrl} alt={meta.file.name} className="w-full h-full object-contain" />
                  ) : (
                    <FileText className="w-10 h-10 text-zinc-400" />
                  )}
                </div>

                <p className="font-bold text-xs text-white mt-3 text-center truncate max-w-[160px]" title={meta.file.name}>
                  {meta.file.name}
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {meta.pageCount} pages • {formatBytes(meta.file.size)}
                </p>
              </div>
            ))}
          </div>

          {/* Floating "+ Add more files" Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAddFiles}
            accept="application/pdf"
            multiple
            className="hidden"
          />
          <div className="absolute right-8 top-8 flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 cursor-pointer transition-transform hover:scale-105"
              title="Add more PDF files"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-emerald-400 flex items-center justify-center">
                {files.length}
              </span>
            </button>
          </div>
        </div>

        {/* Right Sidebar: Compression Level Selector */}
        <div className="w-full lg:w-96 shrink-0 bg-zinc-900/90 rounded-3xl border border-zinc-800 p-6 flex flex-col justify-between shadow-2xl">
          <div>
            <h2 className="text-base font-bold text-white mb-1">Compression level</h2>
            <p className="text-xs text-zinc-400 mb-6">Select how aggressively to compress your files</p>

            <div className="flex flex-col gap-3">
              {/* Extreme Compression */}
              <div
                onClick={() => setLevel("extreme")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                  level === "extreme"
                    ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500/30"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 mt-0.5 ${
                    level === "extreme"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-zinc-700 bg-zinc-800"
                  }`}
                >
                  {level === "extreme" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-white">Extreme compression</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                    Less quality, high compression
                  </p>
                </div>
              </div>

              {/* Recommended Compression */}
              <div
                onClick={() => setLevel("recommended")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                  level === "recommended"
                    ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500/30"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 mt-0.5 ${
                    level === "recommended"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-zinc-700 bg-zinc-800"
                  }`}
                >
                  {level === "recommended" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs text-white">Recommended compression</h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                    Good quality, good compression
                  </p>
                </div>
              </div>

              {/* Less Compression */}
              <div
                onClick={() => setLevel("less")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                  level === "less"
                    ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500/30"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 mt-0.5 ${
                    level === "less"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-zinc-700 bg-zinc-800"
                  }`}
                >
                  {level === "less" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-white">Less compression</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                    High quality, less compression
                  </p>
                </div>
              </div>
            </div>

            {/* Total File Info */}
            <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Total Size ({files.length} files):</span>
              <span className="font-bold text-zinc-200">{formatBytes(totalOriginalSize)}</span>
            </div>
          </div>

          {/* Action Trigger Button */}
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={handleCompress}
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{progressMsg || "Compressing PDF..."}</span>
                </>
              ) : (
                <>
                  <span>Compress PDF</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {results.length > 0 && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-center">
                <p className="text-xs font-bold text-emerald-300">
                  Compressed {results.length} file{results.length > 1 ? "s" : ""} successfully!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
