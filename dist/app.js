import * as T from './vendor/three.module.js';
import {buildStation,buildShip,setupLighting,upgradePlanets,createPostFX} from './visuals.js';
import {detailCraft,detailStation} from './craft-detail.js';
import {installPlanetOptics} from './planet-optics.js';
import {createManeuvers} from './maneuvers.js';
import {createExperience} from './experience.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const icons = {
  'volume-off':'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>',
  volume:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01"/>',
  rocket:'<path d="M13 4c3-2 6-1 7-1 0 1 1 4-1 7l-7 7-5-5 6-8Z"/><path d="m7 12-4 1 1-5 7-2m1 11-1 4 5-1 2-7M6 16l-3 5 5-3"/><circle cx="15" cy="8" r="1.5"/>',
  orbit:'<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-35 12 12)"/><path d="M7 4a9 9 0 0 1 14 10M3 10a9 9 0 0 0 14 10"/>',
  reset:'<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7"/>',
  scan:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 12h18"/><circle cx="12" cy="12" r="4"/>',
  mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>'
};
function setIcon(el, name) { el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.orbit}</svg>`; }
$$('[data-icon]').forEach(el => setIcon(el, el.dataset.icon));
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3600); }

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scene = new T.Scene(); scene.background = new T.Color('#030710');
const camera = new T.PerspectiveCamera(46, innerWidth / innerHeight, .1, 30000);
let renderer;
try {
  renderer = new T.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  $('#viewport').appendChild(renderer.domElement);
} catch (e) { $('#load-text').textContent = '当前设备无法启动 WebGL，请开启浏览器硬件加速后刷新。'; throw e; }
const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
scene.add(new T.AmbientLight(0x6d95bc, 1.2));
const sunlight = new T.DirectionalLight(0xffe9cf, 3.6); sunlight.position.set(-180, 160, 100); scene.add(sunlight);
const rimLight = new T.DirectionalLight(0x38bde4, 2.2); rimLight.position.set(80, -20, -100); scene.add(rimLight);
const fill = new T.DirectionalLight(0x98c4e8, 1.1); fill.position.set(30, 80, 200); scene.add(fill);

// Deterministic geometry and procedural planetary materials keep the scene self-contained.
let seed = 8123;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const boxGeo = new T.BoxGeometry(1, 1, 1);
const metal = new T.MeshStandardMaterial({color:0x74838b,metalness:.75,roughness:.48});
const pale = new T.MeshStandardMaterial({color:0xb1bdbe,metalness:.6,roughness:.42});
const dark = new T.MeshStandardMaterial({color:0x14232c,metalness:.8,roughness:.46});
const panelMat = new T.MeshStandardMaterial({color:0x0b3449,metalness:.8,roughness:.33,emissive:0x082334,emissiveIntensity:.3});
const glowMat = new T.MeshBasicMaterial({color:0x91f2f0});
const warmMat = new T.MeshBasicMaterial({color:0xffd39c});
function mesh(geo,mat,parent,pos=[0,0,0],rot=[0,0,0]) { const m = new T.Mesh(geo,mat); m.position.set(...pos); m.rotation.set(...rot); parent.add(m); return m; }
function box(parent,mat,pos,size,rot) {const m = mesh(boxGeo,mat,parent,pos,rot);m.scale.set(...size);return m;}
function cylinder(parent,mat,r1,r2,h,pos,rot,segments=32){return mesh(new T.CylinderGeometry(r1,r2,h,segments),mat,parent,pos,rot);}
function torus(parent,mat,r,t,pos=[0,0,0],rot=[Math.PI/2,0,0],radial=8,tubular=128){return mesh(new T.TorusGeometry(r,t,radial,tubular),mat,parent,pos,rot);}
const dummy = new T.Object3D();
function instances(parent,mat,items){const m=new T.InstancedMesh(boxGeo,mat,items.length);items.forEach((d,i)=>{dummy.position.set(...d.p);dummy.rotation.set(...(d.r||[0,0,0]));dummy.scale.set(...d.s);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.instanceMatrix.needsUpdate=true;parent.add(m);return m;}
function glowTexture(color='130,207,255') {const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,`rgba(${color},1)`);g.addColorStop(.12,`rgba(${color},.6)`);g.addColorStop(.4,`rgba(${color},.12)`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new T.CanvasTexture(c);}
const glowTex=glowTexture();
function sprite(parent,size,pos,tex=glowTex,opacity=.6){const s=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false}));s.position.set(...pos);s.scale.set(size,size,1);parent.add(s);return s;}

const sky=new T.Group();scene.add(sky);
const starPositions=[],starColors=[];
for(let i=0;i<6500;i++){const a=rnd()*Math.PI*2,z=rnd()*2-1,r=8500+rnd()*2000,s=Math.sqrt(1-z*z);starPositions.push(Math.cos(a)*s*r,z*r,Math.sin(a)*s*r);const c=new T.Color().setHSL(.53+rnd()*.13,.12+rnd()*.4,.35+rnd()*.6);starColors.push(c.r,c.g,c.b);}
const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(starPositions,3));starGeo.setAttribute('color',new T.Float32BufferAttribute(starColors,3));
sky.add(new T.Points(starGeo,new T.PointsMaterial({size:1.8,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.88,depthWrite:false})));
// A fine, slanted Milky Way band with real parallax-free depth.
const bandPos=[],bandCol=[];
for(let i=0;i<11000;i++){const a=rnd()*Math.PI*2,y=(rnd()+rnd()+rnd()-1.5)*850;const x=Math.cos(a)*9600,z=Math.sin(a)*9600;bandPos.push(x,y+x*.48,z);const k=.16+rnd()*.45;bandCol.push(k*.6,k*.78,k);}
const bandGeo=new T.BufferGeometry();bandGeo.setAttribute('position',new T.Float32BufferAttribute(bandPos,3));bandGeo.setAttribute('color',new T.Float32BufferAttribute(bandCol,3));sky.add(new T.Points(bandGeo,new T.PointsMaterial({size:1,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.58,depthWrite:false})));
const nebulaTex=glowTexture('28,80,119');
for(let i=0;i<10;i++){const a=i*.7;const s=sprite(sky,4200+rnd()*2500,[Math.cos(a)*7500,Math.cos(a)*3000,Math.sin(a)*7500],nebulaTex,.09);s.material.rotation=a;}
for(let i=0;i<14;i++){const a=rnd()*Math.PI*2;const z=rnd()*2-1;const rr=Math.sqrt(1-z*z);sprite(sky,28+rnd()*38,[Math.cos(a)*rr*7800,z*7800,Math.sin(a)*rr*7800],glowTex,.6);}

// Odyssey is eight independently transformable mesh assemblies.
const station = new T.Group();station.rotation.set(.04,.22,-.18);scene.add(station);
const moduleData=[
  ['core','中央指挥塔','COMMAND','空间站的指挥与导航中心。多层观测穹顶与对接轴共同维持整站运行。',[0,22,0]],
  ['habitat','环形生态舱','HABITAT','双层环形居住结构。持续旋转的生态舱模拟重力，为远征者提供栖息地。',[0,-14,0]],
  ['spokes','径向连接桥','TRANSIT','八条径向廊桥连接中心与生态环，承载人员转运、物资与生命支持管线。',[0,4,0]],
  ['solar','太阳能阵列','SOLAR','四组可展开光伏翼阵，为轨道城市输送稳定能源。',[0,0,22]],
  ['dock','星际停泊港','DOCKING','面向深空航行器的泊位。青蓝色导航灯指引探索者返航。',[0,0,-24]],
  ['reactor','聚变能源核心','REACTOR','纵轴底部的聚变反应结构，以磁约束环与辐射散热叶片构成。',[0,-26,0]],
  ['labs','深空实验舱','RESEARCH','独立科学实验与观测舱，可在轨道上进行长期深空研究。',[20,6,0]],
  ['comms','通信观测阵列','COMMS','多向高增益天线与深空观测装置，连接人类遥远的航迹。',[-16,22,0]]
];
const modules = new Map();
for(const [id,name,code,description,offset] of moduleData){const group=new T.Group();group.userData.moduleId=id;station.add(group);modules.set(id,{group,name,code,description,offset:new T.Vector3(...offset),base:new T.Vector3(),detached:false});}
buildStation(station,modules);
const portDetail=detailStation(station,modules);
const rotatingRing=new T.Group();station.add(rotatingRing);

const planetsData=[
  {id:'mercury',name:'水星',en:'MERCURY',r:24,p:[-920,90,-1500],colors:['#bdb7a9','#6e665b'],type:'rock',info:'太阳最近的岩石世界。古老陨石坑记录着太阳系的漫长历史。'},
  {id:'venus',name:'金星',en:'VENUS',r:48,p:[-520,-55,-1020],colors:['#ead3a1','#96774d'],type:'cloud',info:'金色云海覆盖的世界。驾驶飞船沿浓密大气层的边缘掠过。'},
  {id:'earth',name:'地球',en:'EARTH',r:125,p:[80,-105,-310],colors:['#67bed0','#1e487a'],type:'earth',info:'人类的蓝色故乡。海洋、云层与大气辉光，在深空中格外明亮。'},
  {id:'mars',name:'火星',en:'MARS',r:58,p:[850,80,-1250],colors:['#d48759','#7d3e2a'],type:'rock',info:'铁锈色的荒野，等待远征者的足迹。下一段人类航程从这里开始。'},
  {id:'jupiter',name:'木星',en:'JUPITER',r:220,p:[1700,-80,-2450],colors:['#d8b494','#877566'],type:'gas',info:'庞大的气态巨行星。跨越云带，观察持续涌动的巨大风暴。'},
  {id:'saturn',name:'土星',en:'SATURN',r:170,p:[-1200,60,-3400],colors:['#e6d1a3','#a28b69'],type:'gas',info:'被冰晶与碎石光环环绕的世界。穿越光环之外的宁静空间。'},
  {id:'uranus',name:'天王星',en:'URANUS',r:105,p:[1800,230,-4700],colors:['#a6e1df','#4d9aab'],type:'ice',info:'遥远的青色冰巨星。稀薄的阳光照亮这片宁静的边疆。'},
  {id:'neptune',name:'海王星',en:'NEPTUNE',r:102,p:[-1300,-100,-5800],colors:['#5e8fe7','#253d97'],type:'gas',info:'太阳系深处的蓝色世界。沿着深蓝云层，航向未知的星海。'}
];
function planetTexture(d){const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');const im=ctx.createImageData(c.width,c.height),c1=new T.Color(d.colors[0]),c2=new T.Color(d.colors[1]);for(let y=0;y<512;y++){const lat=y/512*Math.PI;for(let x=0;x<1024;x++){const lon=x/1024*Math.PI*2;const noise=Math.sin(lon*13+Math.cos(lat*19))*Math.sin(lat*23+Math.cos(lon*7))*.12+Math.sin(lon*47+lat*83)*.04;let n=d.type==='gas'? .5+Math.sin(lat*46+Math.sin(lon*5)*.3)*.2+Math.sin(lat*107)*.08+noise*.5:d.type==='ice'?.35+Math.sin(lat*20)*.04+noise*.1:.5+Math.sin(lon*5+Math.sin(lat*13))*Math.cos(lat*11+Math.sin(lon*8))*.25+noise;const storm=Math.exp(-(((x/1024-.65)/.075)**2+((y/512-.62)/.03)**2));if(d.id==='jupiter')n+=storm*.4;const col=c1.clone().lerp(c2,T.MathUtils.clamp(n,0,1));const idx=(y*1024+x)*4;im.data[idx]=col.r*255;im.data[idx+1]=col.g*255;im.data[idx+2]=col.b*255;im.data[idx+3]=255;}}ctx.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=maxAnisotropy;return t;}
function atmosphere(parent,r,color,intensity=.7){const mat=new T.ShaderMaterial({uniforms:{color:{value:new T.Color(color)},intensity:{value:intensity}},vertexShader:'varying vec3 vN; varying vec3 vP; void main(){vN=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);vP=p.xyz;gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 vN; varying vec3 vP;uniform vec3 color;uniform float intensity;void main(){float rim=pow(1.0-abs(dot(normalize(vN),normalize(-vP))),3.5);gl_FragColor=vec4(color,rim*intensity);}',transparent:true,blending:T.AdditiveBlending,depthWrite:false});return mesh(new T.SphereGeometry(r*1.035,64,32),mat,parent);}
const planets=new Map();const loader=new T.TextureLoader();let texturesLoaded=0;
for(const d of planetsData){const group=new T.Group();group.position.set(...d.p);scene.add(group);const texture=null;const mat=new T.MeshStandardMaterial({map:texture,roughness:1,metalness:0});const globe=mesh(new T.SphereGeometry(d.r,80,48),mat,group);globe.rotation.z=d.id==='uranus'?1.55:.12;globe.rotation.y=1.6;
  const atmo=atmosphere(group,d.r,d.id==='mars'?0xe39769:d.id==='earth'?0x319df2:d.colors[0],d.id==='earth'?.9:.22);
  if(d.id==='earth'){loader.load('./assets/real/clouds.jpg',tex=>{const clouds=mesh(new T.SphereGeometry(d.r*1.003,96,64),new T.MeshStandardMaterial({color:0xffffff,alphaMap:tex,transparent:true,opacity:.83,roughness:1,depthWrite:false}),group);clouds.rotation.y=1.6;d.clouds=clouds;},undefined,()=>{});
    const moon=mesh(new T.SphereGeometry(18,40,24),new T.MeshStandardMaterial({color:0xb9bfc0,roughness:1}),group,[-210,80,-100]);loader.load('./assets/moon.jpg',t=>{t.colorSpace=T.SRGBColorSpace;moon.material.map=t;moon.material.needsUpdate=true;},undefined,()=>{});
  }
  if(d.id==='saturn'){const rg=new T.RingGeometry(d.r*1.3,d.r*2.2,128,12);const colors=[];for(let i=0;i<rg.attributes.position.count;i++){const v=new T.Vector3().fromBufferAttribute(rg.attributes.position,i);const r=v.length()/d.r;const k=.35+Math.sin(r*170)*.13+Math.sin(r*350)*.1;colors.push(k*1.15,k*1.03,k*.8);}rg.setAttribute('color',new T.Float32BufferAttribute(colors,3));const ring=mesh(rg,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,transparent:true,opacity:.85,roughness:1}),group,[0,0,0],[1.2,.15,.1]);d.ring=ring;}
  planets.set(d.id,{...d,group,globe,atmo});
}
const sunGroup=new T.Group();sunGroup.position.set(-1700,600,-2500);scene.add(sunGroup);mesh(new T.SphereGeometry(150,48,32),new T.MeshBasicMaterial({color:0xffe9ba}),sunGroup);const sunTex=glowTexture('255,210,144');sprite(sunGroup,1700,[0,0,0],sunTex,.65);sprite(sunGroup,550,[0,0,0],sunTex,1);
// Subtle orbit guides become visible in the system overview.
const orbits=new T.Group();orbits.visible=false;scene.add(orbits);
planetsData.forEach((d,i)=>{const points=[];for(let j=0;j<=192;j++){const a=j/192*Math.PI*2;points.push(new T.Vector3(Math.cos(a)*(650+i*430),-70,Math.sin(a)*(650+i*430)-2300));}const geo=new T.BufferGeometry().setFromPoints(points);orbits.add(new T.Line(geo,new T.LineBasicMaterial({color:0x567c93,transparent:true,opacity:.13})));});

// Third-person craft: a compact, readable explorer with twin visible thrusters.
const ship = new T.Group();scene.add(ship);ship.visible=false;
const thrusters=buildShip(ship);
const craftDetail=detailCraft(ship);
setupLighting(scene,renderer,sunlight,rimLight,fill);
upgradePlanets(planets,loader,sunGroup,sky);
const updateOptics=installPlanetOptics(planets);
const postFX=createPostFX(renderer);
const scanRing = torus(scene,new T.MeshBasicMaterial({color:0xa0fff0,transparent:true,opacity:0}),1,.02,[0,0,0],[0,0,0]);

let mode='station',destination='station',selectedModule=null,explodeTarget=0,explodeCurrent=0,flightSpeed=0,shipYaw=0,shipPitch=0;
const keys=new Set();let scanned=new Set();try{scanned=new Set(JSON.parse(localStorage.getItem('astra-survey-v1')||'[]').filter(id=>planets.has(id)));}catch{}
let orbitTarget=new T.Vector3(-18,-12,0),orbitRadius=235,orbitTheta=.56,orbitPhi=.98;
let transition=null,scanStart=0,scanObject=null,cinematic=false;
const tempV=new T.Vector3(),tempV2=new T.Vector3(),collisionV=new T.Vector3(),up=new T.Vector3(0,1,0);
const initialTarget=orbitTarget.clone();
function updateOrbitCamera(){camera.position.set(orbitTarget.x+orbitRadius*Math.sin(orbitPhi)*Math.sin(orbitTheta),orbitTarget.y+orbitRadius*Math.cos(orbitPhi),orbitTarget.z+orbitRadius*Math.sin(orbitPhi)*Math.cos(orbitTheta));camera.lookAt(orbitTarget);}
updateOrbitCamera();
function updateProgress(){$('#progress').innerHTML=`${scanned.size}<span>/8</span>`;$$('.destination').forEach(b=>b.classList.toggle('scanned',scanned.has(b.dataset.dest)));}
const dests=[{id:'station',name:'空间站',colors:['#bad5db','#526a79']},...planetsData];
$('#destinations').innerHTML=dests.map(d=>`<button class="destination ${d.id==='station'?'active':''}" data-dest="${d.id}" title="跃迁至${d.name}"><i class="planet-icon" style="--p1:${d.colors[0]};--p2:${d.colors[1]}"></i><span>${d.name}</span></button>`).join('');
$('#module-list').innerHTML=moduleData.map(([id,name,code])=>`<button class="module-button" data-module="${id}"><i></i>${name}<span>${code.slice(0,3)}</span></button>`).join('');
updateProgress();
const maneuvers=createManeuvers({ship,camera,port:modules.get('dock').group,saturn:planets.get('saturn'),keys,toast,
  onDock:()=>{experience.event('dock','station');},onBoard:()=>experience.enter('interior','airlock'),
  onPhoto:data=>experience.recordPhoto(data),onRelease:()=>{const angles=new T.Euler().setFromQuaternion(ship.quaternion,'YXZ');shipYaw=angles.y;shipPitch=angles.x;flightSpeed=0;}
});
function startDock(){if(transition||destination!=='station')return;experience.close();if(mode!=='flight')switchMode('flight');flightSpeed=0;setExplode(0);modules.get('dock').detached=false;maneuvers.approach();}
function startPhoto(){if(transition||destination!=='saturn')return;experience.close();if(mode!=='flight')switchMode('flight');flightSpeed=0;maneuvers.survey();}
$('#start-dock').onclick=startDock;$('#start-photo').onclick=startPhoto;
const experience=createExperience({camera,renderer,planets,ship,keys,toast,startPhoto,startDock,environment:scene.environment,getContext:()=>({mode,destination,scanned,docked:maneuvers.docked,transitioning:!!transition}),navigate:(id,flight)=>{if(flight&&mode!=='flight')switchMode('flight');travel(id);},restoreUI:()=>{syncMode();if(mode!=='flight')updateOrbitCamera();}});
function syncMode(){$('#start-dock').hidden=destination!=='station'||mode==='solar';$('#start-photo').hidden=destination!=='saturn'||mode==='solar';document.body.classList.toggle('flight',mode==='flight');document.body.classList.toggle('solar',mode==='solar');$$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('#station-panel').classList.toggle('hidden',mode!=='station'||destination!=='station');$('#reticle').classList.toggle('hidden',mode!=='flight');$('#telemetry').classList.toggle('hidden',mode!=='flight');$('#scan').classList.toggle('hidden',destination==='station');ship.visible=mode==='flight';orbits.visible=mode==='solar';$('#target-marker').classList.toggle('hidden',mode!=='station'||destination!=='station');$('#launch').innerHTML=mode==='flight'?'<span>切换至轨道观察</span><span class="button-arrow">↗</span>':'<span>'+icons.rocket.replace(/^/,'<svg viewBox="0 0 24 24">')+'</svg></span><span>启航 · 自由探索</span><span class="button-arrow">↗</span>';
$('#view-hint').innerHTML=mode==='flight'?'<span>W S 推进</span><b>·</b><span>A D 转向</span><b>·</b><span>↑ ↓ 俯仰</span><b>·</b><span>Shift 加速</span>':'<span>拖动旋转</span><b>·</b><span>滚轮缩放</span><b>·</b><span>点击模块查看</span>';
}
function showDestination(id){destination=id;$$('.destination').forEach(b=>b.classList.toggle('active',b.dataset.dest===id));const d=planets.get(id);document.body.classList.toggle('planet-view',!!d);$('#location-name').textContent=d?`${d.name}近地空间 · 探索航线`:'地球轨道 · 奥德赛空间站';$('#mission-title').textContent=d?`${d.name} · ${d.en}`:'欢迎来到奥德赛';$('#mission-description').innerHTML=d?d.info:'一座漂浮于群星之间的城市。<br>拖动画面，发现它的每一面。';$('#stat-main').textContent=d?String(planetsData.findIndex(p=>p.id===id)+1).padStart(2,'0'):'08';$('#stat-label').textContent=d?'太阳系行星序列':'独立功能模块';$('#mission-status').textContent=d?(scanned.has(id)?'已记录星体数据':'接近星体，按 E 扫描'):'探索者号已就绪';$('#sector').textContent=d?d.en+' SECTOR':'SOL SYSTEM';$('#sector-sub').textContent=d?'深空航线 / EXPLORATION':'地球近地轨道 / SECTOR 03';syncMode();}
function switchMode(next){if(transition)return;experience.close();maneuvers.cancel();if(next===mode){syncMode();return;}mode=next;flightSpeed=0;keys.clear();if(next==='solar'){transition={start:performance.now(),duration:reducedMotion?1:1800,from:camera.position.clone(),to:new T.Vector3(1200,2900,3700),targetFrom:orbitTarget.clone(),targetTo:new T.Vector3(0,0,-2350),kind:'orbit'};$('#mission-title').textContent='太阳系 · 八大行星';$('#mission-description').textContent='选择一颗星球，开启下一段远征。';$('#stat-main').textContent='08';$('#stat-label').textContent='可探索行星';toast('选择底部目的地，跃迁至行星附近');}else if(next==='flight'){const d=planets.get(destination);if(d){ship.position.copy(d.group.position).add(new T.Vector3(0,d.r*.15,d.r*2.4));shipYaw=0;shipPitch=0;}else{ship.position.set(0,16,100);shipYaw=0;shipPitch=0;}ship.rotation.set(0,shipYaw,0);toast('探索者号已启动 · W 前进，A/D 转向，Shift 加速');showDestination(destination);}else{showDestination(destination);const d=planets.get(destination);orbitTarget.copy(d?d.group.position:initialTarget);orbitRadius=d?d.r*3.3:235;orbitTheta=.56;orbitPhi=d?1.35:.98;updateOrbitCamera();}syncMode();}
function travel(id){experience.close();if(transition){toast('跃迁进行中，请稍候');return;}maneuvers.cancel();const d=planets.get(id);if(mode==='solar')mode='station';showDestination(id);const target=d?d.group.position.clone():initialTarget.clone();let end;if(mode==='flight'){const r=d?d.r:45;end=target.clone().add(new T.Vector3(0,r*.3,r*2.6));}else{const r=d?d.r*3.3:235;end=target.clone().add(new T.Vector3(Math.sin(.56)*r*.95,r*.28,Math.cos(.56)*r*.95));}
transition={start:performance.now(),duration:reducedMotion?1:2200,from:(mode==='flight'?ship.position:camera.position).clone(),to:end,targetFrom:orbitTarget.clone(),targetTo:target,kind:mode==='flight'?'flight':'orbit'};flightSpeed=0;keys.clear();$('#warp-name').textContent=d?d.en:'ODYSSEY STATION';$('#warp').classList.add('active');setTimeout(()=>$('#warp').classList.remove('active'),reducedMotion?1:1600);if(audioOn)playWarp();}
$$('[data-mode]').forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));$$('[data-dest]').forEach(b=>b.onclick=()=>travel(b.dataset.dest));$('#launch').onclick=()=>switchMode(mode==='flight'?'station':'flight');$('.brand').onclick=e=>{e.preventDefault();if(mode!=='station')switchMode('station');travel('station');};
function setExplode(value){explodeTarget=T.MathUtils.clamp(value,0,1);$('#explode-range').value=Math.round(explodeTarget*100);$('#explode').setAttribute('aria-checked',String(explodeTarget>.01));$('#structure-percent').textContent=Math.round(explodeTarget*100)+'%';$('#structure-state').textContent=explodeTarget>.01?'模块分离':'整体组装';}
$('#explode').onclick=()=>{setExplode(explodeTarget>.01?0:1);toast(explodeTarget?'结构展开 · 点击任意模块可独立分离或复原':'空间站结构正在复原');};$('#explode-range').oninput=e=>setExplode(e.target.value/100);
const inspected=new Set();
function selectModule(id){const m=modules.get(id);if(!m)return;selectedModule=id;m.detached=!m.detached;inspected.add(id);$$('[data-module]').forEach(b=>{const is=b.dataset.module===id;b.classList.toggle('active',is);b.setAttribute('aria-pressed',String(is));});$('#mission-title').textContent=m.name;$('#mission-description').textContent=m.description;$('#mission-status').textContent=`已检查 ${inspected.size}/8 个模块 · 再次点击${m.detached?'复原':'分离'}`;$('#target-title').textContent=m.name;toast(`${m.name} · ${m.detached?'独立分离':'复原归位'}`);}
$$('[data-module]').forEach(b=>b.onclick=()=>selectModule(b.dataset.module));
$('#reset-camera').onclick=()=>{setExplode(0);modules.forEach(m=>m.detached=false);selectedModule=null;$$('[data-module]').forEach(b=>b.classList.remove('active'));orbitTarget.copy(initialTarget);orbitRadius=235;orbitTheta=.56;orbitPhi=.98;showDestination('station');$('#target-title').textContent='奥德赛空间站';updateOrbitCamera();toast('观察视角与空间站结构已复原');};
function scan(){if(transition)return;const d=planets.get(destination);if(!d){toast('先选择一颗行星，跃迁后即可扫描');return;}const distance=(mode==='flight'?ship.position:camera.position).distanceTo(d.group.position);if(distance>d.r*8){toast('距离过远 · 请靠近行星，或通过导航重新跃迁');return;}experience.event('scan',d.id);if(scanned.has(d.id)){toast(`${d.name}的探索数据已记录`);return;}scanned.add(d.id);try{localStorage.setItem('astra-survey-v1',JSON.stringify([...scanned]));}catch{}updateProgress();$('#mission-status').textContent='扫描完成 · 已记录星体数据';scanStart=performance.now();scanObject=d;scanRing.position.copy(d.group.position);scanRing.lookAt(camera.position);toast(scanned.size===8?'远征完成 · 八大行星数据已全部收集！':`扫描完成 · ${d.name}数据已归档 (${scanned.size}/8)`);if(audioOn)playBeep();}
$('#scan').onclick=scan;
const raycaster=new T.Raycaster(),pointer=new T.Vector2();let dragging=false,lastX=0,lastY=0,dragDistance=0;
const canvas=renderer.domElement;
canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;dragDistance=0;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;dragDistance+=Math.abs(dx)+Math.abs(dy);lastX=e.clientX;lastY=e.clientY;if(transition)return;if(experience.active){if(!document.pointerLockElement)experience.look(dx,dy);return;}if(maneuvers.mode){maneuvers.moveView(dx,dy);return;}if(mode==='flight'){shipYaw-=dx*.004;shipPitch=T.MathUtils.clamp(shipPitch-dy*.003,-1.3,1.3);}else{orbitTheta-=dx*.004;orbitPhi=T.MathUtils.clamp(orbitPhi-dy*.004,.12,Math.PI-.12);}});
canvas.addEventListener('pointerup',e=>{dragging=false;if(experience.active){if(dragDistance<5)experience.pick(e.clientX,e.clientY);return;}if(dragDistance>5||mode!=='station'||destination!=='station'||transition)return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObject(station,true);if(hits.length){let obj=hits[0].object;while(obj&&!obj.userData.moduleId)obj=obj.parent;if(obj)selectModule(obj.userData.moduleId);}});
canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(experience.active){experience.zoom(e.deltaY);return;}if(mode==='flight'||transition)return;const d=planets.get(destination);orbitRadius=T.MathUtils.clamp(orbitRadius*Math.exp(e.deltaY*.001),mode==='solar'?700:d?d.r*1.18:65,mode==='solar'?15000:d?d.r*8:600);},{passive:false});
addEventListener('keydown',e=>{if(experience.isModal())return;if(e.target.closest('input,textarea,select'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='KeyE'){if(experience.active)experience.interact();else if(maneuvers.mode)maneuvers.interact();else scan();}if(e.code==='KeyH'){cinematic=!cinematic;document.body.classList.toggle('cinematic',cinematic);toast(cinematic?'电影模式 · 按 H 恢复界面':'界面已恢复');}if(e.code==='Escape'&&cinematic){cinematic=false;document.body.classList.remove('cinematic');}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();dragging=false;});
$$('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(b.dataset.key);b.setPointerCapture(e.pointerId);});for(const evt of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(evt,()=>keys.delete(b.dataset.key));});
const helpDialog=$('#help-dialog');$('#help').onclick=()=>{keys.clear();helpDialog.showModal();};$('.dialog-close').onclick=$('#help-done').onclick=()=>helpDialog.close();helpDialog.addEventListener('click',e=>{if(e.target===helpDialog){const r=helpDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)helpDialog.close();}});
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前预览窗口不支持全屏，可在独立浏览器打开');}};
let audioCtx,audioOn=false,audioGain,oscillators=[];
$('#sound').onclick=async()=>{try{if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();audioGain=audioCtx.createGain();audioGain.gain.value=0;audioGain.connect(audioCtx.destination);for(const f of [44,65.4,98]){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=f;g.gain.value=.055;o.connect(g);g.connect(audioGain);o.start();oscillators.push(o);}}await audioCtx.resume();audioOn=!audioOn;audioGain.gain.setTargetAtTime(audioOn?.28:0,audioCtx.currentTime,.5);setIcon($('#sound'),audioOn?'volume':'volume-off');$('#sound').title=audioOn?'关闭环境音':'开启环境音';$('#sound').setAttribute('aria-label',$('#sound').title);toast(audioOn?'深空环境音已开启':'环境音已关闭');}catch{toast('当前设备无法开启环境音');}};
function playBeep(){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.setValueAtTime(440,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(880,audioCtx.currentTime+.2);g.gain.setValueAtTime(.04,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.6);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.6);}
function playWarp(){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(60,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(600,audioCtx.currentTime+1);g.gain.setValueAtTime(.001,audioCtx.currentTime);g.gain.linearRampToValueAtTime(.08,audioCtx.currentTime+.5);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+1.5);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+1.5);}
function enforceCollision(){for(const p of planets.values()){const delta=collisionV.copy(ship.position).sub(p.group.position),min=p.r*1.075+(p.id==='saturn'?8:0);if(delta.length()<min){if(delta.lengthSq()<.001)delta.set(0,0,1);ship.position.copy(p.group.position).add(delta.setLength(min));flightSpeed*=.25;$('#flight-status').textContent='近地防撞系统';}}if(ship.position.length()<58&&Math.abs(ship.position.y)<40){collisionV.copy(ship.position).setLength(59);ship.position.copy(collisionV);flightSpeed*=.5;}}
function fly(dt,t){const paused=experience.isModal();const boost=!paused&&(keys.has('ShiftLeft')||keys.has('ShiftRight'));const thrust=!paused?Number(keys.has('KeyW'))-Number(keys.has('KeyS')):0;const max=boost?950:180;flightSpeed=T.MathUtils.damp(flightSpeed,thrust*max,thrust?1.5:2.2,dt);if(!paused){shipYaw+=((keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0))*dt*.8;shipPitch=T.MathUtils.clamp(shipPitch+((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*dt*.65,-1.3,1.3);ship.position.y+=((keys.has('Space')?1:0)-(keys.has('KeyC')?1:0))*dt*(boost?300:65);}
ship.rotation.order='YXZ';ship.rotation.y=shipYaw;ship.rotation.x=shipPitch;ship.rotation.z=T.MathUtils.damp(ship.rotation.z,(!paused&&keys.has('KeyA')?.2:!paused&&keys.has('KeyD')?-.2:0),3,dt);const forward=tempV.set(0,0,-1).applyQuaternion(ship.quaternion);ship.position.addScaledVector(forward,flightSpeed*dt);enforceCollision();const desired=tempV2.set(0,8,32).applyQuaternion(ship.quaternion).add(ship.position);camera.position.lerp(desired,1-Math.exp(-dt*4));const look=ship.position.clone().addScaledVector(forward,18);camera.lookAt(look);orbitTarget.copy(ship.position);thrusters.forEach(f=>{f.scale.y=.35+Math.abs(flightSpeed)/180+(reducedMotion?0:Math.sin(t*.045)*.08);f.material.opacity=.4+Math.min(Math.abs(flightSpeed)/180,.5);});$('#speed').textContent=Math.round(Math.abs(flightSpeed));$('#speed-bar').style.width=Math.min(Math.abs(flightSpeed)/950*100,100)+'%';$('#flight-status').textContent=boost&&thrust?'曲速推进':thrust?'巡航推进':'惯性滑行';if(audioOn)audioGain.gain.setTargetAtTime(.22+Math.abs(flightSpeed)/2500,audioCtx.currentTime,.15);}
let last=performance.now(),frames=0,fpsStart=last;
function animate(t){requestAnimationFrame(animate);if(document.hidden){last=t;return;}const dt=Math.min((t-last)/1000,.045);last=t;
explodeCurrent=T.MathUtils.damp(explodeCurrent,explodeTarget,3.4,dt);for(const [id,m] of modules){const factor=explodeCurrent+(m.detached?.8:0);const desired=m.offset.clone().multiplyScalar(factor);m.group.position.lerp(desired,1-Math.exp(-dt*5));}
if(!reducedMotion){rotatingRing.rotation.z+=dt*.025;planets.forEach(p=>p.globe.rotation.y+=dt*.012);}
if(transition){const tr=transition,p=T.MathUtils.clamp((t-tr.start)/tr.duration,0,1),e=p*p*(3-2*p);const target=tr.targetFrom.clone().lerp(tr.targetTo,e);if(tr.kind==='flight'){ship.position.copy(tr.from).lerp(tr.to,e);shipYaw=0;shipPitch=0;ship.rotation.set(0,0,0);camera.position.copy(ship.position).add(new T.Vector3(0,8,32));camera.lookAt(target);orbitTarget.copy(target);}else{camera.position.copy(tr.from).lerp(tr.to,e);camera.lookAt(target);orbitTarget.copy(target);}if(p>=1){experience.event('arrive',destination);if(tr.kind==='orbit'){const offset=camera.position.clone().sub(orbitTarget);orbitRadius=offset.length();orbitPhi=Math.acos(offset.y/orbitRadius);orbitTheta=Math.atan2(offset.x,offset.z);}transition=null;toast(`已抵达${destination==='station'?'奥德赛空间站':planets.get(destination).name} · ${mode==='flight'?'继续自由飞行':'拖动观察，或启航探索'}`);}}
else if(experience.active)experience.update(dt,t);else if(maneuvers.mode)maneuvers.update(experience.isModal()?0:dt);else if(mode==='flight'){fly(dt,t);if(destination==='jupiter'&&keys.has('KeyW')&&Math.abs(flightSpeed)>15&&!experience.isModal()&&ship.position.distanceTo(planets.get('jupiter').group.position)<planets.get('jupiter').r*8)experience.event('flight','jupiter',dt);}else updateOrbitCamera();
updateOptics(reducedMotion?0:dt);
craftDetail.update(mode==='flight'&&!maneuvers.mode?Math.min(1,Math.abs(flightSpeed)/180):0,Number(keys.has('KeyA'))-Number(keys.has('KeyD')),Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')),t*.001);
portDetail.update(maneuvers.lock,t*.001);
sky.position.copy(camera.position);
if(scanObject){const p=(t-scanStart)/1800;if(p>=1){scanObject=null;scanRing.material.opacity=0;}else{scanRing.scale.setScalar(scanObject.r*(1+p*1.4));scanRing.material.opacity=(1-p)*.7;scanRing.lookAt(camera.position);}}
if(mode==='station'&&destination==='station'){const v=new T.Vector3(38,4,2).applyMatrix4(station.matrixWorld).project(camera);$('#target-marker').style.left=(v.x*.5+.5)*innerWidth+'px';$('#target-marker').style.top=((-.5*v.y+.5)*innerHeight-100)+'px';}
postFX.render(experience.active?experience.scene:scene,camera);if(!experience.active)maneuvers.afterRender(renderer.domElement);frames++;if(t-fpsStart>2000){$('#fps').textContent=`WEBGL / ${Math.round(frames*1000/(t-fpsStart))} FPS`;frames=0;fpsStart=t;}}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));postFX.resize();});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('图形上下文中断，请刷新页面重新连接');});
syncMode();requestAnimationFrame(animate);
setTimeout(()=>{$('#loading').classList.add('finished');setTimeout(()=>$('#loading').remove(),900);},1200);

// Read-only diagnostics for rendering and interaction verification.
window.astra={getState:()=>({experience:experience.state(),maneuver:maneuvers.mode,docked:maneuvers.docked,mode,destination,scanned:[...scanned],explode:explodeTarget,selectedModule,shipPosition:ship.position.toArray(),cameraPosition:camera.position.toArray(),transitioning:!!transition,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,texturesLoaded,webgl:renderer.capabilities.isWebGL2}),get renderer(){return renderer;}};
