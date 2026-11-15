import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const buf = fs.readFileSync('C:/Users/Asus/.gemini/antigravity/brain/a6217b6c-7e5b-4330-b93f-05541bf98671/.user_uploaded/media_1794739671639_0a4eecb9.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();
  console.log('Total operators on page 1:', ops.fnArray.length);
  // Check for lines/rectangles
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === pdfjs.OPS.constructPath) {
      console.log('Path ops:', args[0], 'args:', args[1]);
    }
  }
}
run().catch(console.error);
