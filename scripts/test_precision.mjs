import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testReplacement() {
  const buf = fs.readFileSync('C:/Users/Asus/.gemini/antigravity/brain/a6217b6c-7e5b-4330-b93f-05541bf98671/.user_uploaded/media_1794739671639_0a4eecb9.pdf');
  
  // 1. Extract exact info using pdfjs
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const page1 = await doc.getPage(1);
  const content = await page1.getTextContent();
  
  // Find item
  const item = content.items.find(it => it.str && it.str.includes('Dr Zakir'));
  console.log('Original item:', item.str);
  console.log('tx:', item.transform);
  console.log('width:', item.width, 'height:', item.height);

  const style = content.styles[item.fontName];
  const ascent = style?.ascent || 0.9;
  const descent = style?.descent || -0.22;
  const fontSize = Math.abs(item.transform[3] || 11);
  const pdfX = item.transform[4];
  const pdfY = item.transform[5]; // Baseline!

  // 2. Open with pdf-lib
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const oldWidth = item.width;
  const newText = "Dr Zakir Hussain path K K Handique Path";
  const newWidth = helvetica.widthOfTextAtSize(newText, fontSize);
  const maskWidth = Math.max(oldWidth, newWidth);

  // Exact tight mask bounds based on font metrics:
  // Baseline is pdfY.
  // Descent is negative, e.g. -0.22 * fontSize
  const maskY = pdfY + (descent * fontSize);
  const maskHeight = (ascent - descent) * fontSize;

  console.log('Mask rect:', { x: pdfX, y: maskY, width: maskWidth, height: maskHeight });
  console.log('Baseline pdfY:', pdfY);

  // Draw whiteout mask
  page.drawRectangle({
    x: pdfX,
    y: maskY,
    width: maskWidth,
    height: maskHeight,
    color: rgb(1, 1, 1),
  });

  // Draw replacement text at exact baseline
  page.drawText(newText, {
    x: pdfX,
    y: pdfY,
    size: fontSize,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  const outBytes = await pdfDoc.save();
  fs.writeFileSync('C:/Users/Asus/OneDrive/Documents/GitHub/omniapdf/public/test_precision_out.pdf', outBytes);
  console.log('Saved test_precision_out.pdf successfully!');
}

testReplacement().catch(console.error);
