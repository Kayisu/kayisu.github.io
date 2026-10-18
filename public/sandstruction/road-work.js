export const ROAD_WORK_SPEED = Object.freeze({
  truck: 1.4,
  loader: 1.1,
  dozer: 1,
  roller: 1.05,
  paver: 0.85,
  shovel: 1.5,
});
export const ROAD_FILL_DEPTH = 0.4;
export const ROAD_ASPHALT_DEPTH = 0.1;
export const ROAD_SPREAD_WIDTH = 3.2;

// Align the working end, not the centre of the chassis, with the road stake.
export function roadPlacement(plan, vehicle, atEnd = false, lane = 0) {
  const width =
    vehicle.id === "roller"
      ? 2.2
      : vehicle.id === "dozer"
        ? vehicle.bladeWidth
        : ROAD_SPREAD_WIDTH;
  const offset =
    Math.max(-1, Math.min(1, lane)) * Math.max(0, (plan.width - width) / 2);
  const point = plan.point(atEnd ? plan.length : 0, offset),
    angle = plan.angle + (atEnd ? Math.PI : 0);
  const reach = {
    truck: -2.5,
    loader: 2.3,
    dozer: 2.05,
    roller: 1.25,
    paver: -2.1,
    shovel: 1.1,
  }[vehicle.id];
  return {
    x: point.x + Math.sin(angle) * reach,
    z: point.z + Math.cos(angle) * reach,
    angle,
    datum: plan.heightAt(point.x, point.z),
  };
}
