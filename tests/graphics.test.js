import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeSettings, loadSettings, saveSettings, applyPreset, updateSetting, detectLevel,
  effectiveQuality, pixelRatioFor, createQualityGovernor, STORAGE_KEY, PRESETS, DEFAULT_SETTINGS
} from "../src/settings/graphics.js";

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = String(value); }, data };
};

test("sanitizeSettings falls back to safe defaults and clamps values", () => {
  assert.deepEqual(sanitizeSettings(null), sanitizeSettings(undefined));
  const result = sanitizeSettings({ preset: "bogus", resolution: 9, maxPixelRatio: -1, fpsCap: 144, shadows: "yes" });
  assert.equal(result.preset, "auto");
  assert.equal(result.resolution, 1);
  assert.equal(result.maxPixelRatio, 1);
  assert.equal(result.fpsCap, PRESETS.high.fpsCap);
  assert.equal(result.shadows, PRESETS.high.shadows);
  assert.equal(DEFAULT_SETTINGS.label, undefined);
});

test("settings persist, and corrupt storage never throws", () => {
  const storage = memoryStorage();
  assert.equal(saveSettings(applyPreset(DEFAULT_SETTINGS, "low"), storage), true);
  assert.equal(loadSettings(storage).preset, "low");
  assert.equal(loadSettings(storage).shadows, false);
  assert.equal(loadSettings(memoryStorage({ [STORAGE_KEY]: "{not json" })).preset, "auto");
  assert.equal(loadSettings({ getItem() { throw new Error("blocked"); } }).preset, "auto");
  assert.equal(saveSettings(DEFAULT_SETTINGS, { setItem() { throw new Error("full"); } }), false);
});

test("changing a detail switches the preset to custom, FPS toggle does not", () => {
  const medium = applyPreset(DEFAULT_SETTINGS, "medium");
  assert.equal(updateSetting(medium, "shadows", false).preset, "custom");
  assert.equal(updateSetting(medium, "showFps", true).preset, "medium");
  assert.equal(updateSetting(medium, "resolution", 0.5).resolution, 0.5);
});

test("auto level detection and effective quality", () => {
  assert.equal(detectLevel({ cores: 2, memory: 8, mobile: false }), "low");
  assert.equal(detectLevel({ cores: 12, memory: 16, mobile: false }), "high");
  assert.equal(detectLevel({ cores: 6, memory: 4, mobile: true }), "low");
  assert.equal(detectLevel({ cores: 8, memory: 8, mobile: false, reducedMotion: true }), "low");
  const auto = effectiveQuality(DEFAULT_SETTINGS, "low");
  assert.equal(auto.shadows, false);
  assert.equal(auto.level, "low");
  assert.equal(effectiveQuality(applyPreset(DEFAULT_SETTINGS, "ultra")).level, "ultra");
});

test("pixel ratio respects the cap and the resolution scale", () => {
  assert.equal(pixelRatioFor(PRESETS.low, 3), 0.75);
  assert.equal(pixelRatioFor(PRESETS.high, 3), 2);
  assert.equal(pixelRatioFor(PRESETS.ultra, 3), 3);
  assert.equal(pixelRatioFor({ maxPixelRatio: 1, resolution: 0.5 }, 1), 0.5);
});

test("governor steps down after two slow windows and never upgrades", () => {
  const changes = [];
  const governor = createQualityGovernor({ level: "ultra", windowSize: 10, onChange: level => changes.push(level) });
  for (let i = 0; i < 10; i++) governor.sample(50);
  assert.deepEqual(changes, []);
  for (let i = 0; i < 10; i++) governor.sample(50);
  assert.deepEqual(changes, ["high"]);
  for (let i = 0; i < 100; i++) governor.sample(8);
  assert.equal(governor.level, "high");
  for (let i = 0; i < 10; i++) governor.sample(400); // 分頁切換造成的長間隔不計入
  assert.equal(governor.level, "high");
  const floor = createQualityGovernor({ level: "low", windowSize: 5, onChange: () => assert.fail("should stay at floor") });
  for (let i = 0; i < 30; i++) floor.sample(100);
  assert.equal(floor.level, "low");
});
