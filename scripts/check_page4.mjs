import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const buf = fs.readFileSync('C:/Users/Asus/.gemini/antigravity/brain/a6217b6c-7e5b-4330-b93f-05541bf98671/.user_uploaded/media_1794739671639_0a4eecb9.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  console.log('Doc pages:', doc.numPages);
  
  // Search for "CCMS" or "Panel location" or "Ahmed" or "Sachal"
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const hasPanel = content.items.some(it => it.str && (it.str.includes('CCMS') || it.str.includes('Sachal') || it.str.includes('Panjabari')));
    if (hasPanel) {
      console.log(`Found table on Page ${p}:`);
      content.items.filter(it => it.str && it.str.trim()).slice(0, 30).forEach(it => {
        const style = content.styles[it.fontName];
        console.log(`[p${p}] "${it.str}" tx=[${it.transform.map(n=>Math.round(n*10)/10)}] font=${it.fontName} (${style?.fontFamily}) w=${Math.round(it.width*10)/10}`);
      });
    }
  }
}
run().catch(console.error);
