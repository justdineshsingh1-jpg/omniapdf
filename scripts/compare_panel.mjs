import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function compare() {
  const origBuf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const editedBuf = fs.readFileSync('C:/Users/Asus/Downloads/Panel APDCL Subdivision list_edited.pdf');

  const origDoc = await pdfjs.getDocument({ data: new Uint8Array(origBuf) }).promise;
  const editedDoc = await pdfjs.getDocument({ data: new Uint8Array(editedBuf) }).promise;

  console.log('Original pages:', origDoc.numPages, 'Edited pages:', editedDoc.numPages);

  const origPage1 = await origDoc.getPage(1);
  const origContent = await origPage1.getTextContent();

  const editedPage1 = await editedDoc.getPage(1);
  const editedContent = await editedPage1.getTextContent();

  console.log('\n--- ORIGINAL PAGE 1 (first 25 items) ---');
  origContent.items.slice(0, 25).forEach((it, i) => {
    if (it.str && it.str.trim()) {
      console.log(`[${i}] "${it.str}" tx=[${it.transform.map(n=>Math.round(n*10)/10)}] font=${it.fontName} (${origContent.styles[it.fontName]?.fontFamily}) w=${Math.round(it.width*10)/10}`);
    }
  });

  console.log('\n--- EDITED PAGE 1 (first 25 items) ---');
  editedContent.items.slice(0, 25).forEach((it, i) => {
    if (it.str && it.str.trim()) {
      console.log(`[${i}] "${it.str}" tx=[${it.transform.map(n=>Math.round(n*10)/10)}] font=${it.fontName} (${editedContent.styles[it.fontName]?.fontFamily}) w=${Math.round(it.width*10)/10}`);
    }
  });
}

compare().catch(console.error);
