import {Request,Response} from 'express';import prisma from '../utils/prisma.js';import{ErrorCodes,sendError}from'../utils/response.js';import{stableRequestHash}from'./complianceService.js';
export async function executeIdempotent<T>(req:Request,res:Response,status:number,work:()=>Promise<T>):Promise<T|undefined>{
 const key=req.header('Idempotency-Key');if(!key)return work();if(key.length>255){sendError(res,ErrorCodes.VALIDATION_ERROR,'Idempotency-Key is too long',400);return;}
 const userId=req.user!.id,route=req.path,requestHash=stableRequestHash(req.body);const existing=await prisma.idempotencyRequest.findUnique({where:{userId_route_key:{userId,route,key}}});
 if(existing){if(existing.requestHash!==requestHash){sendError(res,ErrorCodes.IDEMPOTENCY_KEY_REUSED,'Idempotency key was reused with a different request',409);return;}if(existing.responseJson&&existing.statusCode){res.status(existing.statusCode).json(JSON.parse(existing.responseJson));return;}sendError(res,'REQUEST_IN_PROGRESS','The original request is still processing',409);return;}
 await prisma.idempotencyRequest.create({data:{userId,route,key,requestHash,expiresAt:new Date(Date.now()+24*3600_000)}});
 try{const data=await work();const envelope={success:true,data,meta:{timestamp:new Date().toISOString(),requestId:res.locals.requestId}};await prisma.idempotencyRequest.update({where:{userId_route_key:{userId,route,key}},data:{state:'completed',statusCode:status,responseJson:JSON.stringify(envelope)}});res.status(status).json(envelope);return;}
 catch(error){await prisma.idempotencyRequest.delete({where:{userId_route_key:{userId,route,key}}}).catch(()=>undefined);throw error;}
}
