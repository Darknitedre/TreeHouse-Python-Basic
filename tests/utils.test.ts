import { describe, it, expect } from "vitest";
import {
  detectPlatform,
  isSafePublicUrl,
  slugify,
  daysUntil,
  isOverdue,
  startOfWeek,
  toDateOnly,
  truncate,
} from "@/lib/utils";

describe("detectPlatform", () => {
  it("maps known hosts", () => {
    expect(detectPlatform("https://www.tiktok.com/@a/video/1")).toBe("tiktok");
    expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
    expect(detectPlatform("https://x.com/a/status/1")).toBe("x");
    expect(detectPlatform("https://twitter.com/a")).toBe("x");
    expect(detectPlatform("https://www.linkedin.com/posts/x")).toBe("linkedin");
    expect(detectPlatform("https://www.threads.net/@a")).toBe("threads");
  });
  it("falls back to other", () => {
    expect(detectPlatform("https://example.com")).toBe("other");
    expect(detectPlatform("not a url")).toBe("other");
  });
});

describe("isSafePublicUrl", () => {
  it("accepts public https", () => {
    expect(isSafePublicUrl("https://example.com/x")).toBe(true);
  });
  it("rejects non-http protocols", () => {
    expect(isSafePublicUrl("ftp://example.com")).toBe(false);
    expect(isSafePublicUrl("file:///etc/passwd")).toBe(false);
    expect(isSafePublicUrl("javascript:alert(1)")).toBe(false);
  });
  it("rejects private / loopback hosts (SSRF)", () => {
    expect(isSafePublicUrl("http://localhost/x")).toBe(false);
    expect(isSafePublicUrl("http://127.0.0.1/x")).toBe(false);
    expect(isSafePublicUrl("http://10.0.0.1/x")).toBe(false);
    expect(isSafePublicUrl("http://192.168.1.1/x")).toBe(false);
    expect(isSafePublicUrl("http://172.16.0.1/x")).toBe(false);
    expect(isSafePublicUrl("http://169.254.169.254/latest")).toBe(false);
  });
  it("allows public IPs", () => {
    expect(isSafePublicUrl("http://8.8.8.8/")).toBe(true);
    expect(isSafePublicUrl("http://172.15.0.1/")).toBe(true); // just outside private range
  });
});

describe("slugify", () => {
  it("normalizes", () => {
    expect(slugify("Personal Finance")).toBe("personal-finance");
    expect(slugify("  A.I. & ML!! ")).toBe("a-i-ml");
  });
});

describe("date helpers", () => {
  it("daysUntil / isOverdue", () => {
    const yesterday = toDateOnly(new Date(Date.now() - 86_400_000));
    const tomorrow = toDateOnly(new Date(Date.now() + 86_400_000));
    expect(daysUntil(yesterday)).toBeLessThan(0);
    expect(daysUntil(tomorrow)).toBeGreaterThan(0);
    expect(isOverdue(yesterday, "not_started")).toBe(true);
    expect(isOverdue(yesterday, "completed")).toBe(false);
    expect(isOverdue(tomorrow, "in_progress")).toBe(false);
  });
  it("startOfWeek is a Monday", () => {
    expect(startOfWeek(new Date("2026-08-06")).getDay()).toBe(1);
  });
});

describe("truncate", () => {
  it("shortens long strings", () => {
    expect(truncate("hello world", 5)).toHaveLength(5);
    expect(truncate("hi", 5)).toBe("hi");
  });
});
