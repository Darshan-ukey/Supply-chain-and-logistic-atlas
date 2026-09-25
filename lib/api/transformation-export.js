import {buildXlsx,buildPptx,buildPdf} from './_office.js';
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 const format=String(req.query?.format||'').toLowerCase();const pack=req.body?.pack;
 if(!pack||typeof pack!=='object')return res.status(400).json({error:'PACK_REQUIRED'});
 const raw=JSON.stringify(pack);if(Buffer.byteLength(raw)>1024*1024)return res.status(413).json({error:'PACK_TOO_LARGE'});
 try{let buf,type,name;if(format==='xlsx'){buf=buildXlsx(pack);type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';name='atlas-transformation-pack.xlsx'}else if(format==='pptx'){buf=buildPptx(pack);type='application/vnd.openxmlformats-officedocument.presentationml.presentation';name='atlas-transformation-pack.pptx'}else if(format==='pdf'){buf=buildPdf(pack);type='application/pdf';name='atlas-transformation-pack.pdf'}else return res.status(400).json({error:'UNSUPPORTED_FORMAT'});res.setHeader('Content-Type',type);res.setHeader('Content-Disposition',`attachment; filename="${name}"`);res.setHeader('Cache-Control','no-store');return res.status(200).send(buf)}catch(e){return res.status(500).json({error:'EXPORT_FAILED',message:e.message})}
}
