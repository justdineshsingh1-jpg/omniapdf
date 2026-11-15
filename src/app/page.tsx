"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Layers,
  Scissors,
  RotateCw,
  LayoutGrid,
  Image as ImageIcon,
  FileImage,
  FileText,
  Sparkles,
  Stamp,
  Hash,
  Search,
  ShieldCheck,
  Zap,
  Globe2,
  Lock,
  Unlock,
  PenTool,
  Minimize2,
  ChevronDown,
  Trash2,
  Wrench,
  Code2,
  Sheet,
  Table,
  Crop,
  Pen,
  EyeOff,
  ArrowRight,
  Camera,
  FileCheck,
  GitCompare,
  Sun,
  Moon,
} from "lucide-react";
import { PDF_TOOLS, PDF_CATEGORIES, ToolMeta, ToolCategory } from "@/lib/tools-meta";
import { ToolRunner } from "@/components/ToolRunner";
import { PdfEditorStudio } from "@/components/PdfEditorStudio";
import { OrganizeStudio } from "@/components/OrganizeStudio";
import { SplitStudio } from "@/components/SplitStudio";
import { CompressStudio } from "@/components/CompressStudio";
import { ScanToPdf } from "@/components/ScanToPdf";
import { ComparePdf } from "@/components/ComparePdf";
import { FileDropzone } from "@/components/FileDropzone";

