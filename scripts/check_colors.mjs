import fs from 'fs';

// Let's check if we can inspect PNG pixels or check the PDF
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function checkPdfColors() {
  const buf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();
  
  // Find fill colors
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjs.OPS.setFillRGBColor) {
      console.log('Fill RGB color:', ops.argsArray[i]);
    }
  }
}
checkPdfColors();
