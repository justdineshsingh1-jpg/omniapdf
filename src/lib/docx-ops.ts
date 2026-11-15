import JSZip from "jszip";

// Compress embedded images inside a DOCX file
export async function compressDocx(
  file: File,
  quality: number = 0.7,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  onProgress?.("Reading Word document archive...");
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  // Look for embedded images in word/media/
  const mediaFiles: { name: string; file: JSZip.JSZipObject }[] = [];
  zip.forEach((relativePath, zipEntry) => {
    if (relativePath.startsWith("word/media/") && !zipEntry.dir) {
      mediaFiles.push({ name: relativePath, file: zipEntry });
    }
  });

  if (mediaFiles.length > 0) {
    onProgress?.(`Found ${mediaFiles.length} embedded images. Optimizing media...`);

    for (let i = 0; i < mediaFiles.length; i++) {
      const item = mediaFiles[i];
      onProgress?.(`Compressing image ${i + 1} of ${mediaFiles.length}...`);

      try {
        const imgBuffer = await item.file.async("arraybuffer");
        const mimeType = item.name.endsWith(".png") ? "image/png" : "image/jpeg";
        const imgBlob = new Blob([imgBuffer], { type: mimeType });

        // Decode image in browser
        const bitmap = await createImageBitmap(imgBlob);
        const canvas = document.createElement("canvas");

        // Scale down if image is huge (e.g. > 1920px wide)
        let targetWidth = bitmap.width;
        let targetHeight = bitmap.height;
        const maxDim = 1920;

        if (targetWidth > maxDim || targetHeight > maxDim) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
            targetWidth = maxDim;
          } else {
            targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
            targetHeight = maxDim;
          }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
          const compressedBlob: Blob | null = await new Promise((resolve) =>
            canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
          );

          if (compressedBlob && compressedBlob.size < imgBlob.size) {
            const newBytes = await compressedBlob.arrayBuffer();
            zip.file(item.name, newBytes);
          }
        }
      } catch (err) {
        console.warn(`Could not compress image ${item.name}:`, err);
      }
    }
  }

  onProgress?.("Re-packing document with level 9 deflate compression...");
  return await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// Merge multiple DOCX files into one
export async function mergeDocxFiles(
  files: File[],
  onProgress?: (msg: string) => void
): Promise<Blob> {
  if (files.length === 0) throw new Error("No files to merge");
  if (files.length === 1) return files[0];

  onProgress?.("Reading base Word document...");
  const firstBuffer = await files[0].arrayBuffer();
  const baseZip = await JSZip.loadAsync(firstBuffer);

  const docXmlFile = baseZip.file("word/document.xml");
  if (!docXmlFile) throw new Error("Invalid DOCX format: word/document.xml not found");

  let baseXml = await docXmlFile.async("string");

  // Locate the closing </w:body>
  const bodyCloseIndex = baseXml.lastIndexOf("</w:body>");
  if (bodyCloseIndex === -1) throw new Error("Invalid DOCX XML structure");

  // Extract the sectPr (section properties) from the first file so we keep it at the very end
  const sectPrMatch = baseXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const baseSectPr = sectPrMatch ? sectPrMatch[0] : "";

  // Content before the sectPr
  let mergedBody = baseXml.substring(
    baseXml.indexOf("<w:body>") + "<w:body>".length,
    sectPrMatch ? sectPrMatch.index! : bodyCloseIndex
  );

  // Append subsequent files
  for (let i = 1; i < files.length; i++) {
    onProgress?.(`Appending document ${i + 1} of ${files.length} (${files[i].name})...`);
    const nextBuffer = await files[i].arrayBuffer();
    const nextZip = await JSZip.loadAsync(nextBuffer);

    const nextDocXml = nextZip.file("word/document.xml");
    if (!nextDocXml) continue;

    const nextXml = await nextDocXml.async("string");
    const nextBodyOpen = nextXml.indexOf("<w:body>");
    const nextBodyClose = nextXml.lastIndexOf("</w:body>");

    if (nextBodyOpen !== -1 && nextBodyClose !== -1) {
      let nextContent = nextXml.substring(nextBodyOpen + "<w:body>".length, nextBodyClose);
      // Remove its sectPr so it flows continuously
      nextContent = nextContent.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, "");

      // Insert Page Break before appending next document
      const pageBreak = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
      mergedBody += pageBreak + nextContent;
    }
  }

  // Re-assemble final document.xml
  const finalDocXml =
    baseXml.substring(0, baseXml.indexOf("<w:body>") + "<w:body>".length) +
    mergedBody +
    baseSectPr +
    "</w:body></w:document>";

  baseZip.file("word/document.xml", finalDocXml);

  onProgress?.("Packaging merged Word document...");
  return await baseZip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
