import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import './chat.css';

interface Props {
  bubble: string;
  reducedMotion: boolean;
  /** The header trigger is hovered or focused; shows the bubble even under reduced motion. */
  hinted: boolean;
  /** The panel is open; the bubble stays hidden. */
  muted: boolean;
  onOpen: () => void;
}

const TOY = { roughness: 0.92, metalness: 0, clearcoat: 0 } as const;

/** Satellite that floats near the home system and opens the scripted assistant. */
export default function ChatBeacon({ bubble, reducedMotion, hinted, muted, onOpen }: Props) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const [cycle, setCycle] = useState(false);

  useFrame(({ clock }) => {
    // Reduced motion freezes the satellite at its t = 0 pose.
    const t = reducedMotion ? 0 : clock.elapsedTime;
    group.current?.position.set(-8 + 0.4 * Math.sin(0.3 * t), 3.2 + 0.25 * Math.sin(0.8 * t), 7);
    if (body.current) body.current.rotation.y = 0.25 * t;
    if (glow.current) glow.current.emissiveIntensity = 0.4 + ((Math.sin(2.2 * t) + 1) / 2) * 1.6;
    const show = !reducedMotion && clock.elapsedTime % 7 > 4.2;
    if (show !== cycle) setCycle(show);
  });

  return <group ref={group}>
    <group
      ref={body}
      onClick={(event) => { event.stopPropagation(); onOpen(); }}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}
    >
      <mesh>
        <capsuleGeometry args={[0.28, 0.5, 4, 8]} />
        <meshPhysicalMaterial color="#e9e4da" {...TOY} />
      </mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.75, 0, 0]}>
        <boxGeometry args={[0.8, 0.04, 0.4]} />
        <meshPhysicalMaterial color="#7d8aa0" {...TOY} />
      </mesh>)}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshStandardMaterial ref={glow} color="#ffd9a0" emissive="#ffb85c" emissiveIntensity={1.2} />
      </mesh>
    </group>
    {!muted && (cycle || hovered || hinted) && <Html zIndexRange={[4, 0]} position={[0.6, 1.1, 0]} style={{ pointerEvents: 'none' }}>
      <div className="chat-bubble">{bubble}</div>
    </Html>}
  </group>;
}
