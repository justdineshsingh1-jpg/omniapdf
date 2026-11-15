import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

async function checkContentStream() {
  const buf = fs.readFileSync('C:/Users/Asus/OneDrive/Desktop/Panel APDCL Subdivision list.pdf');
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];
  const { Contents } = page.node;
  console.log('Contents type:', Contents?.constructor?.name);

  // In pdf-lib, page.node.Contents() returns the stream or array of streams
  const contents = page.node.Contents();
  console.log('contents:', contents);
}
checkContentStream().catch(console.error);
