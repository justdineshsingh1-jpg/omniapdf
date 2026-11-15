import fs from 'fs';
import zlib from 'zlib';
import { PDFDocument, PDFName, PDFNumber, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testHideTextInStream() {
  const origBuf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const pdfDoc = await PDFDocument.load(origBuf);
  const page = pdfDoc.getPages()[0];
  const stream = page.node.Contents();
  let decompressed = zlib.inflateSync(stream.contents).toString('binary');

  const targetHeader = "BT\n/F8 13.3299999 Tf\n1 0 0 -1 75 361 Tm";
  console.log('Found targetHeader?', decompressed.includes(targetHeader));

  decompressed = decompressed.replace(targetHeader, "BT 3 Tr\n/F8 13.3299999 Tf\n1 0 0 -1 75 361 Tm");

  const newCompressed = zlib.deflateSync(Buffer.from(decompressed, 'binary'));
  stream.contents = newCompressed;
  stream.dict.set(PDFName.of('Length'), PDFNumber.of(newCompressed.length));

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText("Juripar -1, Colony Road", {
    x: 129.7,
    y: 518.1,
    size: 10,
    font: helvetica,
    color: rgb(0, 0, 0),
  });

  const outBytes = await pdfDoc.save();
  fs.writeFileSync('C:/Users/Asus/OneDrive/Documents/GitHub/omniapdf/public/test_invisible_out.pdf', outBytes);
  console.log('Saved test_invisible_out.pdf successfully!');

  // Now verify with PDF.js what is rendered on test_invisible_out.pdf!
  const verifyDoc = await pdfjs.getDocument({ data: new Uint8Array(outBytes) }).promise;
  const verifyPage = await verifyDoc.getPage(1);
  const verifyContent = await verifyPage.getTextContent();
  console.log('Verify Page 1 text items around Juripar:');
  verifyContent.items.filter(it => it.str && (it.str.includes('Juripar') || it.str.includes('Colony'))).forEach(it => {
    console.log('ITEM:', JSON.stringify(it.str), 'tx:', it.transform);
  });
}

testHideTextInStream().catch(console.error);
