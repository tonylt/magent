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

import { registerRootComponent } from "expo";

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
