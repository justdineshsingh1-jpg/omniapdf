import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function inspectItems() {
  const origBuf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const editedBuf = fs.readFileSync('C:/Users/Asus/Downloads/Panel APDCL Subdivision list_edited.pdf');

  const origDoc = await pdfjs.getDocument({ data: new Uint8Array(origBuf) }).promise;
  const editedDoc = await pdfjs.getDocument({ data: new Uint8Array(editedBuf) }).promise;

  const origPage1 = await origDoc.getPage(1);
  const origContent = await origPage1.getTextContent();

  const editedPage1 = await editedDoc.getPage(1);
  const editedContent = await editedPage1.getTextContent();

  console.log('\n--- ALL ITEMS ON ORIG PAGE 1 ---');
  origContent.items.forEach((it, i) => {
    if (it.str && it.str.trim()) {
      console.log(`[orig ${i}] "${it.str}" tx=[${it.transform.map(n=>Math.round(n*10)/10)}] w=${Math.round(it.width*10)/10}`);
    }
  });

  console.log('\n--- ALL ITEMS ON EDITED PAGE 1 ---');
  editedContent.items.forEach((it, i) => {
    if (it.str && it.str.trim()) {
      console.log(`[edited ${i}] "${it.str}" tx=[${it.transform.map(n=>Math.round(n*10)/10)}] w=${Math.round(it.width*10)/10}`);
    }
  });
}
inspectItems().catch(console.error);
