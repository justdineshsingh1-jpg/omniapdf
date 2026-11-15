import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const buf = fs.readFileSync('C:/Users/Asus/.gemini/antigravity/brain/a6217b6c-7e5b-4330-b93f-05541bf98671/.user_uploaded/media_1794739671639_0a4eecb9.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  for (let p=1; p<=doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const txt = content.items.map(it => it.str).join(' ');
    console.log(`Page ${p} snippet:`, txt.slice(0, 150));
  }
}
run();
