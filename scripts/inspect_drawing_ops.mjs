import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function inspectDrawingOps() {
  const editedBuf = fs.readFileSync('C:/Users/Asus/Downloads/Panel APDCL Subdivision list_edited.pdf');
  const editedDoc = await pdfjs.getDocument({ data: new Uint8Array(editedBuf) }).promise;
  const page1 = await editedDoc.getPage(1);
  const ops = await page1.getOperatorList();
  console.log('Total ops:', ops.fnArray.length);

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    // Find draw rectangles or construct path
    if (fn === pdfjs.OPS.paintSolidColorImageMask || fn === pdfjs.OPS.constructPath) {
      if (args && args[1] && args[1].length < 10) {
        console.log('Path op at', i, args[0], args[1]);
      }
    }
  }
}
inspectDrawingOps().catch(console.error);
