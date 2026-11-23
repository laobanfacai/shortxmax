// Single-process bounded rate limiter; deploy a shared Redis store before horizontal scaling.
const attempts = new Map<string, { n: number; until: number }>();
export function allowAuth(req: Request, email: string) {
 const now = Date.now();
 if (attempts.size > 10000) for (const [k,v] of attempts) if (v.until < now) attempts.delete(k);
 const key = email.toLowerCase().slice(0,254);
 const old = attempts.get(key);
 const entry = old && old.until > now ? old : { n:0, until: now + 15*60*1000 };
 entry.n++; attempts.set(key,entry); return entry.n <= 20;
}
export function validPassword(password: string) { return password.length >= 8 && Buffer.byteLength(password,"utf8") <= 72; }
