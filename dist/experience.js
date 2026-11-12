import * as T from './vendor/three.module.js';
import {createMission,expeditionSteps} from './mission.js';

import {dressDeck} from './deck-detail.js';
import {createObservations} from './observations.js';

const facts={
 mercury:{type:'类地行星',au:'0.39',year:'88 天',feature:'撞击坑与漫长白昼',text:'最接近太阳的行星。灰褐色岩石表面布满撞击坑，几乎没有大气来调节昼夜温差。',focus:'沿明暗交界线观察撞击地形。水星没有卫星，也没有行星环。',source:'https://science.nasa.gov/mercury/facts/'},
 venus:{type:'类地行星',au:'0.72',year:'225 天',feature:'厚重云层下的炽热世界',text:'体型接近地球，却被浓厚的二氧化碳大气包裹。强烈温室效应让它成为太阳系最热的行星。',focus:'展示的是金星云顶的纹理。致密云层遮住了固体地表，不能从可见光轨道视角直接看见。',source:'https://science.nasa.gov/venus/venus-facts/'},
 earth:{type:'类地行星',au:'1.00',year:'365.25 天',feature:'海洋、云层与生命',text:'我们共同的家园。液态海洋覆盖约 71% 的表面，薄薄的大气在昼夜交界处形成蓝色光弧。',focus:'旋转观察海陆轮廓与独立云层；转向夜面，可见城市灯光。',source:'https://science.nasa.gov/earth/facts/'},
 mars:{type:'类地行星',au:'1.52',year:'687 天',feature:'古老河道与红色沙尘',text:'岩石和尘土中的氧化铁赋予火星红色外观。巨型火山、峡谷与极地冰盖留下了漫长地质历史的痕迹。',focus:'放大查看明暗区域与极冠。火星稀薄的大气以二氧化碳为主，一天约为 24.6 小时。',source:'https://science.nasa.gov/mars/facts/'},
 jupiter:{type:'气态巨行星',au:'5.20',year:'约 12 年',feature:'云带与大红斑',text:'太阳系最大的行星，主要由氢和氦组成。快速自转与强烈大气运动塑造了交替分布的明暗云带。',focus:'旋转寻找大红斑。这是一场巨大的长期风暴；画面所见为云顶，并非可着陆的固体表面。',source:'https://science.nasa.gov/jupiter/jupiter-facts/'},
 saturn:{type:'气态巨行星',au:'9.58',year:'约 29 年',feature:'由冰粒与岩屑组成的光环',text:'土星的环由大量独立绕行的冰粒与岩屑构成。它们形成宽阔而纤薄的结构，分布着不同的环带和缝隙。',focus:'拖动改变视角，观察光环的厚薄与环缝。展厅中的亮度经过调整，方便辨认环带细节。',source:'https://science.nasa.gov/saturn/facts/'},
 uranus:{type:'冰巨行星',au:'19.2',year:'约 84 年',feature:'侧躺着旋转的青色世界',text:'大气中的甲烷吸收红光，让天王星呈现蓝绿色。极端的自转轴倾角使它仿佛侧躺在轨道上运行。',focus:'观察近乎侧卧的自转轴。天王星与海王星被归为冰巨行星，内部组成不同于木星和土星。',source:'https://science.nasa.gov/uranus/facts/'},
 neptune:{type:'冰巨行星',au:'30.1',year:'约 165 年',feature:'遥远的风暴世界',text:'八大行星中距离太阳最远的一颗。冰巨行星的大气仍非常活跃，有强风和不断演变的云系。',focus:'展示纹理经过颜色增强，便于辨认云层；色彩和展厅比例不等同于肉眼观测。',source:'https://science.nasa.gov/neptune/neptune-facts/'}
};

