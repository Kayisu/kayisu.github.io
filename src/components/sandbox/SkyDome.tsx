import { useMemo } from 'react';
import * as THREE from 'three';

export default function SkyDome() {
  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(100, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  }, []);

  const material = useMemo(() => {
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uBottomColor;
      varying vec2 vUv;
      void main() {
        float h = vUv.y;
        vec3 color;
        if (h > 0.5) {
          color = mix(uHorizonColor, uTopColor, (h - 0.5) * 2.0);
        } else {
          color = mix(uBottomColor, uHorizonColor, h * 2.0);
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTopColor: { value: new THREE.Color(0x87ceeb) },
        uHorizonColor: { value: new THREE.Color(0xe0f0ff) },
        uBottomColor: { value: new THREE.Color(0xf5f0e8) },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, []);

  return <mesh geometry={geometry} material={material} />;
}