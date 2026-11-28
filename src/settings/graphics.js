// 畫質設定：與遊戲模擬、介面完全分離。只負責資料、消毒、持久化與自動降階。
export const STORAGE_KEY = "hanexo.graphics.v1";
export const LEVELS = ["low", "medium", "high", "ultra"];
export const FPS_CAPS = [0, 30, 60]; // 0 = 跟隨螢幕更新率

export const PRESETS = Object.freeze({
  low:    { label: "低",   maxPixelRatio: 1,   resolution: 0.75, fpsCap: 30, shadows: false, terrainTexture: false, paths: false, details: false },
  medium: { label: "中",   maxPixelRatio: 1.5, resolution: 1,    fpsCap: 60, shadows: true,  terrainTexture: false, paths: true,  details: true },
  high:   { label: "高",   maxPixelRatio: 2,   resolution: 1,    fpsCap: 60, shadows: true,  terrainTexture: true,  paths: true,  details: true },
  ultra:  { label: "極致", maxPixelRatio: 3,   resolution: 1,    fpsCap: 0,  shadows: true,  terrainTexture: true,  paths: true,  details: true }
});

const TOGGLES = ["shadows", "terrainTexture", "paths", "details"];
const { label: _label, ...HIGH_VALUES } = PRESETS.high;
export const DEFAULT_SETTINGS = Object.freeze({ preset: "auto", ...HIGH_VALUES, showFps: false });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** 把任意輸入整理成合法設定；未知欄位丟棄，缺漏欄位以預設補上。 */
export function sanitizeSettings(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const preset = input.preset === "auto" || input.preset === "custom" || LEVELS.includes(input.preset)
    ? input.preset : "auto";
  const base = LEVELS.includes(preset) ? PRESETS[preset] : PRESETS.high;
  const out = { preset, showFps: input.showFps === true };
  out.maxPixelRatio = Number.isFinite(input.maxPixelRatio) ? clamp(input.maxPixelRatio, 1, 3) : base.maxPixelRatio;
  out.resolution = Number.isFinite(input.resolution) ? clamp(Math.round(input.resolution * 20) / 20, 0.5, 1) : base.resolution;
  out.fpsCap = FPS_CAPS.includes(input.fpsCap) ? input.fpsCap : base.fpsCap;
  for (const key of TOGGLES) out[key] = typeof input[key] === "boolean" ? input[key] : base[key];
  return out;
}

export function loadSettings(storage = safeStorage()) {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return sanitizeSettings(text ? JSON.parse(text) : null);
  } catch {
    return sanitizeSettings(null);
  }
}

export function saveSettings(settings, storage = safeStorage()) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(settings)); return true; } catch { return false; }
}

function safeStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** 套用某個預設檔，保留「顯示 FPS」這類與畫質無關的選項。 */
export function applyPreset(settings, preset) {
  if (preset === "auto") return { ...settings, preset: "auto" };
  if (!LEVELS.includes(preset)) return settings;
  const { label, ...values } = PRESETS[preset];
  return { ...settings, ...values, preset };
}

/** 手動調整任一細項後，預設檔即變成「自訂」。 */
export function updateSetting(settings, key, value) {
  const next = sanitizeSettings({ ...settings, [key]: value, preset: key === "showFps" ? settings.preset : "custom" });
  return next;
}

/** 自動模式的起始等級：依裝置性能估算，之後由降階治理器修正。 */
export function detectLevel(env = {}) {
  const cores = env.cores ?? globalThis.navigator?.hardwareConcurrency ?? 4;
  const memory = env.memory ?? globalThis.navigator?.deviceMemory ?? 4;
  const mobile = env.mobile ?? /Android|iPhone|iPad|Mobile/i.test(globalThis.navigator?.userAgent || "");
  const reduced = env.reducedMotion ?? false;
  if (reduced || cores <= 2 || memory <= 2) return "low";
  if (mobile) return cores >= 8 ? "medium" : "low";
  if (cores >= 8 && memory >= 8) return "high";
  return "medium";
}

/** 計算目前實際使用的畫質（自動模式會套用偵測等級，並受降階治理器影響）。 */
export function effectiveQuality(settings, autoLevel = "high") {
  if (settings.preset === "auto") {
    const { label, ...values } = PRESETS[autoLevel] || PRESETS.high;
    return { ...values, showFps: settings.showFps, level: autoLevel };
  }
  return { ...settings, level: LEVELS.includes(settings.preset) ? settings.preset : "custom" };
}

/** 實際的畫布像素比：裝置像素比受上限與解析度比例影響。 */
export function pixelRatioFor(quality, devicePixelRatio = 1) {
  return Math.max(0.5, Math.min(devicePixelRatio, quality.maxPixelRatio) * quality.resolution);
}

/**
 * 降階治理器：只在「自動」模式使用。連續兩個取樣視窗都明顯低於目標幀率就降一級，
 * 不會在同一個工作階段自動升級，避免畫質來回跳動。
 */
export function createQualityGovernor({ level = "high", windowSize = 90, tolerance = 1.4, onChange = () => {} } = {}) {
  let index = Math.max(0, LEVELS.indexOf(level));
  let total = 0;
  let count = 0;
  let slowWindows = 0;
  return {
    get level() { return LEVELS[index]; },
    reset(next) { index = Math.max(0, LEVELS.indexOf(next)); total = count = slowWindows = 0; },
    /** @param frameMs 兩次繪製的間隔 @param targetFps 目前的幀率目標（0 視為 60） */
    sample(frameMs, targetFps = 60) {
      if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) return; // 分頁切換等不計入
      total += frameMs;
      count += 1;
      if (count < windowSize) return;
      const average = total / count;
      total = count = 0;
      const budget = 1000 / (targetFps || 60);
      slowWindows = average > budget * tolerance ? slowWindows + 1 : 0;
      if (slowWindows >= 2 && index > 0) {
        index -= 1;
        slowWindows = 0;
        onChange(LEVELS[index]);
      }
    }
  };
}
