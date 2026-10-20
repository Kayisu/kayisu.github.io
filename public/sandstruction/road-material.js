// Color identity is reconstructed separately from the smooth height surface.
// Sharpened coverage retains narrow shoulders instead of blending broad paint.
export function sharpenCoverage(weights, power = 5) {
  const values = weights.map((w) => Math.max(0, w) ** power),
    total = values.reduce((a, b) => a + b, 0);
  return values.map((v) => (total ? v / total : 0));
}
export const ROAD_MATERIAL_GLSL = `
uniform sampler2D uSurfaceMaterial;
uniform sampler2D uTireTracks;
uniform sampler2D uSurfaceField;
uniform float uDesktopDetail;
uniform float uInspection;
uniform vec4 uRoadLine;
uniform vec4 uRoadGrade;
float RD_hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float RD_noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(RD_hash(i),RD_hash(i+vec2(1.0,0.0)),f.x),mix(RD_hash(i+vec2(0.0,1.0)),RD_hash(i+1.0),f.x),f.y);}
vec3 RD_coverage(vec2 grid){
 vec2 base=floor(grid),f=fract(grid);
 vec4 wx=SS_weights(f.x),wz=SS_weights(f.y);
 vec2 gx=vec2(wx.x+wx.y,wx.z+wx.w),gz=vec2(wz.x+wz.y,wz.z+wz.w);
 vec2 hx=vec2(-1.0+wx.y/gx.x,1.0+wx.w/gx.y),hz=vec2(-1.0+wz.y/gz.x,1.0+wz.w/gz.y);
 vec3 a=texture2D(uSurfaceMaterial,(base+vec2(hx.x,hz.x)+.5)/SS_TEX).rgb;
 vec3 b=texture2D(uSurfaceMaterial,(base+vec2(hx.y,hz.x)+.5)/SS_TEX).rgb;
 vec3 c=texture2D(uSurfaceMaterial,(base+vec2(hx.x,hz.y)+.5)/SS_TEX).rgb;
 vec3 d=texture2D(uSurfaceMaterial,(base+vec2(hx.y,hz.y)+.5)/SS_TEX).rgb;
 return mix(mix(a,b,gx.y),mix(c,d,gx.y),gz.y);
}
struct RD_Surface {vec3 color;float relief;float roughness;float compaction;};
RD_Surface RD_read(vec2 grid,vec3 natural){
 vec2 world=grid*SS_CELL-SS_SIZE*.5,uv=(grid+.5)/SS_TEX;
 // Very small world-space variation breaks the raster outline without blurring it.
 vec2 edge=vec2(RD_noise(world*13.0),RD_noise(world.yx*11.0+21.0))-.5;
 vec3 coverage=RD_coverage(grid+edge*.16);
 vec4 w=pow(max(vec4(1.0-coverage.r-coverage.g-coverage.b,coverage),vec4(0.0)),vec4(5.0));
 w/=max(dot(w,vec4(1.0)),.0001);
 vec4 field=texture2D(uSurfaceField,uv);float comp=texture2D(uSurfaceMaterial,uv).a;
 float fine=mix(.5,RD_noise(world*63.0),1.0-smoothstep(.25,1.3,length(fwidth(world*63.0)))),aggregate=RD_noise(world*22.0),macro=RD_noise(world*.9);
 float detailFade=1.0-smoothstep(.25,1.3,length(fwidth(world*22.0)));
 float grain=mix(.5,aggregate,detailFade);
 vec3 sand=vec3(.62,.36,.115)*( .88+.2*fine+.06*macro );
 vec3 gravel=mix(vec3(.19,.22,.225),vec3(.43,.45,.43),smoothstep(.18,.8,grain));
 gravel*=.91+.1*macro;
 vec3 asphalt=mix(vec3(.105,.105,.09),vec3(.027,.034,.039),comp);
 asphalt*=mix(.65+grain*.8,.95+fine*.1,comp);
 float clods=RD_noise(world*5.4+RD_noise(world*1.7)*2.0);
 float stone=smoothstep(.73,.91,RD_noise(world*31.0))*detailFade;
 float bare=smoothstep(.28,.66,RD_noise(world*.32+8.0));
 vec3 soil=mix(vec3(.19,.135,.077),vec3(.33,.245,.14),clods);
 soil=mix(soil,vec3(.38,.35,.27),stone*.38);
 vec3 earth=mix(natural*.86,soil,.55+bare*.4)*(.91+.14*macro+.1*fine);
 float tracks=texture2D(uTireTracks,(world+SS_SIZE*.5)/SS_SIZE).r;
 float trackWeight=tracks*(1.0-w.w*comp*.85);
 RD_Surface r;r.color=earth*w.x+sand*w.y+gravel*w.z+asphalt*w.w;
 r.color*=1.0-trackWeight*.28;
 r.relief=w.x*(clods*.025+fine*.004+stone*.012)+ (w.y*.007*fine+w.z*.035*grain+w.w*mix(.03,.0018,comp)*grain)*detailFade-trackWeight*.006;
 r.roughness=dot(w,vec4(.98,.96,.94,mix(.95,.72,comp)));r.compaction=comp;
 if(uInspection>.5){
  vec2 d=vec2(uRoadLine.z,uRoadLine.w),v=world-uRoadLine.xy;
  float along=dot(v,d),side=dot(v,vec2(d.y,-d.x));
  bool inRoad=uRoadGrade.y>0.0&&along>=0.0&&along<=uRoadGrade.y&&abs(side)<=uRoadGrade.z*.5;
  if(uInspection<1.5){
    if(w.x<.8)r.color=mix(vec3(.68,.12,.035),vec3(.08,.48,.29),smoothstep(.15,.9,comp));
  }else if(inRoad){
    float target=uRoadGrade.x+along*uRoadGrade.w+w.w*.1;
    float delta=field.g-target;
    r.color=delta<-.075?vec3(.035,.27,.72):delta>.075?vec3(.75,.16,.035):vec3(.08,.5,.27);
  }
 }
 return r;
}
`;
