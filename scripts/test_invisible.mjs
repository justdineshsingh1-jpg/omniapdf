import fs from 'fs';
import zlib from 'zlib';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testMakeInvisible() {
  const origBuf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const pdfDoc = await PDFDocument.load(origBuf);
  const page = pdfDoc.getPages()[0];
  const stream = page.node.Contents();
  const decompressed = zlib.inflateSync(stream.contents).toString('binary');

  // Let's find the Tm block for item 40 (Panjabari) or item 41
  // Let's print out all BT ... ET blocks
  const btBlocks = decompressed.match(/BT[\s\S]*?ET/g);
  console.log('Total BT blocks:', btBlocks.length);

  // Let's inspect block 38, 39, 40, 41
  for (let i = 35; i < 45; i++) {
    console.log(`Block ${i}:`, btBlocks[i]);
  }
}
testMakeInvisible().catch(console.error);
