// 共用帳號整合：只讀取登入狀態並導向帳號中心，不自建登入頁、不接觸 ID Token。
export const ACCOUNT_CENTER_URL = "https://fuguangji.github.io/game/account/";
export const AUTH_MODULE_URL = "https://fuguangji.github.io/game/account/auth-bootstrap.js";
const SHARED_ORIGIN = new URL(ACCOUNT_CENTER_URL).origin;

/** 登入後要回到目前頁面。只有同一網站來源才帶 returnTo，帳號中心也只接受同源網址。 */
export function buildAccountUrl(returnHref, base = ACCOUNT_CENTER_URL) {
  const url = new URL(base);
  try {
    if (returnHref && new URL(returnHref).origin === url.origin) {
      const target = new URL(returnHref);
      target.hash = "";
      url.searchParams.set("returnTo", target.href);
    }
  } catch { /* 無效網址就不帶 returnTo */ }
  return url.href;
}

export function displayNameOf(user) {
  return user?.displayName?.trim() || user?.email?.split("@")[0] || "已登入";
}

/** 把帳號狀態轉成按鈕要顯示的文字，純函式，方便測試。 */
export function describeAccount(state) {
  if (state.phase === "loading") return { label: "確認帳號中…", title: "正在還原共用帳號登入狀態", signedIn: false, busy: true };
  if (state.user) return { label: displayNameOf(state.user), title: "已連結共用帳號；點擊管理帳號", signedIn: true, busy: false };
  if (state.phase === "unavailable") return { label: "登入／註冊", title: state.error || "帳號服務暫不可用；仍可前往帳號中心", signedIn: false, busy: false };
  return { label: "登入／註冊", title: "前往共用帳號中心", signedIn: false, busy: false };
}

/**
 * 連線到共用登入狀態。
 * @param load 載入 auth-bootstrap 的函式（測試時可替換）
 * @param win  提供 location、addEventListener 的視窗物件
 */
export function connectAccount({ load, win = globalThis.window, timeoutMs = 8000, onChange }) {
  const state = { phase: "loading", user: null, error: null };
  const emit = patch => { Object.assign(state, patch); onChange({ ...state }); };
  let stopped = false;
  const listener = event => {
    if (stopped) return;
    const { user, error } = event.detail || {};
    emit({ phase: error ? "unavailable" : "ready", user: user || null, error: error || null });
  };
  win.addEventListener("site:auth-state", listener);
  emit({});

  const sameSite = win.location.origin === SHARED_ORIGIN;
  const run = async () => {
    if (!sameSite) {
      // 登入狀態以網站來源為單位保存；本機開發網址讀不到 fuguangji.github.io 的登入。
      emit({ phase: "unavailable", error: "僅在 fuguangji.github.io 上共用登入狀態。" });
      return;
    }
    try {
      await (load ? load() : import(/* @vite-ignore */ AUTH_MODULE_URL));
      const auth = win.SITE_AUTH;
      if (!auth) throw new Error("找不到共用帳號狀態入口。");
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("帳號服務回應逾時。")), timeoutMs));
      const initial = await Promise.race([auth.readyPromise, timeout]);
      if (!stopped) emit({ phase: initial.error ? "unavailable" : "ready", user: initial.user || null, error: initial.error || null });
    } catch (error) {
      if (!stopped) emit({ phase: "unavailable", user: null, error: error.message || String(error) });
    }
  };
  run();

  return {
    get state() { return { ...state }; },
    stop() { stopped = true; win.removeEventListener("site:auth-state", listener); }
  };
}
