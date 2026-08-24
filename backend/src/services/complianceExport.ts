import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import prisma from '../utils/prisma.js';

const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const esc=(v:unknown)=>{if(v===null||v===undefined)return '';const s=v instanceof Date?v.toISOString():typeof v==='object'?JSON.stringify(v):String(v);return /[,"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
const csv=(rows:Record<string,unknown>[])=>{const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];return [keys.map(esc).join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n');};
const plain=(value:any)=>JSON.parse(JSON.stringify(value));

export async function collectCompliance(userId:string,from:Date,to:Date,apiaryId?:string){
 const memberships=await prisma.userApiary.findMany({where:{userId,...(apiaryId&&{apiaryId})},select:{apiaryId:true}});const apiaryIds=memberships.map(x=>x.apiaryId);
 const apiaries=await prisma.apiary.findMany({where:{id:{in:apiaryIds}}});const hives=await prisma.hive.findMany({where:{apiaryId:{in:apiaryIds}}});const hiveIds=hives.map(x=>x.id);
 const [placements,inspections,treatments,events,production,batches,audit,documents,acquisitions]=await Promise.all([
  prisma.hivePlacement.findMany({where:{hiveId:{in:hiveIds},startedAt:{lt:to},OR:[{endedAt:null},{endedAt:{gt:from}}]}}),
  prisma.inspection.findMany({where:{hiveId:{in:hiveIds},inspectionDate:{gte:from,lt:to}}}),
  prisma.treatment.findMany({where:{hiveId:{in:hiveIds},startDate:{lt:to},OR:[{endDate:null},{endDate:{gte:from}}]}}),
  prisma.complianceEvent.findMany({where:{OR:[{apiaryId:{in:apiaryIds}},{hiveId:{in:hiveIds}}],occurredAt:{gte:from,lt:to}}}),
  prisma.production.findMany({where:{OR:[{apiaryId:{in:apiaryIds}},{hiveId:{in:hiveIds}}],harvestDate:{gte:from,lt:to}}}),
  prisma.productionBatch.findMany({where:{userId,harvestStartedAt:{lt:to},OR:[{harvestEndedAt:null},{harvestEndedAt:{gte:from}}]},include:{sources:true}}),
  prisma.auditLog.findMany({where:{userId,occurredAt:{gte:from,lt:to}}}),
  prisma.complianceDocument.findMany({where:{userId}}),prisma.medicineAcquisition.findMany({where:{userId,acquiredOn:{gte:from,lt:to}}})
 ]);
 const quality:string[]=[];for(const h of hives)if(!placements.some(p=>p.hiveId===h.id&&!p.endedAt&&!p.voidedAt))quality.push(`Kube ${h.hiveNumber} mangler åpen plassering`);
 for(const h of hives){const periods=placements.filter(p=>p.hiveId===h.id&&!p.voidedAt).sort((a,b)=>a.startedAt.getTime()-b.startedAt.getTime());for(let i=1;i<periods.length;i++){if(!periods[i-1].endedAt||periods[i-1].endedAt!>periods[i].startedAt)quality.push(`Kube ${h.hiveNumber} har overlappende plasseringer`);}}
 for(const t of treatments){const missing=['administeredAmount','administeredUnit','supplierName','acquisitionDate','withholdingPeriodDays'].filter(k=>(t as any)[k]===null||(t as any)[k]===undefined);if(missing.length)quality.push(`Behandling ${t.id} mangler: ${missing.join(', ')}`);}
 for(const d of documents){try{const file=await fs.readFile(d.storagePath);if(sha(file)!==d.sha256)quality.push(`Dokument ${d.id} har feil SHA-256`);}catch{quality.push(`Dokument ${d.id} mangler fil`);}}
 const batchedProduction=new Set(batches.flatMap(b=>b.sources.map(s=>s.productionId)));for(const p of production)if(!batchedProduction.has(p.id))quality.push(`Produksjon ${p.id} er ikke knyttet til parti`);
 return {apiaries,hives,placements,inspections,treatments,events,production,batches,audit,documents,acquisitions,quality};
}
export async function compliancePdf(userId:string,from:Date,to:Date,apiaryId?:string){
 const data=await collectCompliance(userId,from,to,apiaryId);const doc=new PDFDocument({margin:45});const chunks:Buffer[]=[];doc.on('data',c=>chunks.push(c));
 doc.fontSize(20).text('Samlet myndighetsjournal');doc.fontSize(9).text(`Periode: ${from.toISOString()} – ${to.toISOString()}`).text(`Generert: ${new Date().toISOString()}`).moveDown();
 doc.fontSize(10).text('Samlet rapport over registrerte opplysninger. Kontroller at journalen er fullstendig før den brukes som dokumentasjon.').moveDown();
 for(const [title,rows] of [['Bigårder',data.apiaries],['Kuber',data.hives],['Plasseringer',data.placements],['Inspeksjoner',data.inspections],['Behandlinger',data.treatments],['Helse og kontroll',data.events],['Produksjonspartier',data.batches]] as const){doc.fontSize(14).text(title);doc.fontSize(8).text(JSON.stringify(plain(rows),null,2)).moveDown();}
 doc.fontSize(14).text('Datakvalitetsavvik');doc.fontSize(9).text(data.quality.length?data.quality.join('\n'):'Ingen avvik funnet av automatiske kontroller.');
 doc.end();await new Promise<void>(resolve=>doc.on('end',resolve));return Buffer.concat(chunks);
}
export async function complianceZip(userId:string,from:Date,to:Date,appVersion:string){
 const data=await collectCompliance(userId,from,to);const files:Record<string,Buffer>={};
 for(const [name,rows] of [['apiaries.csv',data.apiaries],['hives.csv',data.hives],['placements.csv',data.placements],['inspections.csv',data.inspections],['treatments.csv',data.treatments],['medicine-acquisitions.csv',data.acquisitions],['compliance-events.csv',data.events],['production.csv',data.production],['production-batches.csv',data.batches],['audit-log.csv',data.audit],['documents.csv',data.documents]] as const)files[name]=Buffer.from(csv(plain(rows)),'utf8');
 for(const d of data.documents){try{files[`documents/${d.id}-${d.originalName.replace(/[^a-zA-Z0-9._-]/g,'_')}`]=await fs.readFile(d.storagePath);}catch{/* reported in manifest */}}
 const manifest={exportVersion:'1.0',generatedAt:new Date().toISOString(),userId,period:{from:from.toISOString(),to:to.toISOString()},applicationVersion:appVersion,counts:Object.fromEntries(Object.entries(files).filter(([n])=>n.endsWith('.csv')).map(([n,b])=>[n,b.toString().split('\n').length-1])),files:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,{sha256:sha(b),bytes:b.length}])),dataQuality:data.quality};
 files['manifest.json']=Buffer.from(JSON.stringify(manifest,null,2));const archive=archiver('zip',{zlib:{level:9}});const chunks:Buffer[]=[];archive.on('data',c=>chunks.push(c));for(const [name,b] of Object.entries(files))archive.append(b,{name});await new Promise<void>((resolve,reject)=>{archive.on('end',resolve);archive.on('error',reject);void archive.finalize();});return Buffer.concat(chunks);
}
