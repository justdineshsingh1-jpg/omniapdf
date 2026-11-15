import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testPanelReplacement() {
  const origBuf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const pdfDoc = await PDFDocument.load(origBuf);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Extract items using PDF.js
  const doc = await pdfjs.getDocument({ data: new Uint8Array(origBuf) }).promise;
  const page1 = await doc.getPage(1);
  const content = await page1.getTextContent();

  const targetPage = pdfDoc.getPages()[0];
  const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();

  // Find all items containing "Panjabari"
  const matches = content.items.filter(it => it.str && it.str.includes('Panjabari'));
  console.log(`Found ${matches.length} items containing "Panjabari" on page 1:`);

  matches.forEach(item => {
    const origStr = item.str;
    const newStr = origStr.replaceAll('Panjabari', 'Colony Road');
    const tx = item.transform;
    const pdfX = tx[4];
    const pdfY = tx[5]; // Baseline
    const fontSize = Math.abs(tx[3] || 10);
    const origWidth = item.width;
    const newWidth = helvetica.widthOfTextAtSize(newStr, fontSize);

    const style = content.styles[item.fontName];
    const ascent = style?.ascent || 0.85;
    const descent = style?.descent || -0.22;

    // Tight mask that covers the old text fully without clipping table borders
    // Left: pdfX - 0.5 (tiny 0.5pt margin to cover anti-aliased edge)
    // Width: Math.max(origWidth, newWidth) + 1
    // Baseline is pdfY.
    // Bottom of glyphs: pdfY + descent * fontSize (descent is negative, ~ -2.1pt)
    // Height of glyphs: (ascent - descent) * fontSize (~ 10.7pt)
    const maskX = pdfX - 0.5;
    const maskY = pdfY + descent * fontSize;
    const maskWidth = Math.max(origWidth, newWidth) + 1;
    const maskHeight = (ascent - descent) * fontSize;

    console.log(`Replacing "${origStr}" -> "${newStr}":`, {
      pdfX, pdfY, fontSize, origWidth, newWidth,
      mask: { x: maskX, y: maskY, w: maskWidth, h: maskHeight }
    });

    // 1. Draw pure white mask over old text
    targetPage.drawRectangle({
      x: maskX,
      y: maskY,
      width: maskWidth,
      height: maskHeight,
      color: rgb(1, 1, 1),
    });

    // 2. Draw replacement text in exact same font (Helvetica/Arial), size, and color (black)
    targetPage.drawText(newStr, {
      x: pdfX,
      y: pdfY,
      size: fontSize,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
  });

  const outBytes = await pdfDoc.save();
  fs.writeFileSync('C:/Users/Asus/OneDrive/Documents/GitHub/omniapdf/public/test_panel_replaced.pdf', outBytes);
  console.log('Saved test_panel_replaced.pdf successfully!');
}

testPanelReplacement().catch(console.error);
