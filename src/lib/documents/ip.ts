import net from "node:net";

/**
 * IP classification for SSRF defense. `isBlockedIp` returns true for any
 * address that must never be reachable from a user-supplied URL: loopback,
 * private, link-local (including the cloud metadata address 169.254.169.254),
 * unique-local, multicast, and reserved ranges, across IPv4 and IPv6 —
 * including IPv4 addresses embedded in IPv6 (mapped / NAT64).
 *
 * Fails closed: anything that cannot be parsed as a valid IP is treated as
 * blocked.
 */

type V4Range = { base: number; bits: number };

function v4(cidr: string): V4Range {
  const [ip, bitsStr] = cidr.split("/");
  const base = ipv4ToInt(ip);
  if (base === null) throw new Error(`bad cidr ${cidr}`);
  return { base, bits: Number(bitsStr) };
}

// IPv4 ranges that must not be reachable.
const BLOCKED_V4: V4Range[] = [
  "0.0.0.0/8", // "this" network / unspecified
  "10.0.0.0/8", // private
  "100.64.0.0/10", // carrier-grade NAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local (incl. 169.254.169.254 metadata)
  "172.16.0.0/12", // private
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // TEST-NET-1
  "192.168.0.0/16", // private
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved / future (incl. 255.255.255.255)
].map(v4);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

function v4InRange(value: number, range: V4Range): boolean {
  if (range.bits === 0) return true;
  const mask = range.bits === 32 ? 0xffffffff : (~((1 << (32 - range.bits)) - 1)) >>> 0;
  return (value & mask) >>> 0 === (range.base & mask) >>> 0;
}

function isBlockedV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true; // fail closed
  return BLOCKED_V4.some((r) => v4InRange(value, r));
}

/** Expand an IPv6 string into a 128-bit BigInt, or null if invalid. */
function ipv6ToBigInt(ip: string): bigint | null {
  let str = ip;
  // Strip zone id (e.g. fe80::1%eth0).
  const pct = str.indexOf("%");
  if (pct !== -1) str = str.slice(0, pct);

  // Handle an embedded IPv4 tail (e.g. ::ffff:1.2.3.4).
  const lastColon = str.lastIndexOf(":");
  if (str.slice(lastColon + 1).includes(".")) {
    const v4part = str.slice(lastColon + 1);
    const v4int = ipv4ToInt(v4part);
    if (v4int === null) return null;
    const hi = (v4int >>> 16) & 0xffff;
    const lo = v4int & 0xffff;
    str =
      str.slice(0, lastColon + 1) +
      hi.toString(16) +
      ":" +
      lo.toString(16);
  }

  const halves = str.split("::");
  if (halves.length > 2) return null;

  const toGroups = (s: string) => (s === "" ? [] : s.split(":"));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : null;

  let groups: string[];
  if (tail === null) {
    groups = head;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill("0"), ...tail];
  }
  if (groups.length !== 8) return null;

  let value = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    value = (value << 16n) | BigInt(parseInt(g, 16));
  }
  return value;
}

type V6Range = { base: bigint; bits: number };

function v6(cidr: string): V6Range {
  const [ip, bitsStr] = cidr.split("/");
  const base = ipv6ToBigInt(ip);
  if (base === null) throw new Error(`bad v6 cidr ${cidr}`);
  return { base, bits: Number(bitsStr) };
}

const BLOCKED_V6: V6Range[] = [
  "::/128", // unspecified
  "::1/128", // loopback
  "100::/64", // discard-only
  "2001:db8::/32", // documentation
  "fc00::/7", // unique local
  "fe80::/10", // link-local
  "ff00::/8", // multicast
].map(v6);

// Ranges that embed an IPv4 address in their low 32 bits.
const MAPPED_V6 = v6("::ffff:0:0/96"); // IPv4-mapped
const NAT64_V6 = v6("64:ff9b::/96"); // NAT64 well-known prefix

function v6InRange(value: bigint, range: V6Range): boolean {
  if (range.bits === 0) return true;
  const shift = BigInt(128 - range.bits);
  return value >> shift === range.base >> shift;
}

/** The main predicate. True => do not connect to this IP. */
export function isBlockedIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isBlockedV4(ip);
  if (kind === 6) {
    // Extract any embedded IPv4 (mapped ::ffff:x / NAT64 64:ff9b::/x) and
    // apply the IPv4 rules to it as well.
    const value = ipv6ToBigInt(ip);
    if (value === null) return true;
    const low32 = Number(value & 0xffffffffn) >>> 0;
    if (v6InRange(value, MAPPED_V6) || v6InRange(value, NAT64_V6)) {
      const dotted = [
        (low32 >>> 24) & 0xff,
        (low32 >>> 16) & 0xff,
        (low32 >>> 8) & 0xff,
        low32 & 0xff,
      ].join(".");
      if (isBlockedV4(dotted)) return true;
    }
    return BLOCKED_V6.some((r) => v6InRange(value, r));
  }
  return true; // not a valid IP => fail closed
}
