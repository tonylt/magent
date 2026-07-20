// Polyfills required by @getpaseo/client (relay E2EE + offer decoding) on React
// Native/Hermes. Must run before any SDK import.
import "react-native-get-random-values";
import { decode as base64Decode, encode as base64Encode } from "base-64";

const globalScope = globalThis as unknown as {
  atob?: (data: string) => string;
  btoa?: (data: string) => string;
};
if (typeof globalScope.atob !== "function") globalScope.atob = base64Decode;
if (typeof globalScope.btoa !== "function") globalScope.btoa = base64Encode;

// Hermes lacks crypto.randomUUID (react-native-get-random-values only adds
// getRandomValues). @getpaseo/client uses randomUUID for RPC request IDs, so build a
// v4 UUID from getRandomValues.
const cryptoScope = (globalThis as unknown as {
  crypto?: { getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T; randomUUID?: () => string };
}).crypto;
if (cryptoScope && typeof cryptoScope.randomUUID !== "function" && typeof cryptoScope.getRandomValues === "function") {
  cryptoScope.randomUUID = () => {
    const bytes = new Uint8Array(16);
    cryptoScope.getRandomValues!(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

import { registerRootComponent } from "expo";

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
