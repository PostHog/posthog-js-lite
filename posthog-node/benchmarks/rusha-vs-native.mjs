// @ts-check

import { bench, run, summary } from "mitata";
import { createHash } from "node:crypto"
import pkg from 'rusha';
const { createHash: createHashRusha } = pkg;

// eslint-disable-next-line
const LONG_SCALE = 0xfffffffffffffff

// from https://github.com/PostHog/posthog-js-lite/blob/2baa794708d78d5d10940817c3768e47abe2da99/posthog-node/src/feature-flags.ts#L460-L465
function _hashRusha(key, distinctId, salt = '') {
    // rusha is a fast sha1 implementation in pure javascript
    const sha1Hash = createHashRusha()
    sha1Hash.update(`${key}.${distinctId}${salt}`)
    return parseInt(sha1Hash.digest('hex').slice(0, 15), 16) / LONG_SCALE
}

function _hash(key, distinctId, salt = '') {
    const sha1Hash = createHash("sha1")
    sha1Hash.update(`${key}.${distinctId}${salt}`)
    return parseInt(sha1Hash.digest('hex').slice(0, 15), 16) / LONG_SCALE
}

summary(() => {
	bench("_hash with rusha", () => {
		_hashRusha("test", "user_id")
	});

	bench("_hash with native", () => {
		_hash("test", "user_id")
	});
});

await run();


// !NODE
// node benchmarks/rusha-vs-native.mjs
// clk: ~3.99 GHz
// cpu: AMD Ryzen 7 7700 8-Core Processor
// runtime: node 22.11.0 (x64-linux)

// benchmark                   avg (min … max) p75   p99    (min … top 1%)
// ------------------------------------------- -------------------------------
// _hash with rusha              12.10 µs/iter   7.25 µs █
//                         (4.66 µs … 1.27 ms) 116.62 µs █▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
// _hash with native            547.04 ns/iter 435.45 ns █
//                       (370.08 ns … 3.61 µs)   3.58 µs █▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

// summary
//   _hash with native
//    22.12x faster than _hash with rusha

// !BUN
// bun benchmarks/rusha-vs-native.mjs 
// clk: ~5.04 GHz
// cpu: AMD Ryzen 7 7700 8-Core Processor
// runtime: bun 1.1.37 (x64-linux)

// benchmark                   avg (min … max) p75   p99    (min … top 1%)
// ------------------------------------------- -------------------------------
// _hash with rusha              10.00 µs/iter   4.96 µs  █
//                         (2.60 µs … 2.78 ms)  45.85 µs ▂█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
// _hash with native            471.82 ns/iter 420.00 ns █
//                     (370.00 ns … 949.79 µs)   1.99 µs █▆▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

// summary
//   _hash with native
//    21.19x faster than _hash with rusha
