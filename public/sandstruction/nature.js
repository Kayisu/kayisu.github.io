import * as T from "./vendor/three.module.js";

export function plantForest(parent, terrain, rng) {
  const trees = [];
  for (let i = 0; i < 180; i++) {
    const x = (rng() - 0.5) * 92,
      z = (rng() - 0.5) * 92;
    if (
      (x < -19 && z > 14) ||
      Math.abs(x) < 13 ||
      Math.hypot(x + 15, z - 27) < 10
    )
      continue;
    trees.push({ x, z, scale: 0.7 + rng() * 0.65, rotation: rng() * 6.28 });
  }
  const dummy = new T.Object3D();
  const trunk = new T.InstancedMesh(
    new T.CylinderGeometry(0.13, 0.2, 1.9, 6),
    new T.MeshStandardMaterial({ color: 0x827258, roughness: 1 }),
    trees.length,
  );
  trunk.castShadow = true;
  parent.add(trunk);
  const layers = [0x536f53, 0x6c865d, 0x8c9b6a].map((color, j) => {
    const mesh = new T.InstancedMesh(
      new T.ConeGeometry(1.15 - j * 0.23, 1.9, 7),
      new T.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }),
      trees.length,
    );
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  });
  trees.forEach((tree, i) => {
    const y = terrain.sample(tree.x, tree.z);
    dummy.rotation.set(0, tree.rotation, 0);
    dummy.scale.setScalar(tree.scale);
    dummy.position.set(tree.x, y + 0.9 * tree.scale, tree.z);
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);
    layers.forEach((layer, j) => {
      dummy.position.y = y + (1.65 + j * 0.68) * tree.scale;
      dummy.updateMatrix();
      layer.setMatrixAt(i, dummy.matrix);
    });
  });
  for (const mesh of [trunk, ...layers]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  const grassPoints = [];
  for (let i = 0; i < 2300; i++) {
    const x = (rng() - 0.5) * 93,
      z = (rng() - 0.5) * 93;
    if (
      (x < -20 && z > 15) ||
      Math.abs(x) < 10 ||
      Math.hypot(x + 15, z - 27) < 9
    )
      continue;
    grassPoints.push({
      x,
      z,
      y: terrain.sample(x, z),
      s: 0.18 + rng() * 0.32,
      rotation: rng() * Math.PI,
    });
  }
  const grass = new T.InstancedMesh(
    new T.ConeGeometry(0.15, 1, 3),
    new T.MeshStandardMaterial({
      color: 0x9ca26d,
      roughness: 1,
      flatShading: true,
    }),
    grassPoints.length,
  );
  grass.frustumCulled = false;
  parent.add(grass);
  const refresh = () => {
    grassPoints.forEach((point, i) => {
      const idx = terrain.nearest(point.x, point.z),
        hide =
          terrain.mat[idx] !== 0 ||
          terrain.marks[idx] > 0.15 ||
          Math.abs(terrain.sample(point.x, point.z) - point.y) > 0.14;
      dummy.position.set(point.x, point.y + point.s * 0.35, point.z);
      dummy.rotation.set(0, point.rotation, 0);
      dummy.scale.setScalar(hide ? 0 : point.s);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    });
    grass.instanceMatrix.needsUpdate = true;
  };
  refresh();
  parent.userData.refreshNature = refresh;
}
