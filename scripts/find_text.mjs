import fs from 'fs';
import zlib from 'zlib';
import { PDFDocument } from 'pdf-lib';

async function findTextInStream() {
  const buf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];
  const stream = page.node.Contents();
  const decompressed = zlib.inflateSync(stream.contents).toString('binary');

  console.log('Stream length:', decompressed.length);
  
  // Search for strings in the stream
  const keywords = ['Panjabari', 'Ahmed', 'Sachal', 'Juripar'];
  for (const kw of keywords) {
    const idx = decompressed.indexOf(kw);
    console.log(`Keyword "${kw}": index = ${idx}`);
  }
}
findTextInStream().catch(console.error);
