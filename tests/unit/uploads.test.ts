import { describe, expect, it } from "vitest";
import { checkFile, detectType, MAX_UPLOAD_BYTES, safeFileName } from "@/lib/uploads";

const bytes = (...values: number[]) => Uint8Array.from([...values, ...new Array(16).fill(0)]);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]);

describe("upload checks", () => {
  it("recognises the allowed types from their bytes", () => {
    expect(detectType(PNG)?.mime).toBe("image/png");
    expect(detectType(JPG)?.mime).toBe("image/jpeg");
    expect(detectType(PDF)?.mime).toBe("application/pdf");
    expect(detectType(WEBP)?.mime).toBe("image/webp");
  });

  it("refuses scripts, SVG, executables and anything unrecognised, whatever the file is called", () => {
    const text = (s: string) => new TextEncoder().encode(s);
    for (const bad of [text("<svg onload=alert(1)>"), text("<script>alert(1)</script>"), text("MZ\u0090\u0000"), text("#!/bin/sh"), new Uint8Array(0)]) {
      expect(detectType(bad)).toBeNull();
    }
    expect(checkFile({ name: "logo.png", size: 100 }, text("<svg onload=alert(1)>")).ok).toBe(false);
  });

  it("limits size and rejects empty files", () => {
    expect(checkFile({ name: "a.pdf", size: MAX_UPLOAD_BYTES + 1 }, PDF).ok).toBe(false);
    expect(checkFile({ name: "a.pdf", size: 0 }, PDF).ok).toBe(false);
    expect(checkFile({ name: "a.pdf", size: 1000 }, PDF).ok).toBe(true);
  });

  it("names the stored file from its real type and strips unsafe characters", () => {
    const r = checkFile({ name: "../../etc/passwd.exe", size: 10 }, PNG);
    expect(r.ok && r.name).toBe("etc-passwd.png"); // the extension follows the real type, not the claimed one
    expect(safeFileName("My Logo (final) v2.PNG")).toBe("My-Logo-final-v2");
    expect(safeFileName("../..")).toBe("file");
    expect(safeFileName("x".repeat(200)).length).toBe(60);
  });
});
