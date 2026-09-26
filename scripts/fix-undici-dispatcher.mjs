// scripts/fix-undici-dispatcher.mjs
// Protect Node 24 native fetch dispatcher from being corrupted by user-land undici

const sym1 = Symbol.for("undici.globalDispatcher.1");
const sym2 = Symbol.for("undici.globalDispatcher.2");

// Initialize Node 24 native fetch dispatcher via offline data URI
try {
  await fetch("data:text/plain,init");
} catch (_) {}

const nativeAgent = globalThis[sym1];
if (nativeAgent) {
  try {
    Object.defineProperty(globalThis, sym1, {
      value: nativeAgent,
      writable: false,
      configurable: false,
      enumerable: false
    });
  } catch (_) {}
}

try {
  Object.defineProperty(globalThis, sym2, {
    get: () => undefined,
    set: () => {},
    configurable: false,
    enumerable: false
  });
} catch (_) {}
