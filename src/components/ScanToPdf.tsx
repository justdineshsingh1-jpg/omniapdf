"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Camera,
  RotateCw,
  Trash2,
  Download,
  Loader2,
  CheckCircle,
  Sparkles,
  RefreshCw,
  Sliders,
  Layers,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { downloadFile } from "@/lib/pdf-ops";

interface ScanToPdfProps {
  onBack: () => void;
}

interface CapturedPage {
  id: string;
  dataUrl: string;
  filter: "original" | "bw" | "contrast";
}

export const ScanToPdf: React.FC<ScanToPdfProps> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);
  const [activeFilter, setActiveFilter] = useState<"original" | "bw" | "contrast">("contrast");
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadReady, setDownloadReady] = useState<{ data: Uint8Array; fileName: string } | null>(null);

  // Initialize camera stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function startCamera() {
      try {
        setCameraError(null);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        setCameraError(
          "Camera access denied or unavailable. Please enable camera permissions in your browser or connect a webcam."
        );
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Filter application helper
  const applyFilterToCanvas = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    filter: "original" | "bw" | "contrast"
  ) => {
    if (filter === "original") return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Luminance
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      if (filter === "bw") {
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      } else if (filter === "contrast") {
        // High-contrast document enhancement
        const contrasted = gray > 140 ? Math.min(255, gray * 1.25) : Math.max(0, gray * 0.75);
        data[i] = contrasted;
        data[i + 1] = contrasted;
        data[i + 2] = contrasted;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Capture frame from live video
  const handleCapturePage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    applyFilterToCanvas(ctx, w, h, activeFilter);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedPages((prev) => [
      ...prev,
      {
        id: `page-${Date.now()}-${Math.random()}`,
        dataUrl,
        filter: activeFilter,
      },
    ]);
  };

  const handleDeletePage = (id: string) => {
    setCapturedPages((prev) => prev.filter((p) => p.id !== id));
  };

  // Generate & Download PDF
  const handleGeneratePdf = async () => {
    if (capturedPages.length === 0) return;
    setIsProcessing(true);

    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < capturedPages.length; i++) {
        const page = capturedPages[i];
        const res = await fetch(page.dataUrl);
        const imgBytes = await res.arrayBuffer();
        const embeddedImg = await pdfDoc.embedJpg(imgBytes);

        const { width, height } = embeddedImg;
        const pdfPage = pdfDoc.addPage([width, height]);
        pdfPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }

      const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
      const outName = `Scanned_Document_${new Date().toISOString().slice(0, 10)}.pdf`;
      setDownloadReady({ data: pdfBytes, fileName: outName });
      downloadFile(pdfBytes, outName);
    } catch (err: any) {
      alert("Error generating PDF: " + err.message);
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
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>Scan to PDF</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Camera Scan
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Capture physical pages directly from your webcam or phone camera
            </p>
          </div>
        </div>

        <button
          onClick={handleGeneratePdf}
          disabled={isProcessing || capturedPages.length === 0}
          className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Building PDF...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Save as PDF ({capturedPages.length} Pages)</span>
            </>
          )}
        </button>
      </header>

      {/* Main View */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full p-6 gap-6">
        {/* Left Side: Live Camera Viewport */}
        <div className="flex-1 bg-zinc-900/60 rounded-3xl border border-zinc-800 p-6 flex flex-col items-center justify-between shadow-2xl relative">
          {cameraError ? (
            <div className="flex flex-col items-center justify-center h-80 text-center max-w-md my-auto">
              <Camera className="w-12 h-12 text-rose-500 mb-3 opacity-60" />
              <h3 className="font-bold text-sm text-white mb-1">Camera Permission Required</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">{cameraError}</p>
            </div>
          ) : (
            <div className="relative w-full max-w-xl aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-zinc-700 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Guideline Box */}
              <div className="absolute inset-8 border-2 border-dashed border-cyan-400/40 rounded-xl pointer-events-none flex items-center justify-center">
                <span className="text-[10px] text-cyan-300/60 font-semibold bg-black/40 px-2 py-0.5 rounded">
                  Align Document Inside Box
                </span>
              </div>
            </div>
          )}

          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Controls Bar Below Camera */}
          <div className="w-full max-w-xl mt-4 flex items-center justify-between bg-zinc-900 rounded-2xl border border-zinc-800 p-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveFilter("contrast")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  activeFilter === "contrast"
                    ? "bg-cyan-500 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                Enhanced
              </button>
              <button
                onClick={() => setActiveFilter("bw")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  activeFilter === "bw"
                    ? "bg-cyan-500 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                B&W Scan
              </button>
              <button
                onClick={() => setActiveFilter("original")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  activeFilter === "original"
                    ? "bg-cyan-500 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                Color
              </button>
            </div>

            {/* Shutter Button */}
            <button
              onClick={handleCapturePage}
              disabled={!!cameraError}
              className="px-6 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Page</span>
            </button>
          </div>
        </div>

        {/* Right Side: Captured Pages Filmstrip */}
        <div className="w-full lg:w-80 shrink-0 bg-zinc-900/80 rounded-3xl border border-zinc-800 p-5 flex flex-col shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Captured Pages</span>
            </h3>
            <span className="text-xs font-bold text-cyan-400">
              {capturedPages.length} {capturedPages.length === 1 ? "page" : "pages"}
            </span>
          </div>

          {capturedPages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-500 py-16">
              <Camera className="w-8 h-8 opacity-40 mb-2" />
              <p className="text-xs font-medium">No pages captured yet</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Click "Capture Page" to snap document pages</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
              {capturedPages.map((page, idx) => (
                <div
                  key={page.id}
                  className="bg-zinc-950 rounded-xl border border-zinc-800 p-2 flex items-center gap-3 relative group"
                >
                  <span className="w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300 flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="w-14 aspect-[1/1.41] bg-white rounded overflow-hidden shadow-sm shrink-0">
                    <img src={page.dataUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-200">Page {idx + 1}</p>
                    <p className="text-[10px] text-zinc-500 capitalize">{page.filter} filter</p>
                  </div>
                  <button
                    onClick={() => handleDeletePage(page.id)}
                    className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer"
                    title="Remove page"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
