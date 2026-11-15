import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testViewport() {
  const buf = fs.readFileSync('C:/Users/Asus/.gemini/antigravity/brain/a6217b6c-7e5b-4330-b93f-05541bf98671/.user_uploaded/media_1794739671639_0a4eecb9.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.25 });
  console.log('Viewport size:', viewport.width, viewport.height);

  const testPdfPoint = [116.25, 759.63];
  const vpPoint = viewport.convertToViewportPoint(testPdfPoint[0], testPdfPoint[1]);
  console.log('PDF -> Viewport:', testPdfPoint, '->', vpPoint);
  const backToPdf = viewport.convertToPdfPoint(vpPoint[0], vpPoint[1]);
  console.log('Viewport -> PDF:', vpPoint, '->', backToPdf);
}
testViewport();
