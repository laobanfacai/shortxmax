#!/usr/bin/env python3
"""
Integration test for the R2 Studio upload routes (single, multipart, resume, abort, fetch, SSE).

Run against a running site and a running R2 Studio (demo mode works):
  BASE=http://127.0.0.1:3100 STUDIO=http://127.0.0.1:8787 STUDIO_KEY=r2s_... \
  python3 tests/upload-r2studio.integration.py

Uses only the admin demo account; writes test objects under lumereel/ in R2 Studio.
"""
import concurrent.futures as cf
import json
import os
import re
import subprocess
import sys
import threading
import time

import requests

os.environ.setdefault("NO_PROXY", "127.0.0.1,localhost")

BASE = os.environ.get("BASE", "http://127.0.0.1:3100")
STUDIO = os.environ.get("STUDIO", "")
STUDIO_KEY = os.environ.get("STUDIO_KEY", "")
ADMIN = (os.environ.get("ADMIN_EMAIL", "admin@lumereel.com"), os.environ.get("ADMIN_PASSWORD", "LumeReel#Admin2026"))
FETCH_URL = os.environ.get("FETCH_URL", "https://www.w3schools.com/html/mov_bbb.mp4")
MB = 1024 * 1024
results = []


def check(name, ok, evidence=""):
    results.append({"test": name, "pass": bool(ok), "evidence": str(evidence)[:300]})
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  ← {evidence}"))


def session():
    s = requests.Session()
    s.headers["Origin"] = BASE
    return s


def login(s, email, pw):
    r = s.post(BASE + "/api/auth/login", json={"email": email, "password": pw})
    # Production cookies are Secure; copy them by hand for plain-http loopback testing.
    m = re.search(r"(lumereel_session=[^;]+)", r.headers.get("set-cookie", ""))
    s.cookies.clear()
    if m:
        s.headers["Cookie"] = m.group(1)
    return r


def mp4_bytes(size):
    head = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"
    return head + os.urandom(size - len(head))


def b64head(data):
    import base64
    return base64.b64encode(data[:16]).decode()


def studio_objects():
    if not STUDIO:
        return None
    r = requests.get(STUDIO + "/api/v1/objects", params={"prefix": "lumereel/", "limit": 1000},
                     headers={"Authorization": "Bearer " + STUDIO_KEY})
    d = r.json()
    items = d.get("objects") or d.get("items") or []
    return {o.get("key"): o.get("size") for o in items}


def next_rss_mb():
    try:
        out = subprocess.run(["bash", "-c", "ps -o rss= -p $(pgrep -d, -f next-server) | sort -n | tail -1"],
                             capture_output=True, text=True).stdout.strip()
        return int(out) / 1024 if out else None
    except Exception:
        return None


def multipart_upload(s, data, name="big.mp4", resume=""):
    r = s.post(BASE + "/api/admin/upload/multipart",
               json={"kind": "video", "filename": name, "size": len(data), "fingerprint": f"{name}|{len(data)}",
                     "head": b64head(data), "resumeId": resume})
    if r.status_code != 200:
        return r, None
    plan = r.json()
    ps, n = plan["partSize"], plan["partCount"]
    done = set(plan.get("done") or [])

    def put(i):
        chunk = data[(i - 1) * ps:i * ps]
        return s.put(f"{BASE}/api/admin/upload/multipart/{plan['id']}/parts/{i}", data=chunk,
                     headers={"Content-Type": "application/octet-stream"}).status_code

    with cf.ThreadPoolExecutor(3) as ex:
        codes = list(ex.map(put, [i for i in range(1, n + 1) if i not in done]))
    if any(c != 200 for c in codes):
        return None, {"plan": plan, "codes": codes}
    c = s.post(f"{BASE}/api/admin/upload/multipart/{plan['id']}/complete", json={})
    return c, plan


