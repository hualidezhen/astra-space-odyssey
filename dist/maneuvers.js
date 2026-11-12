import * as T from './vendor/three.module.js';

// Distances and velocities on final approach are measured in the port's moving reference frame.
export function createManeuvers({ship,camera,port,saturn,keys,toast,onDock,onBoard,onPhoto,onRelease}) {
  const panel=document.getElementById('maneuver-panel');
  const heading=panel.querySelector('strong'),readout=panel.querySelector('output');
  const primary=document.getElementById('maneuver-action'),assist=document.getElementById('maneuver-assist');
  const hint=document.getElementById('maneuver-hint');
  const local=new T.Vector3(),velocity=new T.Vector3(),point=new T.Vector3(),offset=new T.Vector3();
  const portOrigin=new T.Vector3(0,2,68),cameraOffset=new T.Vector3(),rotation=new T.Quaternion();
  const axis=new T.Vector3(),right=new T.Vector3(),forward=new T.Vector3(),sunward=new T.Vector3(.6,0,1);
  let mode='',automatic=false,lock=0,docked=false,azimuth=0,elevation=4,range=6.5,frameRequested=false,lastReading='';
  const axisKey=(positive,negative)=>Number(keys.has(positive))-Number(keys.has(negative));
  const setReadout=value=>{if(value!==lastReading){readout.textContent=value;lastReading=value;}};
  function display(next){
    mode=next;keys.clear();panel.hidden=!next;document.body.classList.toggle('maneuvering',!!next);
    panel.dataset.mode=next;lastReading='';
  }
  function cancel(){
    if(!mode)return;
    display('');docked=false;automatic=false;lock=0;frameRequested=false;onRelease();
  }
  function approach(){
    if(mode==='dock')return;
    display('dock');local.set(3.2,-1.8,36);velocity.set(0,0,0);lock=0;automatic=false;docked=false;
    heading.textContent='泊位 01 · 末段进场';hint.textContent='W/S 进退 · A/D 横移 · ↑/↓ 升降。偏差小于 0.7 m、剩余间距小于 0.8 m，松开推进再锁定。';
    primary.textContent='锁定对接环';primary.disabled=true;assist.hidden=false;assist.textContent='自动靠泊';
    updateDock(0);
  }
  function survey(){
    if(mode==='photo')return;
    display('photo');azimuth=0;elevation=4;range=6.5;
    heading.textContent='土星 · 环面摄影航线';hint.textContent='拖动或用方向键绕飞，W/S 调整距离。将环面仰角调到 15° 至 35° 后拍摄。';
    primary.textContent='拍摄并存档';primary.disabled=true;assist.hidden=true;updatePhoto(0);
  }
  function updateDock(dt){
    const settling=automatic||lock>0||docked;
    if(settling){
      const amount=1-Math.exp(-dt*(lock||docked?5:1.15));
      offset.copy(local);
      local.lerp(point.set(0,0,6),amount);
      velocity.copy(local).sub(offset).divideScalar(Math.max(dt,.000001));
    }else{
      const amount=1-Math.exp(-dt*5);
      velocity.lerp(point.set(axisKey('KeyD','KeyA')*3,axisKey('ArrowUp','ArrowDown')*3,axisKey('KeyS','KeyW')*6),amount);
      local.addScaledVector(velocity,dt);local.x=T.MathUtils.clamp(local.x,-11,11);local.y=T.MathUtils.clamp(local.y,-8,8);local.z=T.MathUtils.clamp(local.z,6,58);
    }
    const lateral=Math.hypot(local.x,local.y),distance=local.z-6;
    const ready=lateral<.7&&distance<.8&&velocity.length()<.6;
    if(automatic&&ready&&!lock)lock=.001;
    if(lock>0&&!docked){
      lock=Math.min(1,lock+dt*1.15);
      if(lock===1){docked=true;onDock();heading.textContent='泊位 01 · 气密连接完成';hint.textContent='进入气闸，可透过舷窗查看停靠的探索者号。';primary.textContent='进入气闸';assist.hidden=true;}
    }
    port.updateWorldMatrix(true,false);port.getWorldQuaternion(rotation);
    ship.position.copy(port.localToWorld(point.copy(portOrigin).add(local)));ship.quaternion.copy(rotation);
    cameraOffset.set(5,5,20).applyQuaternion(rotation);camera.position.copy(ship.position).add(cameraOffset);
    camera.lookAt(point.set(0,1,-14).applyQuaternion(rotation).add(ship.position));
    primary.disabled=!docked&&(!ready||lock>0);
    setReadout(docked?'舱压已平衡 · 机械锁已闭合':('间距 '+distance.toFixed(1)+' m　横偏 '+local.x.toFixed(1)+'　高差 '+local.y.toFixed(1)+' m　速度 '+velocity.length().toFixed(1)+' m/s'));
  }
  function moveView(dx,dy){
    if(mode!=='photo')return;
    azimuth-=dx*.004;elevation=T.MathUtils.clamp(elevation+dy*.16,-65,65);
  }
  function updatePhoto(dt){
    moveView(axisKey('ArrowRight','ArrowLeft')*dt*150,(axisKey('ArrowUp','ArrowDown'))*dt*100);
    range=T.MathUtils.clamp(range+axisKey('KeyS','KeyW')*dt,4.2,9.5);
    const ring=saturn.group.children.find(c=>c.geometry?.type==='RingGeometry');
    ring.getWorldQuaternion(rotation);axis.set(0,0,1).applyQuaternion(rotation).normalize();
    forward.copy(sunward).addScaledVector(axis,-axis.dot(sunward)).normalize();right.crossVectors(axis,forward).normalize();
    const lat=T.MathUtils.degToRad(elevation);
    offset.copy(forward).multiplyScalar(Math.cos(azimuth)*Math.cos(lat)).addScaledVector(right,Math.sin(azimuth)*Math.cos(lat)).addScaledVector(axis,Math.sin(lat));
    camera.position.copy(saturn.group.position).addScaledVector(offset,range*saturn.r/Math.min(camera.aspect,1));camera.lookAt(saturn.group.position);
    ship.quaternion.copy(camera.quaternion);ship.position.copy(camera.position).add(point.set(0,-5,-22).applyQuaternion(camera.quaternion));
    primary.disabled=Math.abs(elevation)<15||Math.abs(elevation)>35;
    setReadout('环面仰角 '+elevation.toFixed(1)+'°　轨道距离 '+(camera.position.distanceTo(saturn.group.position)/saturn.r).toFixed(1)+' R♄');
  }
  function interact(){
    if(primary.disabled){toast(mode==='photo'?'请调整环面仰角至 15° 至 35°':'请先对准泊位并减速');return;}
    if(mode==='dock'){if(docked)onBoard();else lock=.001;}
    if(mode==='photo')frameRequested=true;
  }
  primary.onclick=interact;
  assist.onclick=()=>{automatic=!automatic;assist.textContent=automatic?'接管手动靠泊':'自动靠泊';};
  document.getElementById('maneuver-exit').onclick=cancel;
  for(const b of panel.querySelectorAll('[data-drive]')){
    b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.drive);};
    b.onlostpointercapture=b.onpointercancel=b.onpointerup=()=>keys.delete(b.dataset.drive);
  }
  function afterRender(canvas){
    if(!frameRequested)return;frameRequested=false;
    const saved=document.createElement('canvas');saved.width=Math.min(900,canvas.width);saved.height=Math.round(saved.width*canvas.height/canvas.width);
    saved.getContext('2d').drawImage(canvas,0,0,saved.width,saved.height);onPhoto(saved.toDataURL('image/jpeg',.86));
  }
  return {approach,survey,cancel,interact,moveView,afterRender,get mode(){return mode;},get docked(){return docked;},get lock(){return lock;},
    update(dt){if(mode==='dock')updateDock(dt);else if(mode==='photo')updatePhoto(dt);}};
}
