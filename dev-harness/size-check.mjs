import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

// Build an edited PDF: block-edit the first body paragraph (add "12")
const doc = await PDFDocument.load(new Uint8Array(readFileSync('./ftp.pdf')), { ignoreEncryption: true });
doc.registerFontkit(fontkit);
const page = doc.getPages()[0];
const { width: W, height: H } = page.getSize();
const font = await doc.embedFont(new Uint8Array(readFileSync('./carlito.ttf')), { subset: false });
const B = { xFrac: 0.243, yFrac: 0.131, wFrac: 0.77, hFrac: 0.02, sizeFrac: 0.0196, lineHFrac: 0.023, text: 'Your FTP Server Credentials12 will display on the Summary page along with a link to the instructions "FTP Setup Instructions".' };
const size = B.sizeFrac*H, lineH=B.lineHFrac*H, maxW=B.wFrac*W;
page.drawRectangle({ x:B.xFrac*W-size*0.1, y:H*(1-B.yFrac-B.hFrac)-size*0.35, width:B.wFrac*W+size*0.25, height:B.hFrac*H+size*0.7, color:rgb(1,1,1) });
let baseline=H*(1-B.yFrac-0.8*B.sizeFrac); const x=B.xFrac*W;
for(const para of B.text.split('\n')){ const words=para.split(' '); let cur=''; const put=(s)=>{ if(s)page.drawText(s,{x,y:baseline,size,font,color:rgb(0,0,0)}); baseline-=lineH; }; for(const w of words){ const t=cur?`${cur} ${w}`:w; if(cur&&font.widthOfTextAtSize(t,size)>maxW){put(cur);cur=w;}else cur=t;} put(cur);}
writeFileSync('sz-out.pdf', await doc.save());

// Render + measure: cap height of the EDITED paragraph vs an UNEDITED line ("Download the FTP Client...")
const out = await pdfjs.getDocument({ data:new Uint8Array(readFileSync('./sz-out.pdf')), standardFontDataUrl:'node_modules/pdfjs-dist/standard_fonts/' }).promise;
const p1 = await out.getPage(1);
const vp = p1.getViewport({ scale: 2 });
const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height)); const ctx=canvas.getContext('2d');
ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
await p1.render({ canvasContext:ctx, viewport:vp, canvasFactory:{create:(w,h)=>{const c=createCanvas(w,h);return{canvas:c,context:c.getContext('2d')};},reset:()=>{},destroy:()=>{}} }).promise;
const data=ctx.getImageData(0,0,canvas.width,canvas.height).data; const CW=canvas.width;
function inkH(y0,y1,x0,x1){ let t=1e9,b=-1; for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=(y*CW+x)*4; if(data[i]+data[i+1]+data[i+2]<300){if(y<t)t=y;if(y>b)b=y;}} return b-t; }
// edited paragraph band (~y 0.13) and unedited "Download..." (~y 0.365) — measure "FTP" caps in each
const eH = inkH(Math.round(vp.height*0.125), Math.round(vp.height*0.145), Math.round(vp.width*0.24), Math.round(vp.width*0.45));
const oH = inkH(Math.round(vp.height*0.355), Math.round(vp.height*0.375), Math.round(vp.width*0.24), Math.round(vp.width*0.45));
console.log('EDITED paragraph ink height:', eH, ' UNEDITED line ink height:', oH, ' ratio(edited/orig):', (eH/oH).toFixed(2));