export function createExperience({camera,renderer,planets,ship,keys,toast,environment,getContext,navigate,startDock,startPhoto,restoreUI}){
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
 let storageWarned=false;
 const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{if(!storageWarned){toast('浏览器未允许本地存储，本次进度将保留到关闭页面');storageWarned=true;}}};
 const mission=createMission(read('astra-expedition-v2',{}));
 const rawArchive=read('astra-archives-v1',{}),records={};
 for(const id of planets.keys())if(typeof rawArchive[id]==='string')records[id]=rawArchive[id];
 let active=null,returnCamera=null,interior=null,archive=null,archiveId='earth',archiveTab='overview',autoRotate=true,archiveTheta=.35,archivePhi=1.3,archiveDistance=3.6;
 let yaw=0,pitch=0,walkTarget=null,nearest=null,stepTimer=0,lastSaveSecond=-1;
 const walker=new T.Vector3(0,1.7,6),direction=new T.Vector3(),target=new T.Vector3();
 const observations=createObservations(planets,camera,()=>{
   records.mars=new Date().toISOString();save('astra-archives-v1',records);event('landmark','mars');renderArchiveText();toast('地貌匹配 · 水手峡谷坐标已归档');
 },toast);
 observations.loadPhoto(read('astra-saturn-photo-v1',null));
 function recordPhoto(data){
   observations.loadPhoto(data);save('astra-saturn-photo-v1',data);records.saturn=new Date().toISOString();save('astra-archives-v1',records);
   event('photo','saturn');toast('土星环面照片已保存 · 可在土星档案与舱内屏幕查看');
 }
 const navButtons=$$('[data-experience]');

 function renderMission(){
   const {step,flags,flightSeconds}=mission.state,current=expeditionSteps[step];
   $('#quest-count').textContent=`${Math.min(step,6)} / 6`;
   $('#quest-bar').style.width=(step/6*100)+'%';
   $('#quest-title').textContent=current?.title||'远征完成 · 群星已留下回信';
   $('#quest-description').textContent=current?.description||'全部六步任务已完成。你仍可自由飞行、漫游舱内，继续收集八大行星档案。';
   $('#quest-checks').innerHTML=current?current.checks.map(([key,label])=>`<li class="${flags[key]?'done':''}"><span>${flags[key]?'✓':'○'}</span>${label}${key==='jupiterFlight'&&!flags[key]?` <b>${Math.min(4,flightSeconds).toFixed(1)}s</b>`:''}</li>`).join(''):'<li class="done">✓ 获得「星海领航员」远征徽章</li>';
   $('#quest-route').innerHTML=expeditionSteps.map((s,i)=>`<li class="${i<step?'done':i===step?'current':''}"><span>${i<step?'✓':String(i+1).padStart(2,'0')}</span><div><strong>${s.title}</strong><small>${i<step?'已完成':i===step?'正在进行':'待解锁'}</small></div></li>`).join('');
   $('#quest-next').textContent=active==='interior'&&(step===0||step===5&&flags.docked)?'引导至导航指挥台 ↗':actionLabel();
 }
 function actionLabel(){const {step,flags}=mission.state;return step===0?'进入空间站 · 导航校准 ↗':step===1?'前往地球观测 ↗':step===2?(flags.mars?'打开火星档案 ↗':'前往火星调查 ↗'):step===3?'前往木星 · 驾驶与扫描 ↗':step===4?(flags.saturn?'进入土星环面摄影航线 ↗':'前往土星探测 ↗'):step===5?(flags.docked?'进入指挥区 · 交付数据 ↗':flags.returned?'对接泊位 01 ↗':'跃迁返航 ↗'):'打开行星档案展厅 ↗';}
 function event(type,id,dt=0){
   const before=mission.state.step,oldFlags=JSON.stringify(mission.state.flags),advanced=mission.event(type,id,dt);
   if(advanced){toast(mission.state.step===6?'远征完成 · 获得「星海领航员」徽章':`第 ${before+1} 步完成 · ${expeditionSteps[mission.state.step].title}`);$('#quest-card').classList.add('celebrate');setTimeout(()=>$('#quest-card').classList.remove('celebrate'),1500);}
   const second=Math.floor(mission.state.flightSeconds*10);
   if(advanced||oldFlags!==JSON.stringify(mission.state.flags)||type==='flight'&&second!==lastSaveSecond){renderMission();save('astra-expedition-v2',mission.state);lastSaveSecond=second;}
 }
 $('#quest-next').onclick=()=>{
   const {step,flags}=mission.state;
   if(step===0||step===5&&flags.docked){if(active==='interior')guide('bridge');else enter('interior');return;}
   if(step===6){enter('archive');return;}
   if(step===2&&flags.mars){enter('archive','mars');return;}
   if(step===4&&flags.saturn&&getContext().destination==='saturn'){close();startPhoto();return;}
   if(step===5&&flags.returned&&getContext().destination==='station'){close();startDock();return;}
   const id=step===1?'earth':step===2?'mars':step===3?'jupiter':step===4?'saturn':'station';close();navigate(id,true);
 };
 $('#quest-toggle').onclick=()=>{if(active==='archive'&&innerWidth<=800){$('#quest-log').onclick();return;}const collapsed=$('#quest-card').classList.toggle('collapsed');$('#quest-toggle').setAttribute('aria-expanded',String(!collapsed));};
 $('#quest-log').onclick=()=>{keys.clear();document.exitPointerLock?.();$('#quest-dialog').showModal();};
 $('#quest-close').onclick=()=>$('#quest-dialog').close();
 $('#quest-restart').onclick=()=>{$('#quest-reset-confirm').hidden=false;};
 $('#quest-reset-no').onclick=()=>{$('#quest-reset-confirm').hidden=true;};
 $('#quest-reset-yes').onclick=()=>{Object.assign(mission.state,{step:0,flags:{},flightSeconds:0,completedAt:null});save('astra-expedition-v2',mission.state);renderMission();$('#quest-reset-confirm').hidden=true;$('#quest-dialog').close();toast('六步远征已重新开始 · 行星扫描与档案记录仍保留');};

 const geo=new T.BoxGeometry(1,1,1);
 function block(parent,mat,x,y,z,w,h,d,rz=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.rotation.z=rz;parent.add(m);return m;}
 function sign(parent,text,x,y,z,w=2.4,h=.45,color='#a6eee4'){
   const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#0c202c';ctx.fillRect(0,0,1024,256);ctx.strokeStyle=color;ctx.lineWidth=4;ctx.strokeRect(10,10,1004,236);ctx.fillStyle=color;ctx.font='500 60px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,130,960);
   const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex}));m.position.set(x,y,z);parent.add(m);return m;
 }
 function makeInterior(){
   const world=new T.Scene();world.background=new T.Color(0x02060c);world.environment=environment;world.environmentIntensity=.25;
   world.add(new T.HemisphereLight(0xa2d7e6,0x243744,1.7));
   const key=new T.DirectionalLight(0xd8efff,1.9);key.position.set(-12,16,-30);world.add(key);
   const metal=new T.MeshStandardMaterial({color:0x71848b,metalness:.65,roughness:.38});
   const wall=new T.MeshStandardMaterial({color:0x293d49,metalness:.55,roughness:.5});
   const trim=new T.MeshStandardMaterial({color:0x11232d,metalness:.75,roughness:.3});
   const white=new T.MeshStandardMaterial({color:0xb3bfc0,metalness:.3,roughness:.4});
   const cyan=new T.MeshBasicMaterial({color:0x9aece2});const amber=new T.MeshBasicMaterial({color:0xf1bf82});
   const floorCanvas=document.createElement('canvas');floorCanvas.width=floorCanvas.height=256;const ctx=floorCanvas.getContext('2d');ctx.fillStyle='#41535d';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#1b2d38';ctx.lineWidth=5;ctx.strokeRect(3,3,250,250);ctx.fillStyle='#839198';for(const x of[12,244])for(const y of[12,244])ctx.fillRect(x-2,y-2,4,4);for(let i=24;i<236;i+=12){ctx.fillStyle='#3c4e58';ctx.fillRect(i,20,2,216);}
   const ft=new T.CanvasTexture(floorCanvas);ft.colorSpace=T.SRGBColorSpace;ft.wrapS=ft.wrapT=T.RepeatWrapping;ft.repeat.set(10,24);ft.anisotropy=4;
   const floorMat=new T.MeshStandardMaterial({map:ft,roughness:.42,metalness:.5});
   // Three connected rooms plus an axial passage. The collision footprint follows the door openings.
   block(world,floorMat,0,-.13,-5,18,.25,36);block(world,wall,0,4.9,-5,18,.2,36);
   for(let z=-8;z<=12;z+=3){
     for(const x of[-3,3]){
       if(z<0||z>3)block(world,wall,x,2.4,z,.22,4.8,2.92);
       block(world,metal,x,2.4,z-1.5,.22,4.8,.16);
       block(world,white,x*.83,4.2,z-1.5,1.1,.2,.16,x<0?-.7:.7);
       if(z<0||z>3){block(world,trim,x*.96,1.15,z,.09,.45,2.65);block(world,cyan,x*.95,.15,z,.045,.045,2.7);}
     }
     block(world,metal,0,4.55,z-1.5,4.8,.2,.16);block(world,cyan,0,4.45,z,1.9,.04,.14);
     for(const x of[-2.3,2.3])block(world,trim,x,4.65,z,.16,.15,2.94);
   }
   for(const x of[-8.1,8.1]){block(world,wall,x,2.45,-16,.24,4.9,14);block(world,cyan,x*.99,.2,-16,.04,.05,13);}
   for(const x of[-5.55,5.55])block(world,wall,x,2.45,-9,5.1,4.9,.22);
   for(const x of[-6,6]){block(world,wall,x,2.45,6,6,4.9,.22);block(world,wall,x,2.45,-3,6,4.9,.22);block(world,wall,x<0?-9:9,2.45,1.5,.22,4.9,9);}

   sign(world,'ODYSSEY  /  指挥区',0,3.9,-9,3.8,.5);
   for(const x of[-7.8,7.8]){
     for(let z=-21;z<-9;z+=4)block(world,metal,x,2.5,z,.28,5,.2);
     block(world,cyan,x,4.55,-16,.12,.05,13);
   }
   // Observation window with real 3D Earth outside, framing and guardrails.
   block(world,trim,0,.45,-23,16,.9,.5);block(world,trim,0,4.55,-23,16,.7,.5);
   for(const x of[-8,-4,4,8])block(world,metal,x,2.5,-23,.18,4.5,.42);
   const glass=new T.MeshPhysicalMaterial({color:0x98b6c0,transparent:true,opacity:.055,metalness:.1,roughness:.15,depthWrite:false});block(world,glass,0,2.5,-23,16,3.4,.04);
   for(const x of[-5.5,5.5]){block(world,metal,x,1,-21.9,4.2,.06,.06);for(const dx of[-1.9,1.9])block(world,metal,x+dx,.5,-21.9,.05,1,.05);}
   const earth=planets.get('earth').globe.clone();earth.scale.setScalar(.19);earth.position.set(5,-12,-78);world.add(earth);
   const points=[];for(let i=0;i<800;i++){const a=i*2.399963;points.push(Math.cos(a)*120,Math.sin(a*.7)*80,-100-(i%11)*8);}const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(points,3));world.add(new T.Points(sg,new T.PointsMaterial({color:0xa3bacf,size:.14})));
   // Command console, angled touchscreens, cabinets and navigation hologram.
   const consoleMat=new T.MeshStandardMaterial({color:0x182e3c,metalness:.7,roughness:.25});
   block(world,consoleMat,0,.6,-20.3,3.6,1.2,1.1);block(world,metal,0,1.23,-20.3,3.8,.12,1.3);

   for(const x of[-1.5,1.5])block(world,cyan,x,1.35,-19.8,.08,.05,.1);
   for(const x of[-5.2,5.2]){
     block(world,consoleMat,x,.6,-17.7,3.5,1.2,1.2);
     block(world,trim,x,.65,-15.9,.85,1.3,.85);block(world,metal,x,1.2,-15.5,.9,.12,.9);block(world,trim,x,1.65,-15.1,.9,.85,.12);
   }
   const holo=new T.Group();holo.position.set(1.4,2.05,-20.8);holo.scale.setScalar(.55);world.add(holo);holo.add(new T.Mesh(new T.SphereGeometry(.46,24,16),new T.MeshBasicMaterial({color:0x8ae4db,wireframe:true,transparent:true,opacity:.35})));
   const ring=new T.Mesh(new T.TorusGeometry(.7,.009,6,80),cyan);ring.rotation.x=1.1;holo.add(ring);
   // Research racks in the starboard alcove and sleeping pods to port.
   sign(world,'02  /  行星研究室',6,3.8,-2.83,4,.5);
   for(let x=3.8;x<8.5;x+=1.45){block(world,trim,x,1.4,-2.2,1.2,2.8,.7);for(let y=.4;y<2.9;y+=.6){block(world,metal,x,y,-1.81,1.05,.45,.05);block(world,cyan,x+.4,y,-1.77,.05,.2,.03);}}
   block(world,consoleMat,7.7,.65,1.5,1.3,1.3,2.5);
   sign(world,'03  /  生活舱',-6,3.8,-2.83,4,.5,'#e7caa6');

   const crew=sign(world,'CREW / 远征日志',-8.8,2,1.5,2,.6,'#e7caa6');crew.rotation.y=Math.PI/2;
   for(const [x,z]of[[0,6],[0,-4],[0,-17],[6,1.5],[-6,1.5]]){const l=new T.PointLight(x<0?0xffd7a3:0xb6e8f4,x===0?15:12,13,2);l.position.set(x,3.8,z);world.add(l);}
   const obstacles=[[-1.95,1.95,-21,-19.55],[-7.1,-3.3,-18.5,-17],[3.3,7.1,-18.5,-17],[-5.85,-4.55,-16.5,-14.85],[4.55,5.85,-16.5,-14.85],[6.85,8.5,.05,2.95],[3.2,8.7,-2.7,-1.65],[-8.95,-6.65,-2.05,.05],[-8.95,-6.65,2.75,4.85]];
   const terminals=[{id:'bridge',name:'导航指挥台',p:new T.Vector3(0,1.7,-20.3),stand:new T.Vector3(0,1.7,-18.2),yaw:0},{id:'lab',name:'行星档案终端',p:new T.Vector3(7.7,1.7,1.5),stand:new T.Vector3(5.8,1.7,1.5),yaw:-Math.PI/2},{id:'crew',name:'船员远征日志',p:new T.Vector3(-8,1.7,1.5),stand:new T.Vector3(-5.8,1.7,1.5),yaw:Math.PI/2},{id:'exit',name:'气闸 · 返回太空',p:new T.Vector3(0,1.7,12),stand:new T.Vector3(0,1.7,9.6),yaw:Math.PI}];
   return {world,holo,earth,obstacles,terminals,updateDeck:dressDeck(world,ship)};
 }
 function canWalk(x,z){
   const margin=.3;
   const inside=(Math.abs(x)<2.7&&z>-9.1&&z<12.3)||(Math.abs(x)<7.7&&z>-22.3&&z<-9)||(Math.abs(x)<8.6&&z>-.15&&z<2.15)||(Math.abs(x)>3.35&&Math.abs(x)<8.6&&z>-2.65&&z<5.65);
   return inside&&!interior.obstacles.some(([x1,x2,z1,z2])=>x>x1-margin&&x<x2+margin&&z>z1-margin&&z<z2+margin);
 }
 function guide(id){
   const terminal=interior.terminals.find(p=>p.id===id);if(!terminal)return;
   const path=[];
   if(Math.abs(walker.x)>2.5){if(walker.z<-9)path.push(new T.Vector3(0,1.7,walker.z));else{path.push(new T.Vector3(walker.x,1.7,1.5));path.push(new T.Vector3(0,1.7,1.5));}}
   if(id==='bridge'||id==='exit'){if(Math.abs(walker.x)>.15)path.push(new T.Vector3(0,1.7,walker.z));}
   else path.push(new T.Vector3(0,1.7,1.5));
   path.push(terminal.stand.clone());walkTarget={path,terminal};keys.clear();toast(`正在引导至${terminal.name} · 按移动键可接管`);
 }
 function interact(){
   if(active!=='interior')return;
   if(!nearest){toast('靠近发光终端后，按 E 或点击交互按钮');return;}
   if(nearest.id==='bridge'){
     if(mission.state.step===0){event('console');toast('导航校准完成 · 下一站：地球');}
     else if(mission.state.step===5){if(mission.state.flags.docked)event('console');else toast('请先返航并在泊位 01 完成对接');}
     else toast(mission.state.step===6?'远征档案已完整交付 · 欢迎回家':'导航系统在线 · 按任务指引继续远征');
   }else if(nearest.id==='lab')enter('archive','mars');
   else if(nearest.id==='crew'){document.exitPointerLock?.();$('#crew-dialog').showModal();keys.clear();}
   else close();
 }
 function enter(type,id){
   if(getContext().transitioning){toast('请等待跃迁完成后进入');return;}
   if(!active)returnCamera={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};
   keys.clear();document.exitPointerLock?.();active=type;
   document.body.classList.toggle('interior-view',type==='interior');document.body.classList.toggle('archive-view',type==='archive');
   document.body.classList.add('experience-view');$$('[data-mode]').forEach(b=>b.classList.remove('active'));navButtons.forEach(b=>b.classList.toggle('active',b.dataset.experience===type));
   $('#interior-ui').hidden=type!=='interior';$('#archive-ui').hidden=type!=='archive';
   if(type==='interior'){
     if(!interior)interior=makeInterior();if(id==='airlock'){walker.set(0,1.7,9.3);yaw=Math.PI;pitch=.04;walkTarget=null;}camera.clearViewOffset();camera.fov=68;camera.updateProjectionMatrix();
     camera.position.copy(walker);camera.rotation.set(pitch,yaw,0,'YXZ');toast('舱内漫游 · W A S D 行走，拖动环顾，E 操作终端');
   }else{camera.fov=42;camera.updateProjectionMatrix();showArchive(id||archiveId);}renderMission();
 }
 function close(){if(!active)return;active=null;keys.clear();walkTarget=null;document.exitPointerLock?.();document.body.classList.remove('experience-view','interior-view','archive-view');$('#interior-ui').hidden=true;$('#archive-ui').hidden=true;navButtons.forEach(b=>b.classList.remove('active'));camera.clearViewOffset();if(returnCamera){camera.position.copy(returnCamera.position);camera.quaternion.copy(returnCamera.quaternion);camera.fov=returnCamera.fov;camera.updateProjectionMatrix();}restoreUI();}
 function showArchive(id){
   if(!planets.has(id))id='earth';archiveId=id;const p=planets.get(id),f=facts[id];archiveTheta=.35;archivePhi=id==='saturn'?.75:1.3;archiveDistance=id==='saturn'?7.2:3.6;
   if(!archive){const world=new T.Scene();world.background=new T.Color(0x040c15);world.add(new T.AmbientLight(0xb6c8df,.38));const l=new T.DirectionalLight(0xffe5c6,3.7);l.position.set(-4,3,5);world.add(l);const rim=new T.DirectionalLight(0x5187aa,.3);rim.position.set(4,0,-3);world.add(rim);archive={world,model:null};}
   if(archive.model)archive.world.remove(archive.model);
   const model=new T.Group();for(const child of p.group.children){if(child.position.length()>p.r*.2)continue;model.add(child.clone(true));}model.scale.setScalar(1/p.r);archive.model=model;archive.world.add(model);
   if(id==='mars'){model.children.find(c=>c.geometry===p.globe.geometry).rotation.y=-.54;archiveTheta=.02;archivePhi=1.52;}
   observations.show(id);
   // Original maps and shader materials remain shared, so asynchronous texture loads also reach the exhibit.
   $('#archive-name').textContent=p.name;$('#archive-en').textContent=p.en;$('#archive-order').textContent=String([...planets.keys()].indexOf(id)+1).padStart(2,'0');$('#archive-type').textContent=f.type;
   $('#archive-facts').innerHTML=`<div><strong>${f.au}<small> AU</small></strong><span>距太阳平均距离</span></div><div><strong>${f.year}</strong><span>公转周期（地球时间）</span></div>`;
   $$('[data-archive]').forEach(b=>{b.classList.toggle('active',b.dataset.archive===id);b.setAttribute('aria-pressed',String(b.dataset.archive===id));});renderArchiveText();
 }
 function renderArchiveText(){
   const p=planets.get(archiveId),f=facts[archiveId],scanned=getContext().scanned.has(archiveId);
   $('#archive-copy').innerHTML=archiveTab==='overview'?`<h3>${f.feature}</h3><p>${f.text}</p>`:archiveTab==='detail'?`<h3>近距离观察</h3><p>${f.focus}</p>`:`<h3>你的探索记录</h3><p>星体扫描：${scanned?'已完成 ✓':'尚未完成，前往行星后按 E 扫描'}<br>档案记录：${records[archiveId]?'已收录 · '+new Date(records[archiveId]).toLocaleDateString('zh-CN'):'尚未收录'}</p>`;
   observations.show(archiveId);
   $('#archive-source').href=f.source;$('#archive-record').textContent=records[archiveId]?'再次确认档案 ✓':'记录这份行星档案 +';
   if(archiveId==='mars')$('#archive-record').textContent='辨认画面中心的地貌';
   $('#archive-status').textContent=`${scanned?'扫描完成':'待扫描'} / ${records[archiveId]?'档案已收录':'待收录'}`;
   $$('[data-archive-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.archiveTab===archiveTab);b.setAttribute('aria-selected',String(b.dataset.archiveTab===archiveTab));});
 }
 $('#archive-planets').innerHTML=[...planets.values()].map(p=>`<button data-archive="${p.id}" aria-label="查看${p.name}档案"><i style="--p1:${p.colors[0]};--p2:${p.colors[1]}" class="planet-icon"></i><span>${p.name}</span></button>`).join('');
 $$('[data-archive]').forEach(b=>b.onclick=()=>showArchive(b.dataset.archive));
 $$('[data-archive-tab]').forEach(b=>b.onclick=()=>{archiveTab=b.dataset.archiveTab;renderArchiveText();});
 $('#archive-record').onclick=()=>{if(archiveId==='mars'){const center=new T.Vector3().project(camera);observations.identify(archive.model,(center.x+1)*innerWidth/2,(1-center.y)*innerHeight/2);return;}records[archiveId]=new Date().toISOString();save('astra-archives-v1',records);event('archive',archiveId);renderArchiveText();toast(`${planets.get(archiveId).name}特写档案已收录`);};
 $('#archive-travel').onclick=()=>{const id=archiveId;close();navigate(id,true);};
 $('#archive-rotate').onclick=()=>{autoRotate=!autoRotate;$('#archive-rotate').textContent=autoRotate?'暂停自转':'继续自转';$('#archive-rotate').setAttribute('aria-pressed',String(autoRotate));};
 $('#archive-reset').onclick=()=>showArchive(archiveId);
 $('#archive-zoom-in').onclick=()=>zoom(-200);$('#archive-zoom-out').onclick=()=>zoom(200);
 navButtons.forEach(b=>b.onclick=()=>enter(b.dataset.experience));
 $$('[data-experience-exit]').forEach(b=>b.onclick=close);
 $$('[data-waypoint]').forEach(b=>b.onclick=()=>guide(b.dataset.waypoint));
 $('#interior-interact').onclick=interact;$('#crew-close').onclick=()=>$('#crew-dialog').close();
 $('#interior-look').onclick=async()=>{try{await renderer.domElement.requestPointerLock();}catch{toast('此窗口未启用鼠标锁定，拖动画面仍可环顾');}};
 document.addEventListener('pointerlockchange',()=>{$('#interior-look').textContent=document.pointerLockElement?'Esc 释放鼠标':'锁定鼠标环顾';});
 function look(dx,dy){if(active==='interior'){yaw-=dx*.003;pitch=T.MathUtils.clamp(pitch-dy*.0025,-1.3,1.3);}else if(active==='archive'){archiveTheta-=dx*.005;archivePhi=T.MathUtils.clamp(archivePhi-dy*.005,.15,Math.PI-.15);}}
 function zoom(delta){if(active==='archive')archiveDistance=T.MathUtils.clamp(archiveDistance*Math.exp(delta*.001),archiveId==='saturn'?2.8:1.35,9);}
 addEventListener('mousemove',e=>{if(active==='interior'&&document.pointerLockElement===renderer.domElement)look(e.movementX,e.movementY);});
 function update(dt,t){
   if(active==='archive'){
     if(archiveId==='mars'){observations.updateReference();look(((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*dt*200,((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*dt*160);}
     if(autoRotate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)archive.model.rotation.y+=dt*.055;
     const wide=innerWidth>800;camera.clearViewOffset();camera.setViewOffset(innerWidth,innerHeight,wide?innerWidth*.08:0,wide?0:innerHeight*.16,innerWidth,innerHeight);
     const distance=archiveDistance*(wide?1:1.65);
     camera.position.set(Math.sin(archiveTheta)*Math.sin(archivePhi)*distance,Math.cos(archivePhi)*distance,Math.cos(archiveTheta)*Math.sin(archivePhi)*distance);camera.lookAt(0,0,0);return;
   }
   if(active!=='interior')return;
   interior.updateDeck({time:t*.001,step:mission.state.step,docked:getContext().docked,destination:getContext().destination,photo:observations.photo});
   const paused=$$('dialog').some(d=>d.open);if(paused){keys.clear();return;}
   const forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),side=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
   if(forward||side)walkTarget=null;
   yaw+=((keys.has('ArrowLeft')?1:0)-(keys.has('ArrowRight')?1:0))*dt*1.3;pitch=T.MathUtils.clamp(pitch+((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*dt,-1.3,1.3);
   let dx=0,dz=0;
   if(walkTarget){target.copy(walkTarget.path[0]).sub(walker);target.y=0;if(target.length()<.08){walker.copy(walkTarget.path.shift());if(!walkTarget.path.length){yaw=walkTarget.terminal.yaw;pitch=0;walkTarget=null;}}else{direction.copy(target).normalize();const step=Math.min(dt*4,target.length());dx=direction.x*step;dz=direction.z*step;yaw=T.MathUtils.lerp(yaw,Math.atan2(-direction.x,-direction.z),Math.min(1,dt*5));pitch=T.MathUtils.damp(pitch,0,5,dt);}}
   else if(forward||side){direction.set(side,0,-forward).normalize().applyAxisAngle(new T.Vector3(0,1,0),yaw);const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?5:2.6;dx=direction.x*speed*dt;dz=direction.z*speed*dt;}
   if(canWalk(walker.x+dx,walker.z))walker.x+=dx;if(canWalk(walker.x,walker.z+dz))walker.z+=dz;
   camera.position.copy(walker);camera.rotation.set(pitch,yaw,0,'YXZ');interior.holo.rotation.y+=dt*.2;
   nearest=null;let distance=2.8;for(const terminal of interior.terminals){const d=walker.distanceTo(terminal.p);if(d<distance){nearest=terminal;distance=d;}}
   $('#interior-interact').disabled=!nearest;$('#interior-interact').textContent=nearest?`E · ${nearest.id==='bridge'?(mission.state.step===5?'交付远征数据':mission.state.step===0?'校准导航':'查看导航状态'):nearest.name}`:'靠近终端后交互';
   $('#interior-room').textContent=walker.z<-9?'01 / 指挥与观景区':walker.x>3?'02 / 行星研究室':walker.x<-3?'03 / 船员生活舱':'00 / 中央连接走廊';
   $('#interior-coords').textContent=`DECK 01 · X ${walker.x.toFixed(1)} / Z ${walker.z.toFixed(1)}`;
   $('#map-player').setAttribute('cx',String(50+walker.x*3.2));$('#map-player').setAttribute('cy',String(12+(walker.z+23)*2.6));
   stepTimer+=dt;
 }
 renderMission();
 return {enter,close,look,zoom,update,interact,event,recordPhoto,pick(x,y){if(active==='archive'&&archiveId==='mars')observations.identify(archive.model,x,y);},get active(){return active;},get scene(){return active==='interior'?interior.world:archive?.world;},isModal:()=>$$('dialog').some(d=>d.open),state:()=>({view:active,mission:JSON.parse(JSON.stringify(mission.state)),archiveId,recorded:Object.keys(records),walker:walker.toArray()})};
}
