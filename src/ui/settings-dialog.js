import { DEFAULT_SETTINGS, FPS_CAPS, PRESETS, applyPreset, updateSetting } from "../settings/graphics.js";

/** 畫質設定對話框：只讀寫設定物件，實際套用由 onChange 回呼負責。 */
export function createSettingsDialog({ dialog, getSettings, onChange, getLive }) {
  const presetButtons = [...dialog.querySelectorAll("[data-preset]")];
  const toggles = [...dialog.querySelectorAll("[data-key]")];
  const fps = dialog.querySelector("#opt-fps");
  const resolution = dialog.querySelector("#opt-resolution");
  const resolutionValue = dialog.querySelector("#opt-resolution-value");
  const live = dialog.querySelector("#settings-live");
  let liveTimer = 0;

  function sync() {
    const settings = getSettings();
    presetButtons.forEach(button => {
      const active = button.dataset.preset === settings.preset;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    for (const toggle of toggles) toggle.checked = Boolean(settings[toggle.dataset.key]);
    fps.value = String(settings.fpsCap);
    resolution.value = String(settings.resolution);
    resolutionValue.textContent = `${Math.round(settings.resolution * 100)}%`;
    const presetLabel = settings.preset === "auto" ? "自動" : settings.preset === "custom" ? "自訂" : PRESETS[settings.preset].label;
    dialog.querySelector("#settings-current").textContent = presetLabel;
    renderLive();
  }

  function renderLive() {
    const info = getLive();
    live.textContent = info
      ? `目前等級 ${info.levelLabel}　畫布 ${info.pixelRatio.toFixed(2)}×　${info.fps ? `${info.fps} FPS` : "待機"}`
      : "進入遊戲後顯示即時資訊。";
  }

  presetButtons.forEach(button => button.addEventListener("click", () => {
    onChange(applyPreset(getSettings(), button.dataset.preset)); sync();
  }));
  toggles.forEach(toggle => toggle.addEventListener("change", () => {
    onChange(updateSetting(getSettings(), toggle.dataset.key, toggle.checked)); sync();
  }));
  fps.addEventListener("change", () => { onChange(updateSetting(getSettings(), "fpsCap", Number(fps.value))); sync(); });
  resolution.addEventListener("input", () => { onChange(updateSetting(getSettings(), "resolution", Number(resolution.value))); sync(); });
  dialog.querySelector("#settings-reset").addEventListener("click", () => { onChange({ ...DEFAULT_SETTINGS }); sync(); });
  dialog.querySelector("#settings-close").addEventListener("click", () => dialog.close());
  // 點擊對話框外的遮罩即關閉。
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => clearInterval(liveTimer));

  return {
    open() {
      sync();
      if (!dialog.open) dialog.showModal();
      clearInterval(liveTimer);
      liveTimer = setInterval(renderLive, 500);
    },
    FPS_CAPS
  };
}
