import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiledApi = ts.transpileModule(
  readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
).outputText;

function loadApi(fetch, timers = {}) {
  const context = {
    exports: {},
    process: { env: { NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000/v1" } },
    AbortController, AbortSignal, fetch, setTimeout, clearTimeout,
    ...timers,
  };
  vm.runInNewContext(compiledApi, context);
  return context.exports;
}

const jsonResponse = (data) => new Response(JSON.stringify(data), {
  headers: { "Content-Type": "application/json" },
});

function waitForAbort(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

for (const body of ["<html>Admin Login</html>", "{invalid json", ""]) {
  test(`successful invalid JSON is an API error: ${body || "empty body"}`, async () => {
    const api = loadApi(async () => new Response(body, { status: 200 }));
    await assert.rejects(api.apiFetch("/admin/articles"), (error) => {
      assert.ok(error instanceof api.ApiError);
      assert.equal(error.status, 200);
      assert.match(error.message, /invalid response/);
      assert.match(error.message, /NEXT_PUBLIC_API_BASE_URL/);
      return true;
    });
  });
}

for (const status of [204, 205]) {
  test(`HTTP ${status} succeeds without a JSON body`, async () => {
    const api = loadApi(async () => new Response(null, { status }));
    assert.equal(await api.apiFetch("/admin/settings/host-sites/1", { method: "DELETE" }), null);
  });
}

test("a network failure gives actionable feedback and retains its cause", async () => {
  const cause = new TypeError("Failed to fetch");
  const api = loadApi(async () => { throw cause; });
  await assert.rejects(api.apiFetch("/admin/articles"), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 0);
    assert.match(error.message, /Unable to reach the API/);
    assert.match(error.message, /backend is running/);
    assert.equal(error.info, cause);
    return true;
  });
});

test("non-JSON HTTP failure with an empty status text still has a message", async () => {
  const api = loadApi(async () => new Response("Upstream unavailable", { status: 503 }));
  await assert.rejects(api.apiFetch("/admin/articles"), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 503);
    assert.equal(error.message, "API request failed (HTTP 503).");
    return true;
  });
});

test("HTTP errors preserve a useful detail and ignore an empty one", async () => {
  for (const detail of ["Database unavailable", " "]) {
    const api = loadApi(async () => new Response(JSON.stringify({ detail }), { status: 500 }));
    await assert.rejects(api.apiFetch("/admin/articles"), (error) => {
      assert.equal(error.status, 500);
      assert.equal(error.message, detail.trim() ? detail : "API request failed (HTTP 500).");
      return true;
    });
  }
});

test("a stalled fetch times out by default after 30 seconds", async () => {
  const durations = [];
  const api = loadApi(async (url, options) => waitForAbort(options.signal), {
    setTimeout: (callback, delay) => {
      durations.push(delay);
      return setTimeout(callback, 5);
    },
  });
  await assert.rejects(api.apiFetch("/admin/articles"), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 0);
    assert.match(error.message, /timed out/);
    return true;
  });
  assert.deepEqual(durations, [30_000]);
});

test("the deadline also aborts a stalled response body", async () => {
  let bodyAborted = false;
  const api = loadApi(async (url, options) => new Response(new ReadableStream({
    start(controller) {
      options.signal.addEventListener("abort", () => {
        bodyAborted = true;
        controller.error(options.signal.reason);
      }, { once: true });
    },
  }), { headers: { "Content-Type": "application/json" } }));
  await assert.rejects(api.apiFetch("/admin/articles", { timeoutMs: 5 }), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.match(error.message, /timed out/);
    return true;
  });
  assert.equal(bodyAborted, true);
});

test("a custom deadline allows a slower operation and is not passed to fetch", async () => {
  const api = loadApi(async (url, options) => {
    assert.equal("timeoutMs" in options, false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(options.signal.aborted, false);
    return jsonResponse({ done: true });
  });
  assert.deepEqual(await api.apiFetch("/admin/articles", { timeoutMs: 100 }), { done: true });
});

test("timeoutMs zero disables the deadline while preserving caller cancellation", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Cancelled by the user", "AbortError");
  const api = loadApi(async (url, options) => waitForAbort(options.signal), {
    setTimeout: () => { assert.fail("An opted-out request must not start a deadline"); },
  });
  const pending = api.apiFetch("/admin/yt-scan/niches/1", { timeoutMs: 0, signal: controller.signal });
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
});

test("caller cancellation takes effect during an ordinary request", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Changed pages", "AbortError");
  const api = loadApi(async (url, options) => waitForAbort(options.signal));
  const pending = api.apiFetch("/admin/articles", { signal: controller.signal });
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
});

test("an already-cancelled request never calls fetch", async () => {
  const controller = new AbortController();
  const reason = new DOMException("Changed pages", "AbortError");
  controller.abort(reason);
  const api = loadApi(async () => { assert.fail("Already-cancelled request reached fetch"); });
  await assert.rejects(api.apiFetch("/admin/articles", { signal: controller.signal }), (error) => error === reason);
});

test("settled requests clean up their deadline and caller abort listener", async () => {
  for (const fail of [false, true]) {
    const controller = new AbortController();
    const removals = [];
    const nativeRemove = controller.signal.removeEventListener.bind(controller.signal);
    controller.signal.removeEventListener = (...arguments_) => {
      removals.push(arguments_);
      nativeRemove(...arguments_);
    };
    const pendingTimers = new Set();
    const api = loadApi(async () => {
      if (fail) throw new TypeError("Failed to fetch");
      return jsonResponse({ done: true });
    }, {
      setTimeout: (callback, delay) => {
        const id = setTimeout(callback, delay);
        pendingTimers.add(id);
        return id;
      },
      clearTimeout: (id) => { pendingTimers.delete(id); clearTimeout(id); },
    });
    const result = api.apiFetch("/admin/articles", { signal: controller.signal });
    if (fail) await assert.rejects(result);
    else await result;
    assert.equal(pendingTimers.size, 0);
    assert.equal(removals.length, 1);
    assert.equal(removals[0][0], "abort");
  }
});
