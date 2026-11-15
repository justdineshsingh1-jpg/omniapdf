import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';

async function renderToPng() {
  const buf = fs.readFileSync('C:/Users/Asus/OneDrive/Documents/GitHub/omniapdf/public/test_precision_out.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  fs.writeFileSync('C:/Users/Asus/OneDrive/Documents/GitHub/omniapdf/public/test_precision_out.png', canvas.toBuffer('image/png'));
  console.log('Saved test_precision_out.png successfully!');
}
renderToPng().catch(err => {
  // if canvas native module is not installed, that's fine
  console.log('Canvas note:', err.message);
});
