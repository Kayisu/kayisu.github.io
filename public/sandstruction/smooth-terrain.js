import * as T from "./vendor/three.module.js";
import { N, SIZE, CELL } from "./terrain.js?v=0.7.0";
import { SurfaceField } from "./surface-field.js?v=0.7.0";
import { ROAD_MATERIAL_GLSL } from "./road-material.js?v=0.7.0";
export const SURFACE_QUALITIES = [256, 512, 768, 1024];
const constants = `const float SS_N=${N.toFixed(1)}; const float SS_SIZE=${SIZE.toFixed(1)}; const float SS_CELL=${CELL.toFixed(8)}; const float SS_TEX=${(N + 1).toFixed(1)};`;
const weights = `vec4 SS_weights(float t){float a=1.0-t;float t2=t*t;float t3=t2*t;return vec4(a*a*a,3.0*t3-6.0*t2+4.0,-3.0*t3+3.0*t2+3.0*t+1.0,t3)/6.0;}`;
export const SURFACE_VERTEX_GLSL = `
${constants}
uniform sampler2D uSurfaceField;
uniform float uTerrainBlend;
varying vec2 vSurfaceGrid;
varying float vSurfaceCompaction;
${weights}
vec4 SS_derivatives(float t){return vec4(-0.5*(1.0-t)*(1.0-t),1.5*t*t-2.0*t,-1.5*t*t+t+0.5,0.5*t*t);}
struct SS_Terrain{float height;vec3 normal;float compaction;};
SS_Terrain SS_sample(vec2 world){
 vec2 g=clamp((world+vec2(SS_SIZE*0.5))/SS_CELL,vec2(0.0),vec2(SS_N));
 vec2 base=floor(g),f=g-base;
 vec4 wx=SS_weights(f.x),wz=SS_weights(f.y),dx=SS_derivatives(f.x),dz=SS_derivatives(f.y);
 float h=0.0,sx=0.0,sz=0.0,comp=0.0;
 for(int z=0;z<4;z++){for(int x=0;x<4;x++){
  vec2 q=clamp(base+vec2(float(x)-1.0,float(z)-1.0),vec2(0.0),vec2(SS_N));
  vec4 v=texture2D(uSurfaceField,(q+0.5)/SS_TEX);
  float value=mix(v.r,v.g,uTerrainBlend),w=wx[x]*wz[z];
  h+=value*w;sx+=value*dx[x]*wz[z];sz+=value*wx[x]*dz[z];comp+=v.b*w;
 }}
 SS_Terrain result;result.height=h;result.normal=normalize(vec3(-sx/SS_CELL,1.0,-sz/SS_CELL));result.compaction=comp;return result;
}
`;
export const SURFACE_FRAGMENT_GLSL = `
${constants}
uniform sampler2D uSurfaceColor;
varying vec2 vSurfaceGrid;
varying float vSurfaceCompaction;
${weights}
vec3 SS_color(vec2 grid){
 vec2 base=floor(grid),f=fract(grid);
 vec4 wx=SS_weights(f.x),wz=SS_weights(f.y);
 vec2 gx=vec2(wx.x+wx.y,wx.z+wx.w),gz=vec2(wz.x+wz.y,wz.z+wz.w);
 vec2 hx=vec2(-1.0+wx.y/gx.x,1.0+wx.w/gx.y),hz=vec2(-1.0+wz.y/gz.x,1.0+wz.w/gz.y);
 vec3 a=texture2D(uSurfaceColor,(base+vec2(hx.x,hz.x)+0.5)/SS_TEX).rgb;
 vec3 b=texture2D(uSurfaceColor,(base+vec2(hx.y,hz.x)+0.5)/SS_TEX).rgb;
 vec3 c=texture2D(uSurfaceColor,(base+vec2(hx.x,hz.y)+0.5)/SS_TEX).rgb;
 vec3 d=texture2D(uSurfaceColor,(base+vec2(hx.y,hz.y)+0.5)/SS_TEX).rgb;
 return mix(mix(a,b,gx.y),mix(c,d,gx.y),gz.y);
}
`;
export function configureSurfaceShader(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = SURFACE_VERTEX_GLSL + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <beginnormal_vertex>",
    "#include <beginnormal_vertex>\nSS_Terrain ssTerrain=SS_sample(position.xz);objectNormal=ssTerrain.normal;",
  );
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    "#include <begin_vertex>\ntransformed.y=ssTerrain.height;vSurfaceGrid=clamp((position.xz+vec2(SS_SIZE*0.5))/SS_CELL,vec2(0.0),vec2(SS_N));vSurfaceCompaction=ssTerrain.compaction;",
  );
  shader.fragmentShader =
    SURFACE_FRAGMENT_GLSL + ROAD_MATERIAL_GLSL + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <color_fragment>",
    "#include <color_fragment>\nRD_Surface ssRoad;if(uDesktopDetail>.5){ssRoad=RD_read(vSurfaceGrid,SS_color(vSurfaceGrid));diffuseColor.rgb*=ssRoad.color;}else{diffuseColor.rgb*=SS_color(vSurfaceGrid)*(1.0-texture2D(uTireTracks,vSurfaceGrid/SS_N).r*.23);}",
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <roughnessmap_fragment>",
    "#include <roughnessmap_fragment>\nroughnessFactor*=uDesktopDetail>.5?ssRoad.roughness:mix(1.0,0.68,vSurfaceCompaction);",
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <normal_fragment_maps>",
    T.ShaderChunk.normal_fragment_maps.replace(
      "dHdxy_fwd()",
      "dHdxy_fwd()*mix(1.0,0.12,vSurfaceCompaction)*(1.0-uDesktopDetail)",
    ) +
      "\nif(uDesktopDetail>.5){normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(ssRoad.relief),dFdy(ssRoad.relief)),faceDirection);}",
  );
}
export class SmoothTerrain {
  constructor(
    blend,
    detailTexture,
    segments = 768,
    detailed = false,
    tracks = null,
  ) {
    this.blend = blend;
    this.tracks = tracks;
    this.trackTexture = new T.DataTexture(
      tracks?.data || new Uint8Array(4),
      tracks?.resolution || 1,
      tracks?.resolution || 1,
      T.RGBAFormat,
    );
    this.trackTexture.minFilter = this.trackTexture.magFilter = T.LinearFilter;
    this.trackTexture.generateMipmaps = false;
    this.trackTexture.needsUpdate = true;
    this.field = new SurfaceField();
    this.heightTexture = new T.DataTexture(
      this.field.data,
      N + 1,
      N + 1,
      T.RGBAFormat,
      T.FloatType,
    );
    this.heightTexture.minFilter = this.heightTexture.magFilter =
      T.NearestFilter;
    this.heightTexture.generateMipmaps = false;
    this.colorTexture = new T.DataTexture(
      this.field.color,
      N + 1,
      N + 1,
      T.RGBAFormat,
      T.UnsignedByteType,
    );
    this.colorTexture.minFilter = this.colorTexture.magFilter = T.LinearFilter;
    this.colorTexture.generateMipmaps = false;
    this.materialTexture = new T.DataTexture(
      this.field.coverage,
      N + 1,
      N + 1,
      T.RGBAFormat,
      T.UnsignedByteType,
    );
    this.materialTexture.minFilter = this.materialTexture.magFilter =
      T.LinearFilter;
    this.materialTexture.generateMipmaps = false;
    const uniforms = (this.uniforms = {
      uTireTracks: { value: this.trackTexture },
      uDesktopDetail: { value: detailed ? 1 : 0 },
      uInspection: { value: 0 },
      uRoadLine: { value: new T.Vector4() },
      uRoadGrade: { value: new T.Vector4() },
      uSurfaceMaterial: { value: this.materialTexture },
      uSurfaceField: { value: this.heightTexture },
      uSurfaceColor: { value: this.colorTexture },
      uTerrainBlend: blend,
    });
    this.material = new T.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      map: detailTexture,
      bumpMap: detailTexture,
      bumpScale: 0.035,
      dithering: true,
    });
    this.material.onBeforeCompile = (shader) =>
      configureSurfaceShader(shader, uniforms);
    this.material.customProgramCacheKey = () => "sandstruction-surface-v070";
    this.mesh = new T.Mesh(new T.BufferGeometry(), this.material);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.setQuality(segments);
  }
  updateTracks() {
    if (this.tracks?.dirty) {
      this.trackTexture.needsUpdate = true;
      this.tracks.dirty = false;
    }
  }
  setRoad(plan) {
    this.uniforms.uRoadLine.value.set(
      plan?.start.x || 0,
      plan?.start.z || 0,
      plan?.dx || 0,
      plan?.dz || 0,
    );
    this.uniforms.uRoadGrade.value.set(
      plan?.start.h || 0,
      plan?.length || 0,
      plan?.width || 0,
      plan?.slope || 0,
    );
  }
  setQuality(segments) {
    this.segments = SURFACE_QUALITIES.includes(segments) ? segments : 768;
    const geometry = new T.PlaneGeometry(
      SIZE,
      SIZE,
      this.segments,
      this.segments,
    );
    geometry.rotateX(-Math.PI / 2);
    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;
  }
  update(terrain, instant = false) {
    this.field.update(terrain, this.blend.value, instant);
    this.heightTexture.needsUpdate =
      this.colorTexture.needsUpdate =
      this.materialTexture.needsUpdate =
        true;
    this.blend.value = 0;
  }
}
