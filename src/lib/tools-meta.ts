export type ToolCategory =
  | "all"
  | "organize"
  | "optimize"
  | "convert-to"
  | "convert-from"
  | "edit"
  | "security";

export interface ToolMeta {
  id: string;
  title: string;
  shortDesc: string;
  category: ToolCategory;
  iconName: string;
  badge?: string;
  color: string;
  supportsMulti: boolean;
  acceptedTypes: string;
}

export const PDF_CATEGORIES: { id: ToolCategory; label: string; desc: string }[] = [
  { id: "all", label: "All PDF Tools", desc: "Every tool you need to work with PDFs in one place" },
  { id: "organize", label: "Organize PDF", desc: "Merge, split, remove, reorder and rotate PDF pages" },
  { id: "optimize", label: "Optimize PDF", desc: "Compress and perform neural OCR on documents" },
  { id: "convert-to", label: "Convert to PDF", desc: "Turn images, webcam scans, spreadsheets and docs into PDF" },
  { id: "convert-from", label: "Convert from PDF", desc: "Export PDFs to high-res images, Word or Excel" },
  { id: "edit", label: "Edit PDF", desc: "Change text, add watermarks, numbering and stamps" },
  { id: "security", label: "PDF Security & Diff", desc: "Encrypt, password protect, unlock, sign, compare and redact" },
];

