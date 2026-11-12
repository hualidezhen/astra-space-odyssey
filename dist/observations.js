import * as T from './vendor/three.module.js';

// Coordinates belong to the equirectangular Mars texture, with V measured from the south pole.
const canyon={u:.294,v:.446};

export function createObservations(planets,camera,onLandmark,toast){
  const figure=document.getElementById('mars-reference'),reference=figure.querySelector('canvas');
  const ctx=reference.getContext('2d'),photoCover=document.getElementById('archive-photo');
  const ray=new T.Raycaster(),cursor=new T.Vector2();
  let referenceSource=null,photo=null;
  function loadPhoto(data){
    if(typeof data!=='string'||!data.startsWith('data:image/jpeg;base64,'))return;
    photo=new Image();photo.src=data;photoCover.src=data;
  }
  function show(id){
    figure.hidden=id!=='mars';photoCover.hidden=id!=='saturn'||!photo;
  }
  function updateReference(){
    const image=planets.get('mars').globe.material.map?.image;
    if(!image||!image.width||image===referenceSource)return;
    const w=image.width*.16,h=image.height*.105;
    ctx.drawImage(image,image.width*canyon.u-w/2,image.height*(1-canyon.v)-h/2,w,h,0,0,reference.width,reference.height);
    referenceSource=image;
  }
  function identify(model,clientX,clientY){
    const globe=model.children.find(c=>c.geometry===planets.get('mars').globe.geometry);
    if(!globe||!referenceSource){toast('火星参考影像正在载入');return;}
    cursor.set(clientX/innerWidth*2-1,1-clientY/innerHeight*2);ray.setFromCamera(cursor,camera);
    const uv=ray.intersectObject(globe,false)[0]?.uv;
    if(!uv){toast('请点选火星表面');return;}
    const du=Math.min(Math.abs(uv.x-canyon.u),1-Math.abs(uv.x-canyon.u));
    if((du/.059)**2+((uv.y-canyon.v)/.034)**2<=1){onLandmark();return;}
    const longitude=Math.round((uv.x-.5)*360),latitude=Math.round((uv.y-.5)*180);
    toast('所选位置 '+Math.abs(latitude)+'°'+(latitude>=0?'N':'S')+' / '+Math.abs(longitude)+'°'+(longitude>=0?'E':'W')+'。寻找南纬约 10°、西经约 75° 的狭长裂谷。');
  }
  return {loadPhoto,show,updateReference,identify,get photo(){return photo;}};
}
