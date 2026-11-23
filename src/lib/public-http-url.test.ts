import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { assertPublicHttpUrl, filenameFromUrl } from "./public-http-url";

describe("assertPublicHttpUrl", () => {
  test("accepts public https video URLs", () => {
    const r = assertPublicHttpUrl("https://cdn.example.com/shows/EP06.mp4");
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.url, /^https:\/\/cdn\.example\.com\/shows\/EP06\.mp4/);
  });
  test("rejects localhost, private networks, and non-http schemes", () => {
    assert.equal(assertPublicHttpUrl("http://127.0.0.1/a.mp4").ok, false);
    assert.equal(assertPublicHttpUrl("http://localhost:8080/a.mp4").ok, false);
    assert.equal(assertPublicHttpUrl("http://192.168.1.9/a.mp4").ok, false);
    assert.equal(assertPublicHttpUrl("http://10.0.0.2/a.mp4").ok, false);
    assert.equal(assertPublicHttpUrl("http://169.254.169.254/latest").ok, false);
    assert.equal(assertPublicHttpUrl("file:///tmp/a.mp4").ok, false);
    assert.equal(assertPublicHttpUrl("ftp://files.example.com/a.mp4").ok, false);
    assert.equal(assertPublicHttpUrl("https://user:pass@cdn.example.com/a.mp4").ok, false);
    assert.equal(assertPublicHttpUrl("https://cdn.facebook.com/v/a.mp4").ok, true);
  });
});

describe("filenameFromUrl", () => {
  test("reads the path basename", () => {
    assert.equal(filenameFromUrl("https://cdn.example.com/v/S01E03.mp4?token=1"), "S01E03.mp4");
  });
});
