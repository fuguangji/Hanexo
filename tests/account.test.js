import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountUrl, describeAccount, displayNameOf, connectAccount, ACCOUNT_CENTER_URL } from "../src/account/account.js";

function fakeWindow(origin = "https://fuguangji.github.io") {
  const listeners = new Map();
  return {
    location: { origin, href: `${origin}/Hanexo/` },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    dispatch: (name, detail) => listeners.get(name)?.({ detail }),
    listeners
  };
}

test("account URL carries returnTo only for the same site", () => {
  const url = new URL(buildAccountUrl("https://fuguangji.github.io/Hanexo/?a=1#panel"));
  assert.equal(url.origin + url.pathname, ACCOUNT_CENTER_URL);
  assert.equal(url.searchParams.get("returnTo"), "https://fuguangji.github.io/Hanexo/?a=1");
  assert.equal(buildAccountUrl("http://localhost:5173/"), ACCOUNT_CENTER_URL);
  assert.equal(buildAccountUrl("not a url"), ACCOUNT_CENTER_URL);
});

test("describeAccount covers loading, guest, signed-in and unavailable", () => {
  assert.equal(describeAccount({ phase: "loading" }).busy, true);
  assert.equal(describeAccount({ phase: "ready", user: null }).label, "登入／註冊");
  assert.deepEqual([describeAccount({ phase: "ready", user: { displayName: "阿福" } }).label, describeAccount({ phase: "ready", user: { displayName: "阿福" } }).signedIn], ["阿福", true]);
  assert.equal(describeAccount({ phase: "unavailable", user: null, error: "逾時" }).title, "逾時");
  assert.equal(displayNameOf({ email: "pilot@example.com" }), "pilot");
  assert.equal(displayNameOf({}), "已登入");
});

test("connectAccount publishes the initial state and follows later sign-in/out events", async () => {
  const win = fakeWindow();
  const states = [];
  win.SITE_AUTH = { readyPromise: Promise.resolve({ user: null, error: null }) };
  const link = connectAccount({ load: async () => {}, win, onChange: state => states.push(state) });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(states.at(-1).phase, "ready");
  assert.equal(states.at(-1).user, null);
  win.dispatch("site:auth-state", { user: { uid: "u1", displayName: "A" }, error: null });
  assert.equal(states.at(-1).user.uid, "u1");
  win.dispatch("site:auth-state", { user: null, error: null });
  assert.equal(states.at(-1).user, null);
  link.stop();
  assert.equal(win.listeners.size, 0);
});

test("connectAccount reports failures instead of hanging", async () => {
  const failing = [];
  connectAccount({ load: async () => { throw new Error("boom"); }, win: fakeWindow(), onChange: s => failing.push(s) });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(failing.at(-1).phase, "unavailable");
  assert.equal(failing.at(-1).error, "boom");

  const win = fakeWindow();
  win.SITE_AUTH = { readyPromise: new Promise(() => {}) };
  const slow = [];
  connectAccount({ load: async () => {}, win, timeoutMs: 20, onChange: s => slow.push(s) });
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(slow.at(-1).phase, "unavailable");

  const local = [];
  connectAccount({ load: async () => assert.fail("must not load on another origin"), win: fakeWindow("http://localhost:5173"), onChange: s => local.push(s) });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(local.at(-1).phase, "unavailable");
});