export const PDF_TOOLS: ToolMeta[] = [
  // 1. EDIT PDF PRO (FLAGSHIP)
  {
    id: "edit-pdf",
    title: "Edit PDF Pro",
    shortDesc: "Change, replace, or overwrite words, paragraphs, numbers & erase text on any PDF or scanned image document.",
    category: "edit",
    iconName: "PenTool",
    color: "from-blue-600 via-indigo-600 to-violet-600",
    badge: "Full Pro Editor",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },

  // 2. ORGANIZE PDF
  {
    id: "organize",
    title: "Organize PDF",
    shortDesc: "Visual thumbnail grid to reorder, delete, duplicate, rotate, and sort pages across multiple PDFs.",
    category: "organize",
    iconName: "LayoutGrid",
    color: "from-violet-500 to-purple-600",
    badge: "Visual Grid",
    supportsMulti: true,
    acceptedTypes: "application/pdf",
  },
  {
    id: "merge",
    title: "Merge PDF",
    shortDesc: "Combine multiple PDFs into a single unified document in any order you choose.",
    category: "organize",
    iconName: "Layers",
    color: "from-blue-500 to-indigo-600",
    supportsMulti: true,
    acceptedTypes: "application/pdf",
  },
  {
    id: "split",
    title: "Split PDF",
    shortDesc: "Visual range editor to extract specific page ranges or burst each page into individual standalone files.",
    category: "organize",
    iconName: "Scissors",
    color: "from-amber-500 to-orange-600",
    badge: "Visual Ranges",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "extract-pages",
    title: "Extract Pages",
    shortDesc: "Select and pull out individual pages or batches from any document into a fresh PDF.",
    category: "organize",
    iconName: "FileCheck",
    color: "from-teal-500 to-emerald-600",
    badge: "1-Click Extract",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "remove-pages",
    title: "Remove Pages",
    shortDesc: "Select and permanently delete unwanted pages from your PDF document.",
    category: "organize",
    iconName: "Trash2",
    color: "from-rose-500 to-red-600",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "rotate",
    title: "Rotate PDF",
    shortDesc: "Rotate selective pages or the entire document by 90°, 180°, or 270° degrees.",
    category: "organize",
    iconName: "RotateCw",
    color: "from-emerald-500 to-teal-600",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },

  // 3. OPTIMIZE PDF
  {
    id: "compress",
    title: "Compress PDF",
    shortDesc: "Reduce PDF file size with Extreme, Recommended, or Less compression presets while keeping maximum quality.",
    category: "optimize",
    iconName: "Minimize2",
    color: "from-emerald-500 to-teal-600",
    badge: "Lossless Optimizer",
    supportsMulti: true,
    acceptedTypes: "application/pdf",
  },
  {
    id: "ocr",
    title: "OCR Text Extraction",
    shortDesc: "Use in-browser neural optical character recognition to extract text from scanned PDFs.",
    category: "optimize",
    iconName: "Sparkles",
    color: "from-indigo-500 to-violet-600",
    badge: "AI Powered",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "repair",
    title: "Repair PDF",
    shortDesc: "Rebuild corrupted PDF cross-reference tables and recover readable pages.",
    category: "optimize",
    iconName: "Wrench",
    color: "from-amber-500 to-yellow-600",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },

  // 4. CONVERT TO PDF
  {
    id: "scan-to-pdf",
    title: "Scan to PDF",
    shortDesc: "Capture physical paper documents using your webcam or phone camera and convert directly to PDF.",
    category: "convert-to",
    iconName: "Camera",
    color: "from-blue-600 to-cyan-600",
    badge: "Camera Scan",
    supportsMulti: false,
    acceptedTypes: "camera",
  },
  {
    id: "images-to-pdf",
    title: "JPG / PNG to PDF",
    shortDesc: "Convert JPG, PNG, and WebP images into a perfectly formatted PDF document with custom margins.",
    category: "convert-to",
    iconName: "FileImage",
    color: "from-fuchsia-500 to-purple-600",
    supportsMulti: true,
    acceptedTypes: "image/*",
  },
  {
    id: "html-to-pdf",
    title: "HTML to PDF",
    shortDesc: "Convert raw HTML web pages, invoices, or formatted receipts directly into vector PDF documents.",
    category: "convert-to",
    iconName: "Code2",
    color: "from-cyan-500 to-blue-600",
    supportsMulti: false,
    acceptedTypes: ".html,.htm,text/html",
  },
  {
    id: "excel-to-pdf",
    title: "Excel / CSV to PDF",
    shortDesc: "Transform CSV or spreadsheet tables into beautifully styled printable PDF tables.",
    category: "convert-to",
    iconName: "Sheet",
    color: "from-emerald-500 to-green-600",
    supportsMulti: false,
    acceptedTypes: ".csv,text/csv",
  },

  // 5. CONVERT FROM PDF
  {
    id: "pdf-to-images",
    title: "PDF to JPG / PNG",
    shortDesc: "Extract high-resolution (150-300 DPI) crisp images from each page of your PDF into a ZIP.",
    category: "convert-from",
    iconName: "Image",
    color: "from-rose-500 to-pink-600",
    badge: "Ultra HD",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "pdf-to-text",
    title: "PDF to Word / Text",
    shortDesc: "Extract raw readable text, paragraphs, and formatted headings without losing word boundaries.",
    category: "convert-from",
    iconName: "FileText",
    color: "from-cyan-500 to-blue-600",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "pdf-to-csv",
    title: "PDF to Excel / CSV",
    shortDesc: "Detect and extract tabular columns and rows from your PDF into a clean CSV spreadsheet.",
    category: "convert-from",
    iconName: "Table",
    color: "from-teal-500 to-emerald-600",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },

  // 6. EDIT & BRANDING
  {
    id: "watermark",
    title: "Watermark PDF",
    shortDesc: "Stamp custom text watermarks across every page with controllable opacity, font size, and angles.",
    category: "edit",
    iconName: "Stamp",
    color: "from-sky-500 to-cyan-600",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "page-numbers",
    title: "Page Numbers",
    shortDesc: "Add custom pagination and numbering headers or footers to your document in multiple layouts.",
    category: "edit",
    iconName: "Hash",
    color: "from-teal-500 to-emerald-600",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "crop-pdf",
    title: "Crop PDF",
    shortDesc: "Trim margins and adjust document bounding boxes for clean, standardized printing.",
    category: "edit",
    iconName: "Crop",
    color: "from-indigo-500 to-blue-600",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },

  // 7. SECURITY, SIGN & COMPARE
  {
    id: "compare-pdf",
    title: "Compare PDF",
    shortDesc: "Side-by-side visual difference tool comparing two PDF versions to spot changes and edits.",
    category: "security",
    iconName: "GitCompare",
    color: "from-violet-600 to-indigo-600",
    badge: "Side-by-Side Diff",
    supportsMulti: true,
    acceptedTypes: "application/pdf",
  },
  {
    id: "protect",
    title: "Protect PDF",
    shortDesc: "Encrypt your PDF document with modern 128/256-bit encryption and a secure password.",
    category: "security",
    iconName: "Lock",
    color: "from-rose-600 to-pink-600",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "unlock",
    title: "Unlock PDF",
    shortDesc: "Remove password protection and viewing permissions from your PDF documents.",
    category: "security",
    iconName: "Unlock",
    color: "from-amber-500 to-yellow-600",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "sign",
    title: "Sign PDF",
    shortDesc: "Digitally sign documents by drawing your signature or typing a custom stylized signature stamp.",
    category: "security",
    iconName: "Pen",
    color: "from-emerald-500 to-teal-600",
    badge: "Digital Signature",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
  {
    id: "redact",
    title: "Redact PDF",
    shortDesc: "Permanently blackout sensitive text, account numbers, or personal data before publishing.",
    category: "security",
    iconName: "EyeOff",
    color: "from-zinc-700 to-zinc-900",
    badge: "Privacy",
    supportsMulti: false,
    acceptedTypes: "application/pdf",
  },
];
