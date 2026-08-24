import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import prisma from '../utils/prisma.js';
import { env } from '../config/env.js';
import { addCalendarYears, auditData } from '../services/complianceService.js';
import { hiveAccess } from '../services/accessService.js';
import { ErrorCodes, sendError, sendSuccess } from '../utils/response.js';

const router=Router();router.use(authenticate);
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:env.COMPLIANCE_MAX_FILE_BYTES,files:1}});
const singleFile=(req:Request,res:Response,next:NextFunction)=>upload.single('file')(req,res,error=>{if(error instanceof multer.MulterError&&error.code==='LIMIT_FILE_SIZE'){sendError(res,ErrorCodes.VALIDATION_ERROR,'File exceeds configured maximum size',413);return;}if(error){sendError(res,ErrorCodes.VALIDATION_ERROR,'Invalid multipart upload',422);return;}next();});
const metadata=z.object({entityType:z.enum(['treatment','compliance_event','production_batch','official_control']),entityId:z.string().uuid(),documentType:z.enum(['receipt','invoice','prescription','lab_report','control_report','photo','other']),documentDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),issuer:z.string().trim().max(255).optional(),reference:z.string().trim().max(255).optional()});
const idSchema=z.object({id:z.string().uuid()});const voidSchema=z.object({reason:z.string().trim().min(1).max(1000)});
const signatures=[{mime:'application/pdf',ok:(b:Buffer)=>b.subarray(0,5).toString()==='%PDF-'},{mime:'image/jpeg',ok:(b:Buffer)=>b[0]===0xff&&b[1]===0xd8},{mime:'image/png',ok:(b:Buffer)=>b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))},{mime:'image/webp',ok:(b:Buffer)=>b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'}];
async function owns(userId:string,type:string,id:string){
 if(type==='treatment'){const x=await prisma.treatment.findUnique({where:{id}});return !!x&&!!await hiveAccess(userId,x.hiveId);}
 if(type==='production_batch')return !!await prisma.productionBatch.findFirst({where:{id,userId}});
 const x=await prisma.complianceEvent.findUnique({where:{id}});if(!x)return false;if(type==='official_control'&&x.eventType!=='official_control')return false;
 return (!x.hiveId||!!await hiveAccess(userId,x.hiveId))&&(!x.apiaryId||!!await prisma.userApiary.findUnique({where:{userId_apiaryId:{userId,apiaryId:x.apiaryId}}}));
}
router.post('/',singleFile,async(req,res)=>{
 const parsed=metadata.safeParse(req.body);if(!parsed.success){sendError(res,ErrorCodes.VALIDATION_ERROR,'Invalid document metadata',422,parsed.error.issues.map(i=>({field:i.path.join('.'),message:i.message})));return;}
 if(!req.file||req.file.size===0){sendError(res,ErrorCodes.VALIDATION_ERROR,'A non-empty file is required',422);return;}
 const signature=signatures.find(s=>s.mime===req.file!.mimetype);if(!signature||!signature.ok(req.file.buffer)){sendError(res,ErrorCodes.VALIDATION_ERROR,'File content does not match an allowed MIME type',422);return;}
 const userId=req.user!.id;if(!await owns(userId,parsed.data.entityType,parsed.data.entityId)){sendError(res,ErrorCodes.FORBIDDEN,'No access to linked record',403);return;}
 const safeOriginal=path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._æøåÆØÅ-]/g,'_').slice(0,200);const ext=path.extname(safeOriginal).toLowerCase();const fileName=`${randomUUID()}${ext}`;const root=path.resolve(env.COMPLIANCE_DOCUMENT_DIR);await fs.mkdir(root,{recursive:true});const storagePath=path.join(root,fileName);await fs.writeFile(storagePath,req.file.buffer);const sha256=createHash('sha256').update(req.file.buffer).digest('hex');
 try{const row=await prisma.$transaction(async tx=>{const created=await tx.complianceDocument.create({data:{userId,...parsed.data,originalName:safeOriginal,storagePath,mimeType:req.file!.mimetype,fileSize:req.file!.size,sha256,documentDate:parsed.data.documentDate?new Date(`${parsed.data.documentDate}T00:00:00.000Z`):null,retentionUntil:addCalendarYears(parsed.data.documentDate?new Date(`${parsed.data.documentDate}T00:00:00.000Z`):new Date())}});await tx.auditLog.create({data:auditData({userId,entityType:'ComplianceDocument',entityId:created.id,action:'create',after:{...created,storagePath:'[protected]'},requestId:res.locals.requestId})});return created;});sendSuccess(res,{...row,storagePath:undefined},201);}catch(e){await fs.unlink(storagePath).catch(()=>undefined);throw e;}
});
router.get('/:id',validateParams(idSchema),async(req,res)=>{const row=await prisma.complianceDocument.findUnique({where:{id:req.params.id}});if(!row||!await owns(req.user!.id,row.entityType,row.entityId)){sendError(res,ErrorCodes.NOT_FOUND,'Document not found',404);return;}sendSuccess(res,{...row,storagePath:undefined});});
router.get('/:id/download',validateParams(idSchema),async(req,res)=>{const row=await prisma.complianceDocument.findUnique({where:{id:req.params.id}});if(!row||!await owns(req.user!.id,row.entityType,row.entityId)){sendError(res,ErrorCodes.NOT_FOUND,'Document not found',404);return;}res.type(row.mimeType);res.setHeader('Content-Disposition',`attachment; filename="${encodeURIComponent(row.originalName)}"`);res.sendFile(path.resolve(row.storagePath));});
router.post('/:id/void',validateParams(idSchema),validateBody(voidSchema),async(req,res)=>{const before=await prisma.complianceDocument.findUnique({where:{id:req.params.id}});if(!before||!await owns(req.user!.id,before.entityType,before.entityId)){sendError(res,ErrorCodes.NOT_FOUND,'Document not found',404);return;}const userId=req.user!.id;const row=await prisma.$transaction(async tx=>{const updated=await tx.complianceDocument.update({where:{id:before.id},data:{voidedAt:new Date(),voidReason:req.body.reason,voidedById:userId}});await tx.auditLog.create({data:auditData({userId,entityType:'ComplianceDocument',entityId:before.id,action:'void',before:{...before,storagePath:'[protected]'},after:{...updated,storagePath:'[protected]'},reason:req.body.reason,requestId:res.locals.requestId})});return updated;});sendSuccess(res,{...row,storagePath:undefined});});
export default router;
