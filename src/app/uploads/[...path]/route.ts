import { createReadStream, statSync, existsSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { publicUploadRoot, uploadRoot } from "@/lib/storage";

export const runtime = "nodejs";

function resolveFile(relParts: string[]) {
  const rel = path.join(...relParts);
  if (rel.includes("..")) return null;
  const candidates = [path.join(publicUploadRoot(), rel), path.join(uploadRoot(), rel)];
  for (const file of candidates) {
    if (existsSync(file)) return file;
  }
  return null;
}

function contentType(file: string) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  if (parts?.[0] === "videos") return new Response("Use authorized episode playback", { status: 403 });
  const file = resolveFile(parts || []);
  if (!file) return new Response("Not found", { status: 404 });
  const stat = statSync(/*turbopackIgnore: true*/ file);
  const type = contentType(file);
  const range = req.headers.get("range");
  if (range) {
    const match = /bytes=(\d+)-(\d+)?/.exec(range);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : Math.min(start + 1024 * 1024, stat.size - 1);
      if (start >= stat.size || end >= stat.size) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${stat.size}` },
        });
      }
      const stream = createReadStream(/*turbopackIgnore: true*/ file, { start, end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": type,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }
  const stream = createReadStream(/*turbopackIgnore: true*/ file);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
