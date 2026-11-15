import fs from 'fs';
import { PDFDocument, PDFName } from 'pdf-lib';

async function checkPdfLibFonts() {
  const buf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];
  const { node } = page;
  const resources = node.Resources();
  const fontDict = resources?.lookup(PDFName.of('Font'));
  
  if (fontDict) {
    const entries = fontDict.entries();
    for (const [k, v] of entries) {
      console.log('Font key:', k.toString());
      try {
        const obj = pdfDoc.context.lookup(v);
        console.log('  BaseFont:', obj.get(PDFName.of('BaseFont'))?.toString());
        console.log('  Subtype:', obj.get(PDFName.of('Subtype'))?.toString());
      } catch (e) {
        console.log('  error reading font:', e.message);
      }
    }
  }
}
checkPdfLibFonts().catch(console.error);
