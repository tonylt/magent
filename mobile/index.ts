// Polyfills required by @getpaseo/client on React Native/Hermes. Must run before any
// SDK call. react-native-get-random-values provides crypto.getRandomValues; the SDK
// also uses crypto.randomUUID (RPC ids) and atob/btoa (offer decode), which Hermes
// lacks — add them here.
import "react-native-get-random-values";
import { decode as base64Decode, encode as base64Encode } from "base-64";

const g = globalThis as unknown as {
  atob?: (data: string) => string;
  btoa?: (data: string) => string;
  crypto?: {
    getRandomValues?: (array: Uint8Array) => Uint8Array;
    randomUUID?: () => string;
  };
};

if (typeof g.atob !== "function") g.atob = base64Decode;
if (typeof g.btoa !== "function") g.btoa = base64Encode;

(function ensureRandomUUID() {
  if (!g.crypto) g.crypto = {};
  const cryptoObj = g.crypto;
  if (typeof cryptoObj.randomUUID === "function") return;

  const getRandomValues =
    typeof cryptoObj.getRandomValues === "function"
      ? cryptoObj.getRandomValues.bind(cryptoObj)
      : (array: Uint8Array) => {
          for (let i = 0; i < array.length; i += 1) array[i] = Math.floor(Math.random() * 256);
          return array;
        };

  const randomUUID = () => {
    const bytes = getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  // Try progressively more forceful installs; the crypto host object may be
  // non-writable or non-extensible on some Hermes builds.
  try { cryptoObj.randomUUID = randomUUID; } catch { /* try next */ }
  if (typeof g.crypto?.randomUUID !== "function") {
    try { Object.defineProperty(cryptoObj, "randomUUID", { value: randomUUID, configurable: true, writable: true }); } catch { /* try next */ }
  }
  if (typeof g.crypto?.randomUUID !== "function") {
    try {
      Object.defineProperty(g, "crypto", {
        value: { getRandomValues, randomUUID },
        configurable: true,
        writable: true,
      });
    } catch { /* give up */ }
  }
})();

import { registerRootComponent } from "expo";

import App from "./App";

registerRootComponent(App);
