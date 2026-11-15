import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const buf = fs.readFileSync('C:/Users/Asus/.gemini/antigravity/brain/a6217b6c-7e5b-4330-b93f-05541bf98671/.user_uploaded/media_1794739671639_0a4eecb9.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  console.log('Pages:', doc.numPages);
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const matches = content.items.filter(it => 
      it.str && (
        it.str.includes('Dr Zakir') || 
        it.str.includes('Ahmed') || 
        it.str.includes('Panjabari') || 
        it.str.includes('Christan') || 
        it.str.includes('SC Road') ||
        it.str.includes('Sachal')
      )
    );
    if (matches.length > 0) {
      console.log(`\n=== Page ${p} ===`);
      matches.forEach(it => {
        const style = content.styles[it.fontName];
        console.log({
          str: it.str,
          transform: it.transform,
          fontName: it.fontName,
          styleFontFamily: style?.fontFamily,
          ascent: style?.ascent,
          descent: style?.descent,
          width: it.width,
          height: it.height,
        });
      });
    }
  }
}
run().catch(console.error);
