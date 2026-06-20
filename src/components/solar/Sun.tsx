import { useTexture } from '@react-three/drei';
import { SUN } from '../../data/planets';
import { useSolarStore } from '../../store/solarStore';

// The sun: an unlit textured sphere at the origin. Also a point light source
// (added in Scene). Clicking it opens the info panel and zooms, same as a planet.
export default function Sun() {
  const texture = useTexture(SUN.texture);
  const select = useSolarStore((s) => s.select);

  return (
    <mesh
      name={SUN.name}
      onClick={(e) => {
        e.stopPropagation();
        select(SUN.name);
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <sphereGeometry args={[SUN.radius, 32, 32]} />
      <meshBasicMaterial map={texture} color={SUN.color} />
    </mesh>
  );
}
