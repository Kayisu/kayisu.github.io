const KEY = "sandstruction-ui-v1";
export function readPreferences(storage) {
  try {
    const p = JSON.parse(storage.getItem(KEY) || "{}");
    return { road: p.road === true, vehicle: p.vehicle !== false, hud: true };
  } catch {
    return { road: false, vehicle: true, hud: true };
  }
}
export function initGameShell(doc = document, storage) {
  if (!storage) {
    try {
      storage = localStorage;
    } catch {
      storage = { getItem: () => null, setItem: () => {} };
    }
  }
  const $ = (id) => doc.getElementById(id),
    state = readPreferences(storage);
  function reflect() {
    doc.body.classList.toggle("road-panel-hidden", !state.road);
    doc.body.classList.toggle("vehicle-panel-hidden", !state.vehicle);
    doc.body.classList.toggle("hud-hidden", !state.hud);
    $("roadPanelBtn").setAttribute("aria-expanded", String(state.road));
    $("vehiclePanelBtn").setAttribute("aria-expanded", String(state.vehicle));
    $("hudBtn").setAttribute("aria-pressed", String(!state.hud));
    $("hudBtn").textContent = state.hud
      ? "Sade ekran · P"
      : "Arayüzü göster · P";
    try {
      storage.setItem(
        KEY,
        JSON.stringify({ road: state.road, vehicle: state.vehicle }),
      );
    } catch {}
  }
  function toggle(part) {
    state[part] = !state[part];
    reflect();
  }
  $("roadPanelBtn").onclick = () => toggle("road");
  $("vehiclePanelBtn").onclick = () => toggle("vehicle");
  $("closeRoadBtn").onclick = () => {
    state.road = false;
    reflect();
    $("roadPanelBtn").focus();
  };
  $("closeVehicleBtn").onclick = () => {
    state.vehicle = false;
    reflect();
    $("vehiclePanelBtn").focus();
  };
  $("hudBtn").onclick = () => toggle("hud");
  reflect();
  return { state, toggle };
}
export function finishBoot() {
  document.body.classList.remove("booting");
  document.getElementById("bootStatus").hidden = true;
  document.getElementById("startBtn").disabled = false;
  document.getElementById("continueBtn").disabled = false;
}
