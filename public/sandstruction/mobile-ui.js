import { TouchInput } from "./touch-input.js?v=0.6.0";

export const MOBILE_QUERY = "(any-pointer: coarse), (max-width: 900px)";

export function initMobileUI({ canPlay, clearInput, openDialog, onLayout }) {
  const $ = (id) => document.getElementById(id),
    input = new TouchInput();
  const query = matchMedia(MOBILE_QUERY);
  const relocations = [
    [document.querySelector(".top-actions"), $("menuSheetBody")],
    [document.querySelector(".instrument"), $("toolSheetBody")],
    [document.querySelector(".bottom"), $("fleetSheetBody")],
    [document.querySelector(".map-panel"), $("mapSheetBody")],
  ].map(([node, target]) => {
    const anchor = document.createComment("desktop position");
    node.before(anchor);
    return { node, target, anchor };
  });
  function reflect() {
    if (input.stickId === null)
      $("driveThumb").style.transform = "translate(0px, 0px)";
    $("drivePad").classList.toggle("pressed", input.stickId !== null);
    $("touchWork").classList.toggle("pressed", input.work);
    $("touchBrake").classList.toggle("pressed", input.brake);
    $("workLock").setAttribute("aria-pressed", String(input.locked));
    $("workLock").textContent = input.locked ? "Durdur ■" : "Sabitle";
  }
  function reset() {
    input.reset();
    reflect();
  }
  function layout() {
    clearInput();
    reset();
    document.body.classList.toggle("touch-layout", query.matches);
    for (const { node, target, anchor } of relocations)
      if (query.matches) target.append(node);
      else anchor.after(node);
    if (!query.matches)
      document
        .querySelectorAll(".mobile-sheet[open]")
        .forEach((d) => d.close());
    onLayout();
  }
  query.addEventListener("change", layout);
  for (const [button, dialog] of [
    ["mobileMenuBtn", "menuSheet"],
    ["fleetSheetBtn", "fleetSheet"],
    ["toolSheetBtn", "toolSheet"],
    ["mapSheetBtn", "mapSheet"],
    ["mobileHelpBtn", "helpDialog"],
  ])
    $(button).onclick = () => openDialog(dialog);
  $("fullscreenBtn").hidden = !(
    document.fullscreenEnabled && document.documentElement.requestFullscreen
  );
  $("fullscreenBtn").onclick = async () => {
    clearInput();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      $("fullscreenBtn").textContent = "Tam ekran kullanılamıyor";
    }
  };
  document.addEventListener("fullscreenchange", () => {
    $("fullscreenBtn").textContent = document.fullscreenElement
      ? "Tam ekrandan çık ↙"
      : "Tam ekran ↗";
  });
  const pad = $("drivePad"),
    thumb = $("driveThumb");
  function move(e) {
    const r = pad.getBoundingClientRect();
    const p = input.stickMove(
      e.pointerId,
      e.clientX - r.left - r.width / 2,
      e.clientY - r.top - r.height / 2,
      r.width * 0.31,
    );
    if (p) thumb.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }
  pad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (e.button !== 0 || !canPlay() || !input.stickStart(e.pointerId)) return;
    pad.setPointerCapture(e.pointerId);
    reflect();
    move(e);
  });
  pad.addEventListener("pointermove", move);
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    pad.addEventListener(type, (e) => {
      input.release(e.pointerId);
      reflect();
    });
  for (const [id, field] of [
    ["touchWork", "workPointers"],
    ["touchBrake", "brakePointers"],
  ]) {
    const button = $(id);
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (e.button !== 0 || !canPlay()) return;
      input[field].add(e.pointerId);
      button.setPointerCapture(e.pointerId);
      reflect();
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      button.addEventListener(type, (e) => {
        input.release(e.pointerId);
        reflect();
      });
  }
  $("workLock").onclick = () => {
    if (canPlay()) {
      input.locked = !input.locked;
      reflect();
    }
  };
  // Do not let long-press selection/context menus interrupt captured controls.
  document
    .querySelector(".mobile-controls")
    .addEventListener("contextmenu", (e) => e.preventDefault());
  layout();
  return {
    input,
    reset,
    get touch() {
      return query.matches;
    },
    machineChanged(vehicle) {
      $("mobileMachineName").textContent = vehicle.short;
      $("touchWorkLabel").textContent = {
        truck: "DÖK",
        loader: vehicle.unload ? "BOŞALT" : "KAZ",
        dozer: vehicle.unload ? "DÜZLE" : "İT",
        roller: "SIKIŞTIR",
        paver: "SER",
        shovel: vehicle.unload ? "BOŞALT" : "KAZ",
      }[vehicle.id];
    },
    readout(speed, cargo) {
      $("mobileReadout").textContent = `${speed} km/sa · ${cargo} m³`;
    },
  };
}
