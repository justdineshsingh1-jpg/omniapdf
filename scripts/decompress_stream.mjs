import fs from 'fs';
import zlib from 'zlib';
import { PDFDocument } from 'pdf-lib';

async function decompressStream() {
  const buf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];
  const stream = page.node.Contents();
  const decompressed = zlib.inflateSync(stream.contents).toString('utf-8');
  console.log('Stream length decompressed:', decompressed.length);
  console.log('Stream sample:\n', decompressed.slice(0, 1500));
}
decompressStream().catch(console.error);
