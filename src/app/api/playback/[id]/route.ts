import { prisma } from "@/lib/prisma";
import { getCurrentUser, getBannedViewer } from "@/lib/auth";
import { canWatchEpisode } from "@/lib/access";
import { uploadRoot } from "@/lib/storage";
import { createReadStream, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;const ep=await prisma.episode.findFirst({where:{id,isPublished:true,series:{status:"published"}}});
 if(!ep?.videoUrl)return new Response("Not found",{status:404});
 if(await getBannedViewer())return new Response("Disabled account",{status:403});
 const user=await getCurrentUser();const access=await canWatchEpisode({userId:user?.id,episodeId:id,isFree:ep.isFree});if(!access.allowed)return new Response("VIP or episode unlock required",{status:403});
 const headers:Record<string,string>={"Cache-Control":"private, no-store","Content-Type":"video/mp4","Accept-Ranges":"bytes"};
 if(!ep.videoUrl.startsWith("/uploads/")) {
 // Public CDN mode is explicitly not DRM: access checked here, configured remote URL remains public.
 return Response.redirect(ep.videoUrl,307);
 }
 const root=uploadRoot();const file=path.resolve(root,ep.videoUrl.slice("/uploads/".length));if(!file.startsWith(root+path.sep))return new Response("Invalid path",{status:400});
 let size:number;try{size=statSync(file).size;}catch{return new Response("Media missing",{status:404});}
 let start=0,end=size-1;const range=req.headers.get("range");
 if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match)return new Response("Unsupported range",{status:416});start=Number(match[1]);end=match[2]?Number(match[2]):Math.min(start+1024*1024,size-1);if(start>end||end>=size)return new Response("Invalid range",{status:416});headers["Content-Range"]=`bytes ${start}-${end}/${size}`;}
 headers["Content-Length"]=String(end-start+1);
 const stream=createReadStream(/*turbopackIgnore: true*/ file,{start,end});return new Response(Readable.toWeb(stream) as ReadableStream,{status:range?206:200,headers});
}