def main():
    a = session()
    check("admin login", login(a, *ADMIN).status_code == 200)

    # ── auth / CSRF ──
    anon = requests.Session()
    r = anon.post(BASE + "/api/admin/upload/fetch", json={"url": FETCH_URL}, allow_redirects=False)
    check("no Origin header → 403", r.status_code == 403, r.status_code)
    u = session()
    login(u, "demo@lumereel.com", "DemoUser#2026")
    r = u.post(BASE + "/api/admin/upload/fetch", json={"url": FETCH_URL}, allow_redirects=False)
    check("non-admin rejected", r.status_code in (302, 307, 403), r.status_code)

    # ── single ──
    small = mp4_bytes(2 * MB)
    r = a.post(BASE + "/api/admin/upload/single", params={"kind": "video", "name": "ep01.mp4", "head": b64head(small)}, data=small)
    ok = r.status_code == 200 and r.json().get("url")
    check("single upload (2 MB) returns url", ok, r.text)
    single_url = r.json().get("url") if ok else ""

    junk = b"<html>not a video" + os.urandom(1000)
    r = a.post(BASE + "/api/admin/upload/single", params={"kind": "video", "name": "ep.mp4", "head": b64head(junk)}, data=junk)
    check("wrong magic bytes → 415", r.status_code == 415, r.text)
    r = a.post(BASE + "/api/admin/upload/single", params={"kind": "video", "name": "ep.exe", "head": b64head(small)}, data=small[:1000])
    check("disallowed extension → 415", r.status_code == 415, r.text)
    big9 = mp4_bytes(9 * MB)
    r = a.post(BASE + "/api/admin/upload/single", params={"kind": "video", "name": "ep.mp4", "head": b64head(big9)}, data=big9)
    check("single over 8 MB → 413", r.status_code == 413, r.text)

    # ── multipart ──
    data = mp4_bytes(21 * MB + 12345)
    c, plan = multipart_upload(a, data, "ep02.mp4")
    ok = c is not None and c.status_code == 200 and c.json().get("url")
    check("multipart 21 MB: 8 MB parts, complete returns url", ok and plan["partSize"] == 8 * MB and plan["partCount"] == 3,
          (c.text if c is not None else plan))
    objs = studio_objects()
    if objs is not None and ok:
        key = c.json().get("key")
        check("object size in R2 Studio matches", objs.get(key) == len(data), {"key": key, "size": objs.get(key)})

    # ── resume ──
    data2 = mp4_bytes(17 * MB)
    r = a.post(BASE + "/api/admin/upload/multipart", json={"kind": "video", "filename": "ep03.mp4", "size": len(data2),
                                                           "fingerprint": "ep03|x", "head": b64head(data2)})
    p = r.json()
    a.put(f"{BASE}/api/admin/upload/multipart/{p['id']}/parts/1", data=data2[:p["partSize"]])
    r2 = a.post(BASE + "/api/admin/upload/multipart", json={"kind": "video", "filename": "ep03.mp4", "size": len(data2),
                                                            "fingerprint": "ep03|x", "head": b64head(data2), "resumeId": p["id"]})
    check("resume returns same session with part 1 done", r2.json().get("id") == p["id"] and r2.json().get("done") == [1], r2.text)

    # wrong part size is refused by R2 Studio
    r = a.put(f"{BASE}/api/admin/upload/multipart/{p['id']}/parts/2", data=b"x" * 1000)
    check("wrong part size refused", r.status_code == 400, r.text)

    # ── abort ──
    r = a.delete(f"{BASE}/api/admin/upload/multipart/{p['id']}")
    check("abort multipart", r.status_code == 200, r.text)
    r = a.post(f"{BASE}/api/admin/upload/multipart/{p['id']}/complete", json={})
    check("aborted session is gone", r.status_code == 404, r.text)
    r = a.delete(f"{BASE}/api/admin/upload/multipart/mp-../../x")
    check("bad multipart id rejected", r.status_code in (400, 404), r.status_code)

    # ── memory stays flat for a big file ──
    big = mp4_bytes(600 * MB)
    peak = [0.0]
    stop = threading.Event()

    def sampler():
        while not stop.is_set():
            v = next_rss_mb()
            if v:
                peak[0] = max(peak[0], v)
            time.sleep(0.2)

    before = next_rss_mb()
    t = threading.Thread(target=sampler)
    t.start()
    t0 = time.time()
    c, plan = multipart_upload(a, big, "ep04.mp4")
    stop.set()
    t.join()
    ok = c is not None and c.status_code == 200
    check("multipart 600 MB completes", ok, c.text if c is not None else plan)
    if before:
        check("Node RSS grows < 200 MB while uploading 600 MB (no whole-file buffering)", peak[0] - before < 200,
              {"before_mb": round(before), "peak_mb": round(peak[0]), "seconds": round(time.time() - t0, 1)})

    # ── fetch ──
    r = a.post(BASE + "/api/admin/upload/fetch", json={"url": "http://127.0.0.1:8787/x.mp4"})
    check("fetch private address → 400", r.status_code == 400, r.text)
    r = a.post(BASE + "/api/admin/upload/fetch", json={"url": FETCH_URL, "headers": {f"X-H{i}": "v" for i in range(11)}})
    check("fetch >10 headers → 400", r.status_code == 400, r.text)
    r = a.post(BASE + "/api/admin/upload/fetch", json={"url": FETCH_URL, "headers": {"Bad Name": "v"}})
    check("fetch bad header name → 400", r.status_code == 400, r.text)
    r = a.post(BASE + "/api/admin/upload/fetch", json={"url": FETCH_URL, "headers": {"Referer": "https://www.w3schools.com/"}})
    ok = r.status_code == 200 and r.json().get("id")
    check("fetch accepted (202 job)", ok, r.text)

    # SSE: global stream proxied without exposing the key
    seen = {"snapshot": False, "upload": False}
    job = r.json().get("id") if ok else ""
    final = {}
    try:
        with a.get(BASE + "/api/admin/r2s/events", stream=True, timeout=(5, 60)) as es:
            check("SSE proxy content-type", es.headers.get("content-type", "").startswith("text/event-stream"), es.headers.get("content-type"))
            ev = None
            deadline = time.time() + 60
            for line in es.iter_lines(decode_unicode=True):
                if time.time() > deadline:
                    break
                if line.startswith("event:"):
                    ev = line[6:].strip()
                elif line.startswith("data:") and ev in seen:
                    seen[ev] = True
                    d = json.loads(line[5:])
                    if ev == "upload" and d.get("id") == job:
                        final = d
                        if d.get("state") in ("done", "error", "cancelled"):
                            break
                    if ev == "snapshot":
                        for j in d.get("uploads") or []:
                            if j.get("id") == job and j.get("state") in ("done", "error"):
                                final = j
                        if final.get("state") in ("done", "error"):
                            break
    except requests.exceptions.RequestException as e:
        check("SSE stream", False, e)
    check("SSE snapshot received", seen["snapshot"])
    if not final.get("state"):
        for _ in range(60):
            final = a.get(f"{BASE}/api/admin/r2s/uploads/{job}").json()
            if final.get("state") in ("done", "error", "cancelled"):
                break
            time.sleep(1)
    check("fetch job finished with publicUrl", final.get("state") == "done" and bool(final.get("publicUrl")), final)

    passed = sum(r["pass"] for r in results)
    print(f"\n{passed}/{len(results)} passed")
    os.makedirs("test-results", exist_ok=True)
    with open("test-results/upload-r2studio.json", "w") as f:
        json.dump({"base": BASE, "studio_demo": bool(STUDIO), "results": results}, f, ensure_ascii=False, indent=2)
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
