import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiledApi = ts.transpileModule(
  readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
  },
).outputText;

function loadApi(fetch, { pathname = "/leads", browser = true, abortSignal = AbortSignal } = {}) {
  const redirects = [];
  const context = {
    exports: {},
    process: { env: { NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000/v1" } },
    AbortSignal: abortSignal,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch,
    ...(browser && {
      window: {
        location: {
          pathname,
          replace: (url) => redirects.push(url),
        },
      },
    }),
  };
  vm.runInNewContext(compiledApi, context);
  return { ...context.exports, redirects };
}

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("successful requests include the authentication cookie", async () => {
  const calls = [];
  const api = loadApi(async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({ items: [] });
  });

  assert.deepEqual(await api.apiFetch("/admin/leads"), { items: [] });
  assert.equal(calls[0].url, "http://localhost:8000/v1/admin/leads");
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls.length, 1);
  assert.deepEqual(api.redirects, []);
});

test("protected 401 clears the cookie before returning to login", async () => {
  const calls = [];
  const detail = { detail: "Authentication required" };
  const api = loadApi(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/auth/logout")) {
      assert.deepEqual(api.redirects, []);
      return jsonResponse({ status: true, message: "Logged out successfully" });
    }
    return jsonResponse(detail, 401);
  });

  await assert.rejects(api.apiFetch("/admin/leads"), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.message, detail.detail);
    assert.deepEqual(error.info, detail);
    return true;
  });
  assert.equal(calls[1].url, "http://localhost:8000/v1/auth/logout");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.credentials, "include");
  assert.deepEqual(api.redirects, ["/login"]);
});

test("concurrent protected 401 responses share one logout and redirect", async () => {
  let releaseLogout;
  const logoutGate = new Promise((resolve) => { releaseLogout = resolve; });
  let logoutCalls = 0;
  const api = loadApi(async (url) => {
    if (url.endsWith("/auth/logout")) {
      logoutCalls += 1;
      await logoutGate;
      return jsonResponse({ status: true });
    }
    return jsonResponse({ detail: "Session expired" }, 401);
  });
  const requests = Promise.allSettled([
    api.apiFetch("/admin/leads"),
    api.apiFetch("/admin/leads/1"),
    api.apiFetch("/admin/leads/2"),
  ]);

  await new Promise((resolve) => setImmediate(resolve));
  releaseLogout();
  const results = await requests;
  assert.equal(logoutCalls, 1);
  assert.ok(results.every((result) => result.status === "rejected"));
  assert.deepEqual(api.redirects, ["/login"]);
});

test("invalid OTP is displayed without logout or redirect", async () => {
  const calls = [];
  const api = loadApi(async (url) => {
    calls.push(url);
    return jsonResponse({ detail: "Invalid OTP" }, 401);
  }, { pathname: "/login" });

  await assert.rejects(
    api.apiFetch("/auth/verify-otp", { method: "POST" }),
    (error) => error instanceof api.ApiError && error.message === "Invalid OTP",
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(api.redirects, []);
});

for (const failure of ["response", "network"]) {
  test(`logout ${failure} failure provides recovery guidance without a redirect loop`, async () => {
    let logoutCalls = 0;
    const api = loadApi(async (url) => {
      if (url.endsWith("/auth/logout")) {
        logoutCalls += 1;
        if (failure === "network") throw new Error("Network unavailable");
        return jsonResponse({ detail: "Unavailable" }, 503);
      }
      return jsonResponse({ detail: "Authentication required" }, 401);
    });

    await assert.rejects(api.apiFetch("/admin/leads"), (error) => {
      assert.ok(error instanceof api.ApiError);
      assert.equal(error.status, 401);
      assert.match(error.message, /Your session could not be cleared/);
      assert.match(error.message, /clear this site's cookies/);
      return true;
    });
    assert.equal(logoutCalls, 1);
    assert.deepEqual(api.redirects, []);
  });
}

test("a stalled logout is aborted and shows recovery guidance", async () => {
  let timeoutCalls = 0;
  const api = loadApi(async (url, options) => {
    if (url.endsWith("/auth/logout")) {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    }
    return jsonResponse({ detail: "Authentication required" }, 401);
  }, {
    abortSignal: {
      timeout: (milliseconds) => {
        timeoutCalls += 1;
        assert.equal(milliseconds, 5000);
        const controller = new AbortController();
        setImmediate(() => controller.abort(new DOMException("Timed out", "TimeoutError")));
        return controller.signal;
      },
    },
  });

  await assert.rejects(api.apiFetch("/admin/leads"), (error) => {
    assert.equal(error.status, 401);
    assert.match(error.message, /Your session could not be cleared/);
    return true;
  });
  assert.equal(timeoutCalls, 1);
  assert.deepEqual(api.redirects, []);
});

test("server-side requests preserve 401 without browser navigation", async () => {
  let calls = 0;
  const api = loadApi(async () => {
    calls += 1;
    return jsonResponse({ detail: "Authentication required" }, 401);
  }, { browser: false });

  await assert.rejects(api.apiFetch("/admin/leads"), (error) => error.status === 401);
  assert.equal(calls, 1);
});

test("a forbidden response does not sign out an authenticated admin", async () => {
  let calls = 0;
  const api = loadApi(async () => {
    calls += 1;
    return jsonResponse({ detail: "Admin access required" }, 403);
  });

  await assert.rejects(api.apiFetch("/admin/leads"), (error) => error.status === 403);
  assert.equal(calls, 1);
  assert.deepEqual(api.redirects, []);
});
