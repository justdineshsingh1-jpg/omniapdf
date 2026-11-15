import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function inspectFonts() {
  const buf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const page1 = await doc.getPage(1);
  const content = await page1.getTextContent();

  console.log('Styles on page 1:');
  for (const [key, val] of Object.entries(content.styles)) {
    console.log(key, val);
  }
}
inspectFonts().catch(console.error);