export default function Home() {
  const [activeTool, setActiveTool] = useState<ToolMeta | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory>("all");
  const [megaMenuOpen, setMegaMenuOpen] = useState<ToolCategory | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("omniapdf_theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      if (saved === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("omniapdf_theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const navRef = useRef<HTMLDivElement>(null);

  // Close mega menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMegaMenuOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTools = useMemo(() => {
    return PDF_TOOLS.filter((tool) => {
      const matchesSearch =
        tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.shortDesc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || tool.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const getToolIcon = (name: string) => {
    switch (name) {
      case "PenTool":
        return <PenTool className="w-5 h-5" />;
      case "Layers":
        return <Layers className="w-5 h-5" />;
      case "Scissors":
        return <Scissors className="w-5 h-5" />;
      case "RotateCw":
        return <RotateCw className="w-5 h-5" />;
      case "LayoutGrid":
        return <LayoutGrid className="w-5 h-5" />;
      case "Minimize2":
        return <Minimize2 className="w-5 h-5" />;
      case "Image":
        return <ImageIcon className="w-5 h-5" />;
      case "FileImage":
        return <FileImage className="w-5 h-5" />;
      case "FileText":
        return <FileText className="w-5 h-5" />;
      case "Sparkles":
        return <Sparkles className="w-5 h-5" />;
      case "Stamp":
        return <Stamp className="w-5 h-5" />;
      case "Hash":
        return <Hash className="w-5 h-5" />;
      case "Trash2":
        return <Trash2 className="w-5 h-5" />;
      case "Wrench":
        return <Wrench className="w-5 h-5" />;
      case "Code2":
        return <Code2 className="w-5 h-5" />;
      case "Sheet":
        return <Sheet className="w-5 h-5" />;
      case "Table":
        return <Table className="w-5 h-5" />;
      case "Crop":
        return <Crop className="w-5 h-5" />;
      case "Lock":
        return <Lock className="w-5 h-5" />;
      case "Unlock":
        return <Unlock className="w-5 h-5" />;
      case "Pen":
        return <Pen className="w-5 h-5" />;
      case "EyeOff":
        return <EyeOff className="w-5 h-5" />;
      case "Camera":
        return <Camera className="w-5 h-5" />;
      case "FileCheck":
        return <FileCheck className="w-5 h-5" />;
      case "GitCompare":
        return <GitCompare className="w-5 h-5" />;
      default:
        return <Layers className="w-5 h-5" />;
    }
  };

  const handleToolClick = (tool: ToolMeta) => {
    setActiveTool(tool);
    setSelectedFiles([]);
    setMegaMenuOpen(null);
  };

  const handleBackToDashboard = () => {
    setActiveTool(null);
    setSelectedFiles([]);
    setMegaMenuOpen(null);
  };

  return (
    <div className={`min-h-screen ${theme === "dark" ? "dark bg-zinc-950 text-zinc-100" : "bg-slate-50 text-zinc-900"} transition-colors selection:bg-blue-600 selection:text-white`}>
      {/* Top Navbar & Mega Menu */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between" ref={navRef}>
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group shrink-0"
            onClick={handleBackToDashboard}
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 shadow-lg shadow-indigo-500/25 ring-1 ring-white/20 group-hover:scale-105 transition-transform duration-300">
              <svg className="w-5 h-5 text-white drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" className="opacity-90 fill-white/10" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 15h6" />
                <path d="M9 11h6" />
              </svg>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-zinc-950" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500 dark:from-white dark:via-zinc-200 dark:to-zinc-400 bg-clip-text text-transparent">
                OmniaPDF
              </span>
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">
                Enterprise
              </span>
            </div>
          </div>

          {/* Desktop Mega-Menu Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {PDF_CATEGORIES.filter((c) => c.id !== "all").map((cat) => {
              const isOpen = megaMenuOpen === cat.id;
              const catTools = PDF_TOOLS.filter((t) => t.category === cat.id);

              return (
                <div key={cat.id} className="relative">
                  <button
                    onClick={() => setMegaMenuOpen(isOpen ? null : cat.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isOpen
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <span>{cat.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                        isOpen ? "rotate-180 text-blue-500" : ""
                      }`}
                    />
                  </button>

                  {/* Mega Menu Dropdown */}
                  {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-2xl z-50 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/80 mb-1">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">{cat.label}</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{cat.desc}</p>
                      </div>

                      {catTools.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => handleToolClick(t)}
                          className="px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer flex items-center gap-3 group transition-all"
                        >
                          <div className={`p-2 rounded-lg bg-gradient-to-tr ${t.color} text-white shrink-0`}>
                            {getToolIcon(t.iconName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-blue-500 truncate">
                                {t.title}
                              </p>
                              {t.badge && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300">
                                  {t.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{t.shortDesc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right Action: Theme Switcher, Privacy Badge & Pro Flagship */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-blue-500 transition-all cursor-pointer"
              title={`Switch to ${theme === "dark" ? "Light Mode" : "Night Mode"}`}
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>100% Client-Side Privacy</span>
            </div>

            <button
              onClick={() => {
                const editTool = PDF_TOOLS.find((t) => t.id === "edit-pdf");
                if (editTool) handleToolClick(editTool);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer transition-all"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit PDF Pro</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main View Router */}
      {activeTool?.id === "edit-pdf" ? (
        selectedFiles[0] ? (
          <PdfEditorStudio file={selectedFiles[0]} onBack={handleBackToDashboard} />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-12">
            <button
              onClick={handleBackToDashboard}
              className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 mb-6 cursor-pointer"
            >
              &larr; Back to all tools
            </button>
            <div className="text-center mb-8">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Vector Text Editor
              </span>
              <h1 className="text-3xl font-extrabold mt-3 text-white">
                Open PDF in Pro Editor
              </h1>
              <p className="text-zinc-400 text-sm mt-1 max-w-lg mx-auto">
                Change, overwrite, find & replace, or erase words, paragraphs, and numbers on any PDF.
              </p>
            </div>
            <FileDropzone
              multiple={false}
              title="Drop the PDF you want to edit"
              subtitle="All font embeddings, page masking, and word substitutions run locally in your browser."
              onFilesSelected={(files) => files[0] && setSelectedFiles([files[0]])}
            />
          </div>
        )
      ) : activeTool?.id === "organize" ? (
        selectedFiles.length > 0 ? (
          <OrganizeStudio initialFiles={selectedFiles} onBack={handleBackToDashboard} />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-12">
            <button
              onClick={handleBackToDashboard}
              className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 mb-6 cursor-pointer"
            >
              &larr; Back to all tools
            </button>
            <div className="text-center mb-8">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                Visual Grid
              </span>
              <h1 className="text-3xl font-extrabold mt-3 text-white">
                Organize PDF Pages
              </h1>
              <p className="text-zinc-400 text-sm mt-1 max-w-lg mx-auto">
                Drag-to-reorder, delete, rotate, sort, and combine pages across one or multiple documents on an interactive thumbnail grid.
              </p>
            </div>
            <FileDropzone
              multiple={true}
              title="Drop PDF documents to organize"
              subtitle="Select one or multiple PDF files to assemble and reorganize pages."
              onFilesSelected={(files) => setSelectedFiles(files)}
            />
          </div>
        )
      ) : activeTool?.id === "split" ? (
        selectedFiles[0] ? (
          <SplitStudio file={selectedFiles[0]} onBack={handleBackToDashboard} />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-12">
            <button
              onClick={handleBackToDashboard}
              className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 mb-6 cursor-pointer"
            >
              &larr; Back to all tools
            </button>
            <div className="text-center mb-8">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Visual Ranges
              </span>
              <h1 className="text-3xl font-extrabold mt-3 text-white">
                Split PDF by Page Ranges
              </h1>
              <p className="text-zinc-400 text-sm mt-1 max-w-lg mx-auto">
                Define custom ranges with start/end visual thumbnails, extract specific pages, or split into equal page chunks.
              </p>
            </div>
            <FileDropzone
              multiple={false}
              title="Drop the PDF you want to split"
              subtitle="Extract page chunks or save every single page as a standalone PDF."
              onFilesSelected={(files) => files[0] && setSelectedFiles([files[0]])}
            />
          </div>
        )
      ) : activeTool?.id === "extract-pages" ? (
        selectedFiles[0] ? (
          <SplitStudio file={selectedFiles[0]} onBack={handleBackToDashboard} initialTab="extract" />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-12">
            <button
              onClick={handleBackToDashboard}
              className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 mb-6 cursor-pointer"
            >
              &larr; Back to all tools
            </button>
            <div className="text-center mb-8">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                1-Click Extract
              </span>
              <h1 className="text-3xl font-extrabold mt-3 text-white">
                Extract PDF Pages
              </h1>
              <p className="text-zinc-400 text-sm mt-1 max-w-lg mx-auto">
                Select individual pages or custom ranges on an interactive thumbnail grid to extract into a fresh document.
              </p>
            </div>
            <FileDropzone
              multiple={false}
              title="Drop the PDF you want to extract pages from"
              subtitle="Extract selected pages instantly with zero server upload."
              onFilesSelected={(files) => files[0] && setSelectedFiles([files[0]])}
            />
          </div>
        )
      ) : activeTool?.id === "compress" ? (
        selectedFiles.length > 0 ? (
          <CompressStudio initialFiles={selectedFiles} onBack={handleBackToDashboard} />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-12">
            <button
              onClick={handleBackToDashboard}
              className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 mb-6 cursor-pointer"
            >
              &larr; Back to all tools
            </button>
            <div className="text-center mb-8">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Lossless Optimizer
              </span>
              <h1 className="text-3xl font-extrabold mt-3 text-white">
                Compress & Optimize PDF File Size
              </h1>
              <p className="text-zinc-400 text-sm mt-1 max-w-lg mx-auto">
                Shrink document footprint with Extreme, Recommended, or Less compression presets while keeping maximum visual detail.
              </p>
            </div>
            <FileDropzone
              multiple={true}
              title="Drop the PDF documents you want to compress"
              subtitle="All stream compression and font deduplication run locally in browser WebAssembly."
              onFilesSelected={(files) => setSelectedFiles(files)}
            />
          </div>
        )
      ) : activeTool?.id === "scan-to-pdf" ? (
        <ScanToPdf onBack={handleBackToDashboard} />
      ) : activeTool?.id === "compare-pdf" ? (
        <ComparePdf onBack={handleBackToDashboard} />
      ) : activeTool ? (
        <ToolRunner tool={activeTool} onBack={handleBackToDashboard} />
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-12">
          {/* Hero Header */}
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 text-xs font-semibold mb-6 border border-indigo-500/20 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Private, Client-Side PDF Productivity &amp; Document Platform</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-4">
              Professional PDF Editing &amp; <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                Document Intelligence Platform.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
              Precision document editing and batch conversion. Merge, split, compress, organize, and OCR documents with local WebAssembly security.
            </p>

            {/* Quick Search Bar */}
            <div className="mt-8 relative max-w-xl mx-auto">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools (e.g. edit, merge, split, compress, watermark, rotate)..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              {PDF_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md font-bold"
                      : "bg-white dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredTools.map((tool) => (
              <div
                key={tool.id}
                onClick={() => handleToolClick(tool)}
                className={`group relative cursor-pointer bg-white dark:bg-zinc-900/70 rounded-3xl border border-zinc-200 dark:border-zinc-800/80 p-6 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:border-zinc-300 dark:hover:border-zinc-700 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between ${
                  tool.id === "edit-pdf"
                    ? "ring-2 ring-blue-500/40 border-blue-500/50 bg-gradient-to-b from-blue-50/50 dark:from-blue-950/20 to-white dark:to-zinc-900/80"
                    : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${tool.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}
                    >
                      {getToolIcon(tool.iconName)}
                    </div>
                    {tool.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {tool.shortDesc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs font-semibold text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200">
                  <span>Open Tool</span>
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
              </div>
            ))}
          </div>

          {/* Trust & Guarantee Section */}
          <div className="mt-20 pt-12 border-t border-zinc-200 dark:border-zinc-800/80 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex gap-4 items-start">
              <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 border border-blue-500/20">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-zinc-900 dark:text-white mb-1">
                  100% Client-Side Privacy
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Your files never upload to any server. All font embedding, stream compression, and word overwriting happen strictly inside your browser.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-500/20">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-zinc-900 dark:text-white mb-1">
                  High-Performance Processing Engine
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Engineered for demanding workloads with WebAssembly acceleration. Process complex multi-page files with zero quality loss.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0 border border-purple-500/20">
                <Globe2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-zinc-900 dark:text-white mb-1">
                  Works Fully Offline
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Powered by WebAssembly and local web workers. Enjoy instant responses with zero network dependency.
                </p>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
