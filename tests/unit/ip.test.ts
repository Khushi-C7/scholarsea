import { describe, it, expect } from "vitest";

import { isBlockedIp } from "@/lib/documents/ip";

describe("isBlockedIp — IPv4 blocked ranges", () => {
  const blocked = [
    "127.0.0.1", // loopback
    "127.1.2.3",
    "10.0.0.1", // private
    "10.255.255.255",
    "172.16.0.1", // private
    "172.31.255.255",
    "192.168.0.1", // private
    "192.168.1.100",
    "169.254.169.254", // cloud metadata (link-local)
    "169.254.0.1",
    "100.64.0.1", // CGNAT
    "0.0.0.0", // unspecified
    "255.255.255.255", // broadcast / reserved
    "224.0.0.1", // multicast
    "198.18.0.1", // benchmarking
    "192.0.2.1", // TEST-NET-1
  ];
  for (const ip of blocked) {
    it(`blocks ${ip}`, () => expect(isBlockedIp(ip)).toBe(true));
  }
});

describe("isBlockedIp — IPv4 public addresses pass", () => {
  const allowed = ["8.8.8.8", "1.1.1.1", "140.82.121.3", "151.101.1.69"];
  for (const ip of allowed) {
    it(`allows ${ip}`, () => expect(isBlockedIp(ip)).toBe(false));
  }
});

describe("isBlockedIp — IPv6", () => {
  it("blocks loopback ::1", () => expect(isBlockedIp("::1")).toBe(true));
  it("blocks unspecified ::", () => expect(isBlockedIp("::")).toBe(true));
  it("blocks unique-local fc00::/7", () =>
    expect(isBlockedIp("fd12:3456:789a::1")).toBe(true));
  it("blocks link-local fe80::/10", () =>
    expect(isBlockedIp("fe80::1")).toBe(true));
  it("blocks multicast ff00::/8", () =>
    expect(isBlockedIp("ff02::1")).toBe(true));
  it("blocks documentation 2001:db8::/32", () =>
    expect(isBlockedIp("2001:db8::1")).toBe(true));
  it("blocks IPv4-mapped loopback ::ffff:127.0.0.1", () =>
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true));
  it("blocks IPv4-mapped private ::ffff:10.0.0.1", () =>
    expect(isBlockedIp("::ffff:10.0.0.1")).toBe(true));
  it("blocks NAT64 to metadata 64:ff9b::169.254.169.254", () =>
    expect(isBlockedIp("64:ff9b::a9fe:a9fe")).toBe(true));
  it("allows a public v6 address", () =>
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false));
  it("allows IPv4-mapped public ::ffff:8.8.8.8", () =>
    expect(isBlockedIp("::ffff:8.8.8.8")).toBe(false));
});

describe("isBlockedIp — fails closed on garbage", () => {
  for (const bad of ["not-an-ip", "", "999.999.999.999", "12345"]) {
    it(`blocks invalid input ${JSON.stringify(bad)}`, () =>
      expect(isBlockedIp(bad)).toBe(true));
  }
});
