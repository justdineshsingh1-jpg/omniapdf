"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, File as FileIcon, AlertCircle } from "lucide-react";

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  title?: string;
  subtitle?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  accept = "application/pdf",
  multiple = false,
  title = "Drop your files here",
  subtitle = "Or click to browse from your device. Zero upload lag — 100% processed locally.",
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndPass = (fileList: File[]) => {
    setValidationError(null);
    const isPdfTool = accept.includes("pdf") || accept === "application/pdf";
    const isSheetTool = accept.includes("csv") || accept.includes("excel") || accept.includes("sheet");
    const isImageTool = accept.includes("image");

    const validFiles: File[] = [];

    for (const f of fileList) {
      if (isPdfTool && !f.name.toLowerCase().endsWith(".pdf") && !f.type.includes("pdf")) {
        setValidationError(`"${f.name}" is not a PDF document. Please select a valid .pdf file.`);
        return;
      }
      if (isSheetTool && !f.name.toLowerCase().match(/\.(csv|xlsx|xls|tsv)$/i)) {
        setValidationError(`"${f.name}" is not a spreadsheet. Please select a .csv or .xlsx file.`);
        return;
      }
      if (isImageTool && !f.type.startsWith("image/") && !f.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|bmp)$/i)) {
        setValidationError(`"${f.name}" is not an image. Please select JPG, PNG, or WebP images.`);
        return;
      }
      validFiles.push(f);
    }

    if (validFiles.length > 0) {
      onFilesSelected(multiple ? validFiles : [validFiles[0]]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndPass(Array.from(e.dataTransfer.files));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndPass(Array.from(e.target.files));
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {validationError && (
        <div className="w-full max-w-lg mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs font-semibold text-rose-400 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{validationError}</span>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full relative cursor-pointer group rounded-3xl border-2 border-dashed transition-all duration-300 p-12 text-center flex flex-col items-center justify-center ${
          isDragOver
            ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
            : "border-zinc-300 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-900/40 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/80"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300 mb-6">
          <UploadCloud className="w-10 h-10" />
        </div>

        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          {title}
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-6 leading-relaxed">
          {subtitle}
        </p>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-200/60 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Unlimited Free Pro Engine &bull; Private In-Browser WASM
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              setValidationError(null);
              try {
                const isSpreadsheet = accept.includes("csv") || accept.includes("excel") || accept.includes("sheet");
                const sampleUrl = isSpreadsheet ? "/sample_bylanes.csv" : "/panel_test.pdf";
                const sampleName = isSpreadsheet ? "Sample_APDCL_Lights.csv" : "Panel_APDCL_Subdivision_list.pdf";
                const sampleMime = isSpreadsheet ? "text/csv" : "application/pdf";

                const res = await fetch(sampleUrl);
                const blob = await res.blob();
                const sampleFile = new File([blob], sampleName, {
                  type: sampleMime,
                });
                onFilesSelected([sampleFile]);
              } catch (err) {
                console.error("Failed to load sample file", err);
              }
            }}
            className="px-4 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-2 border border-zinc-700/80 transition-all cursor-pointer shadow-sm"
          >
            <FileIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>Load Sample Document (Instant Demo)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
