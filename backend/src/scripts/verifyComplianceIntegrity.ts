import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import prisma from '../utils/prisma.js';

async function main(){
 const critical:string[]=[];const warnings:string[]=[];
 const treatments=await prisma.treatment.findMany({where:{retentionUntil:null},select:{id:true}});
 for(const x of treatments)critical.push(`Treatment ${x.id} has no retentionUntil`);
 const documents=await prisma.complianceDocument.findMany();
 for(const d of documents){
  try{const file=await fs.readFile(d.storagePath);const hash=createHash('sha256').update(file).digest('hex');if(hash!==d.sha256)critical.push(`Document ${d.id} has SHA-256 mismatch`);}
  catch{critical.push(`Document ${d.id} file is missing`);}
  const parent=d.entityType==='treatment'?await prisma.treatment.findUnique({where:{id:d.entityId}}):d.entityType==='production_batch'?await prisma.productionBatch.findUnique({where:{id:d.entityId}}):await prisma.complianceEvent.findUnique({where:{id:d.entityId}});
  if(!parent)critical.push(`Document ${d.id} is orphaned`);
 }
 const hives=await prisma.hive.findMany();
 for(const h of hives){const open=await prisma.hivePlacement.findMany({where:{hiveId:h.id,endedAt:null,voidedAt:null}});if(open.length!==1)critical.push(`Hive ${h.id} has ${open.length} open placements`);else if(open[0].apiaryId!==h.apiaryId)critical.push(`Hive ${h.id} cache differs from open placement`);}
 const oldRequests=await prisma.idempotencyRequest.count({where:{expiresAt:{lt:new Date()}}});
 if(oldRequests)warnings.push(`${oldRequests} expired idempotency requests can be pruned by a controlled maintenance job`);
 console.log(JSON.stringify({checkedAt:new Date().toISOString(),critical,warnings},null,2));if(critical.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
