import fs from 'fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import zlib from 'zlib';

async function checkToUnicode() {
  const buf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];
  const { node } = page;
  const resources = node.Resources();
  const fontDict = resources?.lookup(PDFName.of('Font'));

  for (const [k, v] of fontDict.entries()) {
    const fontObj = pdfDoc.context.lookup(v);
    const toUnicode = fontObj.get(PDFName.of('ToUnicode'));
    if (toUnicode) {
      const cmapStream = pdfDoc.context.lookup(toUnicode);
      const cmapStr = zlib.inflateSync(cmapStream.contents).toString('utf-8');
      console.log(`Font ${k.toString()} CMap sample:`, cmapStr.slice(0, 300));
    }
  }
}
checkToUnicode().catch(console.error);
