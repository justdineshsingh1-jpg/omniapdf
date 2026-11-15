import fs from 'fs';
import zlib from 'zlib';
import { PDFDocument } from 'pdf-lib';

async function searchCoordsInStream() {
  const buf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];
  const stream = page.node.Contents();
  const decompressed = zlib.inflateSync(stream.contents).toString('binary');

  // Remember the stream has a transform at the top:
  // .23999999 0 0 -.23999999 0 842.88 cm
  // q ... 3.125 0 0 3.125 306.25 225 cm ...
  console.log('Searching for Tm operators:');
  const matches = decompressed.match(/[\d\.\-]+ [\d\.\-]+ [\d\.\-]+ [\d\.\-]+ [\d\.\-]+ [\d\.\-]+ Tm/g);
  console.log('Total Tm operators:', matches ? matches.length : 0);
  if (matches) {
    console.log('First 10 Tm:', matches.slice(0, 10));
  }
}
searchCoordsInStream().catch(console.error);
