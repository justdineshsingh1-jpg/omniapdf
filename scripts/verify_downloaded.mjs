import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function verifyDownloaded() {
  const buf = fs.readFileSync('C:/Users/Asus/.gemini/antigravity/brain/a6217b6c-7e5b-4330-b93f-05541bf98671/browser_sandbox/downloads/panel_test_edited.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  console.log('Total items on downloaded edited page 1:', content.items.length);
  content.items.filter(it => it.str && (it.str.includes('Colony') || it.str.includes('Panjabari') || it.str.includes('140924'))).forEach(it => {
    console.log('ITEM:', JSON.stringify(it.str), 'tx:', it.transform, 'w:', it.width);
  });
}
verifyDownloaded().catch(console.error);
