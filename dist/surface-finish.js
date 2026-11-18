import * as T from './vendor/three.module.js';

const finishes=new Set(['ivory','chalk','slate','alloy','carbon','navy','copper']);
let grain;

function createGrain(){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'), pixels=ctx.createImageData(256,256);
  let seed=7119;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let y=0;y<256;y++){
    const band=(random()-.5)*32;
    for(let x=0;x<256;x++){
      const i=(y*256+x)*4, value=128+band+(random()-.5)*49;
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;
      pixels.data[i+3]=255;
    }
  }
  ctx.putImageData(pixels,0,0);
  ctx.lineWidth=.7;
  for(let i=0;i<76;i++){
    const x=random()*256,y=random()*256;
    ctx.strokeStyle=i%3?'#565656':'#dedede';
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2+random()*21,y+random()*1.7);ctx.stroke();
  }
  const texture=new T.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  return texture;
}

// Project the same metre-scale finish onto both authored meshes. The GLBs do
// not require UV seams, and normal mip filtering averages the grain at distance.
export function applySurfaceFinish(model){
  model.traverse(obj=>{
    if(!obj.isMesh)return;
    for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
      if(!finishes.has(mat.name)||mat.userData.surfaceFinish)continue;
      mat.userData.surfaceFinish=true;
      grain??=createGrain();
      mat.onBeforeCompile=shader=>{
        shader.uniforms.hullGrain={value:grain};
        const vary='varying vec3 hullCoord; varying vec3 hullNormal;\n';
        shader.vertexShader=vary+shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\nhullCoord=position*1.15; hullNormal=normal;');
        shader.fragmentShader=vary+'uniform sampler2D hullGrain;\n'+shader.fragmentShader.replace(
          '#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          vec3 weight=pow(abs(normalize(hullNormal)),vec3(6.0));
          weight/=max(dot(weight,vec3(1.)),.001);
          float grainValue=dot(weight,vec3(texture2D(hullGrain,hullCoord.yz).r,
            texture2D(hullGrain,hullCoord.xz).r,texture2D(hullGrain,hullCoord.xy).r))-.5;
          roughnessFactor=clamp(roughnessFactor+grainValue*.39,.09,1.);
          diffuseColor.rgb*=1.+grainValue*.09;`);
      };
      mat.needsUpdate=true;
    }
  });
}
