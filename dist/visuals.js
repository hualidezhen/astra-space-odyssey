import * as T from './vendor/three.module.js';
const embeddedAssets={};
const asset=name=>embeddedAssets[name]||'./assets/real/'+name;

// Physically lit, layered assemblies. Small repeated parts use instancing.
let seed=97281;
const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const boxGeometry=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();
function mesh(parent,geo,mat,p=[0,0,0],r=[0,0,0]){const m=new T.Mesh(geo,mat);m.position.set(...p);m.rotation.set(...r);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,mat,p,s,r){const m=mesh(parent,boxGeometry,mat,p,r);m.scale.set(...s);return m;}
function cyl(parent,mat,r1,r2,h,p,r,segments=48){return mesh(parent,new T.CylinderGeometry(r1,r2,h,segments),mat,p,r);}
function tor(parent,mat,radius,tube,p=[0,0,0],r=[Math.PI/2,0,0],segments=160){return mesh(parent,new T.TorusGeometry(radius,tube,12,segments),mat,p,r);}
function batch(parent,mat,items,geo=boxGeometry){if(!items.length)return;const m=new T.InstancedMesh(geo,mat,items.length);items.forEach((d,i)=>{dummy.position.set(...d.p);dummy.rotation.set(...(d.r||[0,0,0]));dummy.scale.set(...d.s);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.instanceMatrix.needsUpdate=true;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const rodBuckets=new Map(),rodGeo=new T.CylinderGeometry(1,1,1,8);
function rod(parent,mat,a,b,r=.12){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),m=new T.Object3D();m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize());m.scale.set(r,d.length(),r);m.updateMatrix();const key=parent.uuid+mat.uuid;if(!rodBuckets.has(key))rodBuckets.set(key,{parent,mat,matrices:[]});rodBuckets.get(key).matrices.push(m.matrix.clone());return m;}
function flushRods(){for(const {parent,mat,matrices}of rodBuckets.values()){const m=new T.InstancedMesh(rodGeo,mat,matrices.length);matrices.forEach((matrix,i)=>m.setMatrixAt(i,matrix));m.castShadow=true;m.receiveShadow=true;parent.add(m);}rodBuckets.clear();}
function texture(w,h,draw,color=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);if(color)t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
const hullMap=texture(1024,1024,(c,w,h)=>{
 c.fillStyle='#bbc0c1';c.fillRect(0,0,w,h);
 for(let i=0;i<18000;i++){const g=130+rnd()*120;c.fillStyle=`rgba(${g},${g},${g},.075)`;c.fillRect(rnd()*w,rnd()*h,rnd()*3+1,rnd()*3+1);}
 for(let y=0;y<h;y+=128)for(let x=0;x<w;x+=256){c.strokeStyle='#4c555d';c.lineWidth=2;c.strokeRect(x+2,y+2,252,124);c.strokeStyle='#e0e4e5';c.lineWidth=1;c.strokeRect(x+4,y+4,248,120);if(rnd()>.4){c.fillStyle='#97a2a8';c.fillRect(x+15,y+15,35+rnd()*120,10+rnd()*55);}for(const dx of [10,246])for(const dy of [10,118]){c.fillStyle='#546169';c.beginPath();c.arc(x+dx,y+dy,2,0,Math.PI*2);c.fill();}if(rnd()>.65){c.fillStyle='#34434c';c.fillRect(x+170,y+90,60,17);c.fillStyle='#d7d8cc';c.font='6px monospace';c.fillText('CAUTION / SERVICE',x+174,y+101);}}
});
const roughMap=texture(256,256,(c,w,h)=>{const img=c.createImageData(w,h);for(let i=0;i<img.data.length;i+=4){const g=140+rnd()*95;img.data.set([g,g,g,255],i);}c.putImageData(img,0,0);},false);
roughMap.wrapS=roughMap.wrapT=T.RepeatWrapping;roughMap.repeat.set(3,3);
const armor=new T.MeshStandardMaterial({color:0xe0e4e4,map:hullMap,roughnessMap:roughMap,roughness:.6,metalness:.42,bumpMap:roughMap,bumpScale:.008});
const silver=new T.MeshStandardMaterial({color:0x7c858d,roughness:.48,metalness:.9,roughnessMap:roughMap});
const titanium=new T.MeshStandardMaterial({color:0x343d43,roughness:.68,metalness:.75});
const charcoal=new T.MeshStandardMaterial({color:0x111922,roughness:.74,metalness:.55});
const ceramic=new T.MeshStandardMaterial({color:0xc6c5b9,map:hullMap,roughness:.7,metalness:.25});
const brass=new T.MeshStandardMaterial({color:0x978065,roughness:.62,metalness:.85});
const blackGlass=new T.MeshPhysicalMaterial({color:0x07232b,roughness:.16,metalness:.48,clearcoat:1,clearcoatRoughness:.15});
const cyan=new T.MeshStandardMaterial({color:0x83cbd6,emissive:0x6bd8ec,emissiveIntensity:2.8,roughness:.3});
const warm=new T.MeshStandardMaterial({color:0xd8c4a0,emissive:0xf9cf8c,emissiveIntensity:1.9,roughness:.5});
const red=new T.MeshStandardMaterial({color:0x802a20,emissive:0xff4b24,emissiveIntensity:1.8});
const solarMap=texture(1024,1024,(c,w,h)=>{c.fillStyle='#151e2e';c.fillRect(0,0,w,h);for(let y=0;y<32;y++)for(let x=0;x<16;x++){c.fillStyle=`hsl(${218+rnd()*14},${20+rnd()*22}%,${10+rnd()*7}%)`;c.fillRect(x*64+2,y*32+2,60,28);c.strokeStyle='#697685';c.lineWidth=.5;for(let j=1;j<8;j++){c.beginPath();c.moveTo(x*64+4,y*32+j*4);c.lineTo(x*64+60,y*32+j*4);c.stroke();}c.fillStyle='#93a0a8';c.fillRect(x*64+18,y*32+2,.8,28);c.fillRect(x*64+46,y*32+2,.8,28);}});
const solarMat=new T.MeshStandardMaterial({map:solarMap,roughness:.36,metalness:.74,side:T.DoubleSide});
function label(parent,text,p,s,r=[-Math.PI/2,0,0],dark=false){const map=texture(1024,256,c=>{c.clearRect(0,0,1024,256);c.fillStyle=dark?'#15232c':'#bdc9c9';c.font='500 95px monospace';c.textAlign='center';c.fillText(text,512,143);c.fillStyle='#c39048';c.fillRect(190,185,644,8);});const m=mesh(parent,new T.PlaneGeometry(...s),new T.MeshStandardMaterial({map,transparent:true,roughness:.8,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),p,r);m.castShadow=false;return m;}
function capsule(parent,radius,length,p,rotation=[0,0,0]){const g=new T.Group();g.position.set(...p);g.rotation.set(...rotation);parent.add(g);mesh(g,new T.CapsuleGeometry(radius,length,8,32),ceramic);for(let y=-length/2;y<=length/2;y+=length/4)tor(g,titanium,radius+.04,.13,[0,y,0]);return g;}

export function buildStation(station,modules){
 modules.forEach(m=>m.group.clear());
 const core=modules.get('core').group;
 const profile=[[0,-12],[5.6,-12],[6.1,-10],[6.1,-3],[8.2,-2],[8.2,2],[6.5,3],[6.5,8],[5.7,10],[5.7,23],[4.8,26],[4.8,31],[3.2,33],[3.2,36],[0,36]].map(([x,y])=>new T.Vector2(x,y));
 mesh(core,new T.LatheGeometry(profile,96),armor);
 const floors=[],lamps=[],equipment=[];
 for(let y=4;y<30;y+=1.8){const r=y>24?4.85:y>9?5.78:6.55;tor(core,charcoal,r,.22,[0,y,0]);for(let i=0;i<40;i++){const a=i/40*Math.PI*2;if(rnd()>.28)lamps.push({p:[Math.cos(a)*(r+.1),y+.25,Math.sin(a)*(r+.1)],s:[.26,.14,.04],r:[0,-a+Math.PI/2,0]});}}
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;floors.push({p:[Math.cos(a)*6.3,15,Math.sin(a)*6.3],s:[.16,21,.2],r:[0,-a,0]});for(let j=0;j<5;j++)equipment.push({p:[Math.cos(a)*6.5,-7+j*1.8,Math.sin(a)*6.5],s:[.5,.7,.7],r:[0,-a,0]});}
 batch(core,silver,floors);batch(core,warm,lamps);batch(core,titanium,equipment);
 for(let y of [-10,-7,-4,0,31,34])tor(core,silver,y>30?3.4:6.2,.2,[0,y,0]);
 cyl(core,charcoal,4,4,2.8,[0,37,0]);
 const dome=mesh(core,new T.SphereGeometry(3.9,48,24,0,Math.PI*2,0,Math.PI/2),blackGlass,[0,38.2,0]);dome.scale.y=.6;
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;rod(core,silver,[Math.cos(a)*4,38,Math.sin(a)*4],[0,40.7,0],.055);}
 cyl(core,titanium,.35,.5,13,[0,44,0]);cyl(core,silver,.08,.15,11,[0,53,0]);
 for(let i=0;i<4;i++){const a=i/4*Math.PI*2;rod(core,silver,[0,48,0],[Math.cos(a)*7,42,Math.sin(a)*7],.055);}
 mesh(core,new T.SphereGeometry(.2,12,8),red,[0,58.5,0]);
 label(core,'ODYSSEY  //  01',[0,9,6.63],[7,1.75],[0,0,0]);
 cyl(core,armor,6.7,7.4,1.5,[0,27.5,0],undefined,16);
 cyl(core,blackGlass,6.65,6.65,1.1,[0,28.7,0],undefined,16);
 cyl(core,armor,5.2,6.7,.8,[0,29.6,0],undefined,16);
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;capsule(core,1.05,4,[Math.cos(a)*7.5,1.5,Math.sin(a)*7.5]);}
 // A layered pressure hull nested inside a load-bearing ring.
 const hab=modules.get('habitat').group;
 tor(hab,charcoal,48,3.1);tor(hab,armor,48,2.55,[0,.2,0]);
 const sectorAngle=Math.PI*2/72-.009,sector=new T.Shape();
 sector.absarc(0,0,52,-sectorAngle/2,sectorAngle/2,false);sector.lineTo(Math.cos(sectorAngle/2)*44,Math.sin(sectorAngle/2)*44);sector.absarc(0,0,44,sectorAngle/2,-sectorAngle/2,true);sector.closePath();
 const sectorGeo=new T.ExtrudeGeometry(sector,{depth:6,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:2,steps:1,curveSegments:6});sectorGeo.rotateX(Math.PI/2);sectorGeo.translate(0,3,0);
 const sectorPos=sectorGeo.attributes.position,sectorNormal=sectorGeo.attributes.normal,sectorUV=sectorGeo.attributes.uv;
 for(let i=0;i<sectorPos.count;i++){const x=sectorPos.getX(i),y=sectorPos.getY(i),z=sectorPos.getZ(i),a=Math.atan2(z,x)/sectorAngle+.5,r=(Math.hypot(x,z)-44)/8;sectorUV.setXY(i,Math.abs(sectorNormal.getY(i))>.5?r:a,Math.abs(sectorNormal.getY(i))>.5?a:(y+3)/6);}
 const pressureSegments=[];for(let i=0;i<72;i++)pressureSegments.push({p:[0,0,0],s:[1,1,1],r:[0,-i*Math.PI*2/72,0]});batch(hab,armor,pressureSegments,sectorGeo);
 for(let y of [-3.15,3.15]){tor(hab,silver,52,.13,[0,y,0]);tor(hab,silver,44,.13,[0,y,0]);}
 const observationBands=[],portholes=[];
 for(let i=0;i<144;i++){const a=i*Math.PI*2/144,c=Math.cos(a),s=Math.sin(a);observationBands.push({p:[c*52.15,.2,s*52.15],s:[.1,1.45,1.7],r:[0,-a,0]});for(let j=0;j<3;j++){portholes.push({p:[c*52.22,-.2+j*.4,s*52.22],s:[.04,.19,.65],r:[0,-a,0]});}}
 batch(hab,blackGlass,observationBands);batch(hab,warm,portholes);
 for(let y of [-3.1,3.1]){tor(hab,silver,46.4,.24,[0,y,0]);tor(hab,silver,49.6,.24,[0,y,0]);}
 const panels=[],sills=[],windows=[],fixtures=[],radiators=[];
 for(let i=0;i<192;i++){const a=i/192*Math.PI*2;const co=Math.cos(a),si=Math.sin(a);panels.push({p:[co*48,2.65,si*48],s:[3.9,.25,1.42],r:[0,-a,0]});sills.push({p:[co*50.65,.2,si*50.65],s:[.08,1.55,1.4],r:[0,-a,0]});for(let j=0;j<3;j++)for(let k=0;k<2;k++){if(rnd()>.18)windows.push({p:[co*50.72, -.3+j*.35,si*50.72],s:[.04,.13,.19],r:[0,-a+(k? .005:-.005),0]});}if(i%4===0){fixtures.push({p:[co*48,3.1,si*48],s:[2.6,.8,.65],r:[0,-a,0]});}if(i%12===0){radiators.push({p:[co*52.3,-1.5,si*52.3],s:[3.5,.16,4],r:[0,-a,0]});}}
 batch(hab,armor,panels);batch(hab,blackGlass,sills);batch(hab,warm,windows);batch(hab,titanium,fixtures);batch(hab,charcoal,radiators);
 const ringRods=[];
 for(let i=0;i<96;i++){const a=i/96*Math.PI*2,b=(i+1)/96*Math.PI*2;rod(hab,titanium,[Math.cos(a)*50,-2.7,Math.sin(a)*50],[Math.cos(b)*50,2.7,Math.sin(b)*50],.055);if(i%4===0){for(let side of [-1,1]){rod(hab,silver,[Math.cos(a)*45.5,side*2.7,Math.sin(a)*45.5],[Math.cos(a)*50.5,side*2.7,Math.sin(a)*50.5],.095);}}}
 tor(hab,titanium,40,1.2,[0,-8,0]);tor(hab,armor,40,.8,[0,-8,0]);tor(hab,charcoal,40,1.24,[0,-7.85,0]);
 const secondary=[];for(let i=0;i<160;i++){const a=i/160*Math.PI*2;secondary.push({p:[Math.cos(a)*41.2,-8,Math.sin(a)*41.2],s:[.12,.18,.4],r:[0,-a,0]});}batch(hab,warm,secondary);
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;rod(hab,titanium,[Math.cos(a)*40,-8,Math.sin(a)*40],[Math.cos(a)*47,-2,Math.sin(a)*47],.15);}
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const g=new T.Group();g.position.set(Math.cos(a)*48,3.35,Math.sin(a)*48);g.rotation.y=-a+Math.PI/2;hab.add(g);label(g,String(i+1).padStart(2,'0')+' / HAB',[0,.01,0],[3.2,.8]);}
 const spokes=modules.get('spokes').group;
 for(let i=0;i<8;i++){const a=i*Math.PI/4,g=new T.Group();g.rotation.y=-a;spokes.add(g);box(g,charcoal,[26,-.4,0],[38,1.8,2.8]);box(g,armor,[26,.8,0],[38,.5,2.7]);for(let side of [-1,1]){rod(g,silver,[7,-2,side*2],[46,-2,side*2],.16);rod(g,silver,[7,1,side*2],[46,1,side*2],.14);for(let j=0;j<12;j++){const x=8+j*3.2;rod(g,titanium,[x,-2,side*2],[x+3.2,1,side*2],.09);rod(g,titanium,[x,1,side*2],[x+3.2,-2,side*2],.09);}}for(let j=0;j<10;j++){box(g,armor,[10+j*3.6,1.15,0],[3.4,.16,2.2]);box(g,cyan,[10+j*3.6,1.3,1.25],[.6,.06,.05]);}rod(g,brass,[7,-1,-.5],[46,-1,-.5],.12);}
 // Solar cell blankets sit on a structural boom, with visible hinges and cable runs.
 const solar=modules.get('solar').group;
 for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2,g=new T.Group();g.rotation.y=-a;solar.add(g);rod(g,silver,[47,-3,0],[84,-3,0],.38);for(let x=49;x<85;x+=3.5){box(g,titanium,[x,-3,0],[.35,1,1.2]);}for(let side of [-1,1]){const wing=new T.Group();wing.position.set(66,-3,side*10);g.add(wing);box(wing,silver,[0,0,0],[33,.12,17]);box(wing,solarMat,[0,.08,0],[32.7,.03,16.7]);box(wing,charcoal,[0,-.1,0],[32.5,.05,16.5]);for(let x=-16;x<=16;x+=8){box(wing,silver,[x,.12,0],[.1,.08,17]);}for(let z of [-8.5,0,8.5])box(wing,titanium,[0,.13,z],[33,.08,.12]);for(let x of [-13,13])rod(wing,titanium,[x,-2,-side*10],[x,0,side*7],.1);label(wing,'ASTRA // POWER',[0,.13,5],[8,1.5]);}cyl(g,silver,1.4,1.4,4,[48,-3,0],[Math.PI/2,0,0]);}
 const dock=modules.get('dock').group;
 for(let i=0;i<4;i++){const g=new T.Group();g.rotation.y=i*Math.PI/2;dock.add(g);box(g,titanium,[0,-.5,-54],[6,3,18]);box(g,armor,[0,1.2,-55],[7,.5,22]);box(g,charcoal,[0,1.48,-56],[5.9,.06,19]);for(let side of [-1,1]){rod(g,silver,[side*3.4,2,-46],[side*3.4,2,-65],.16);for(let z=-47;z>-65;z-=3){box(g,cyan,[side*2.8,1.6,z],[.12,.08,.5]);box(g,ceramic,[side*3.3,2.5,z],[.2,1.1,.2]);}}for(let k=0;k<5;k++)box(g,ceramic,[0,1.55,-48-k*3.3],[.15,.05,1.5]);tor(g,silver,2.8,.4,[0,-.3,-65],[0,0,0],64);tor(g,charcoal,2.4,.2,[0,-.3,-65.2],[0,0,0],64);label(g,'BAY '+(i+1)+' / 07',[0,1.59,-53],[4,1]);for(let side of [-1,1]){capsule(g,.7,4,[side*4,-1,-58],[Math.PI/2,0,0]);}}
 const reactor=modules.get('reactor').group;
 cyl(reactor,titanium,5.8,3.6,21,[0,-21,0]);for(let y=-30;y<-11;y+=2.5){tor(reactor,silver,4.3+(y+30)*.07,.25,[0,y,0]);tor(reactor,brass,4.6+(y+30)*.07,.075,[0,y+.5,0]);}
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2,g=new T.Group();g.rotation.y=-a;reactor.add(g);box(g,charcoal,[6,-22,0],[4,16,.25]);box(g,silver,[6,-22,.2],[3.6,15,.06]);const fins=[];for(let y=-29;y<-14;y+=.6)fins.push({p:[6,y,.25],s:[3.8,.08,.3]});batch(g,titanium,fins);rod(g,brass,[3.5,-33,0],[5.7,-12,0],.17);}
 cyl(reactor,charcoal,3.8,2.5,5,[0,-34,0]);tor(reactor,cyan,2.7,.1,[0,-36,0]);
 const labs=modules.get('labs').group;
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/8,g=capsule(labs,2.6,12,[Math.cos(a)*33,3.5,Math.sin(a)*33],[0,0,Math.PI/2]);g.rotation.y=-a;box(g,charcoal,[0,0,2.63],[2.2,9,.15]);for(let j=-4;j<=4;j+=1.2)box(g,warm,[0,j,2.75],[1.2,.14,.04]);for(let side of [-1,1]){box(g,titanium,[side*3.2,0,0],[.6,12,3]);}label(g,'SCIENCE // 0'+(i+1),[0,0,2.8],[2,6],[0,0,Math.PI/2]);}
 const comms=modules.get('comms').group;
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3,g=new T.Group();g.position.set(Math.cos(a)*11,24,Math.sin(a)*11);g.rotation.set(.2,-a,.45);comms.add(g);cyl(g,titanium,.3,.5,7,[0,3,0]);const dishProfile=[];for(let j=0;j<=24;j++){const rr=j/24*4;dishProfile.push(new T.Vector2(rr,rr*rr*.085));}mesh(g,new T.LatheGeometry(dishProfile,64),new T.MeshStandardMaterial({color:0xaab0ae,metalness:.8,roughness:.5,side:T.DoubleSide}),[0,7,0]);tor(g,silver,4,.08,[0,8.36,0]);for(let j=0;j<3;j++){const aa=j*Math.PI*2/3;rod(g,titanium,[Math.cos(aa)*3.8,8.2,Math.sin(aa)*3.8],[0,10.5,0],.055);}cyl(g,brass,.18,.22,.7,[0,10.7,0]);}
 flushRods();station.userData.detailVersion='2 / industrial orbital architecture';
}

function polygonHull(parent,mat,points,thickness,p=[0,0,0]){const shape=new T.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSegments:2,bevelSize:.07,bevelThickness:.05,steps:1});geo.computeBoundingBox();const bounds=geo.boundingBox,position=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<position.count;i++)uv.setXY(i,(position.getX(i)-bounds.min.x)/(bounds.max.x-bounds.min.x),(position.getY(i)-bounds.min.y)/(bounds.max.y-bounds.min.y));return mesh(parent,geo,mat,p,[Math.PI/2,0,0]);}
function fuselageGeometry(){const sections=[[-7,.08,.06],[-5.6,.55,.24],[-3.8,1.1,.6],[-1.8,1.35,1.05],[1.5,1.5,.8],[3.7,1.15,.62],[4.3,.92,.5]],vertices=[],indices=[],n=12;for(const [z,w,h]of sections)for(let j=0;j<n;j++){const a=j/n*Math.PI*2;vertices.push(Math.cos(a)*w,Math.sin(a)*h,z);}for(let i=0;i<sections.length-1;i++)for(let j=0;j<n;j++){const a=i*n+j,b=i*n+(j+1)%n,c=(i+1)*n+j,d=(i+1)*n+(j+1)%n;indices.push(a,b,c,b,d,c);}indices.push(0,2,1);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const uv=[];for(let i=0;i<sections.length;i++)for(let j=0;j<n;j++)uv.push(j/n,i/(sections.length-1));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return geo;}
export function buildShip(ship){
 ship.clear();mesh(ship,fuselageGeometry(),armor);
 polygonHull(ship,charcoal,[[-.35,-6],[.35,-6],[.8,-1.8],[.75,3],[-.75,3],[-.8,-1.8]],.12,[0,-.65,0]);
 const canopy=mesh(ship,new T.SphereGeometry(1,40,24,0,Math.PI*2,0,Math.PI/2),blackGlass,[0,.65,-2]);canopy.scale.set(.8,.9,2.05);
 for(let z of [-3.4,-2,-.6]){const arc=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI;arc.push(new T.Vector3(Math.cos(a)*.82,.65+Math.sin(a)*.9,z));}mesh(ship,new T.TubeGeometry(new T.CatmullRomCurve3(arc),24,.035,5,false),titanium);}
 rod(ship,titanium,[0,1.55,-3.3],[0,1.55,-.65],.035);
 const flameMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;void main(){float v=pow(clamp(1.0-vUv.y,0.,1.),1.8);float s=sin(clamp(vUv.x,0.,1.)*3.14159265);s*=s;vec3 color=mix(vec3(.08,.25,1.0),vec3(.48,.88,1.0),v);gl_FragColor=vec4(color*2.0,v*s*.28);}',toneMapped:false});
 const flames=[];
 for(let side of [-1,1]){
  const wing=polygonHull(ship,armor,[[side*1,-2.4],[side*5.9,2.5],[side*6.1,3.5],[side*2,3.4],[side*.9,1.5]],.2,[0,-.05,0]);
  polygonHull(ship,charcoal,[[side*1.7,-.8],[side*5.3,2.6],[side*4.6,2.9],[side*2.2,1.6]],.035,[0,.02,0]);
  polygonHull(ship,ceramic,[[side*3.1,.2],[side*5.7,2.8],[side*5.1,2.8],[side*2.5,.4]],.025,[0,.05,0]);
  const nacelle=new T.Group();nacelle.position.set(side*2.2,-.15,2.1);ship.add(nacelle);
  cyl(nacelle,silver,.72,.56,4,[0,0,0],[Math.PI/2,0,0],48);cyl(nacelle,charcoal,.48,.65,1.4,[0,0,2.1],[Math.PI/2,0,0],48);
  for(let z=-1;z<2.8;z+=.4)tor(nacelle,titanium,z>1.5?.67:.73,.045,[0,0,z],[0,0,0],48);
  tor(nacelle,silver,.64,.1,[0,0,2.7],[0,0,0],48);tor(nacelle,cyan,.47,.035,[0,0,2.77],[0,0,0],48);
  cyl(nacelle,charcoal,.45,.45,.03,[0,0,2.78],[Math.PI/2,0,0]);cyl(nacelle,cyan,.3,.3,.04,[0,0,2.8],[Math.PI/2,0,0]);
  const petals=[];for(let j=0;j<16;j++){const a=j/16*Math.PI*2;petals.push({p:[Math.cos(a)*.59,Math.sin(a)*.59,2.5],s:[.12,.12,.72],r:[0,0,a]});}batch(nacelle,titanium,petals);
  const flame=mesh(ship,new T.ConeGeometry(.36,4.8,24,1,true),flameMat,[side*2.2,-.15,7.2],[Math.PI/2,0,0]);flame.castShadow=false;flames.push(flame);
  const tail=polygonHull(ship,armor,[[-1,0],[2,0],[1.4,1.7],[.7,1.9]],.13,[side*3,.1,2]);tail.rotation.set(0,Math.PI/2,side*-.13);
  for(let i=0;i<7;i++)box(ship,charcoal,[side*1.4,.5,.3+i*.32],[.55,.045,.12],[0,0,side*.15]);
  label(ship,side<0?'EX-07':'ASTRA',[side*3.5,.15,1.75],[2.5,.6]);
  box(ship,side<0?red:cyan,[side*5.7,.15,3],[.12,.08,.2]);
  rod(ship,silver,[side*.75,-.65,-.7],[side*1,-1,1.8],.08);
 }
 for(let side of [-1,1]){box(ship,ceramic,[side*.6,.68,2.1],[.24,.1,2.4]);box(ship,titanium,[side*.63,.78,2.1],[.08,.05,2]);}
 const antenna=rod(ship,titanium,[0,.9,2.5],[0,2.1,3],.035);
 label(ship,'EXPLORER 07',[0,.85,1.7],[1,2.5]);
 const glow=new T.PointLight(0x65acff,6,16,2);glow.position.set(0,0,5);ship.add(glow);
 flushRods();return flames;
}

export function setupLighting(scene,renderer,sunlight,rim,fill){
 scene.traverse(o=>{if(o.isAmbientLight)o.intensity=.14;});
 sunlight.color.set(0xffefd9);sunlight.intensity=4.2;sunlight.position.set(-130,160,180);sunlight.castShadow=true;
 Object.assign(sunlight.shadow.camera,{left:-108,right:108,top:100,bottom:-100,near:1,far:600});sunlight.shadow.camera.updateProjectionMatrix();sunlight.shadow.mapSize.set(2048,2048);sunlight.shadow.normalBias=.055;sunlight.shadow.bias=-.00012;
 rim.color.set(0x719ab9);rim.intensity=.46;fill.color.set(0x90aec4);fill.intensity=.7;
 scene.add(new T.HemisphereLight(0xb9d3e6,0x111c2c,.5));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMappingExposure=1.05;
 const envMap=texture(1024,512,(c,w,h)=>{c.fillStyle='#090d13';c.fillRect(0,0,w,h);for(const [x,y,ww,hh,color]of [[110,90,240,100,'#c2c9cf'],[600,110,90,200,'#6e7d88'],[810,130,160,55,'#d4bd99'],[400,370,300,50,'#293b4d']]){const g=c.createLinearGradient(x,y,x,y+hh);g.addColorStop(0,'#0d131a');g.addColorStop(.5,color);g.addColorStop(1,'#0d131a');c.fillStyle=g;c.fillRect(x,y,ww,hh);}});
 envMap.mapping=T.EquirectangularReflectionMapping;const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(envMap).texture;scene.environmentIntensity=.7;envMap.dispose();pmrem.dispose();
}

export function upgradePlanets(planets,loader,sunGroup,sky){
 const sunlight=new T.Vector3(-130,160,180).normalize();
 const paths={mercury:'mercury.jpg',venus:'venus.jpg',earth:'earth-day.jpg',mars:'mars.jpg',jupiter:'jupiter.jpg',saturn:'saturn.jpg',uranus:'uranus.jpg',neptune:'neptune.jpg'};
 for(const [id,p]of planets){
  p.atmo.visible=false;
  const mat=new T.MeshStandardMaterial({color:0xffffff,roughness:id==='earth'?.68:1,metalness:0});p.globe.material=mat;
  loader.load(asset(paths[id]),map=>{map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;mat.map=map;mat.needsUpdate=true;},undefined,()=>{});
  if(['mercury','mars'].includes(id)){loader.load(asset(paths[id]),t=>{mat.bumpMap=t;mat.bumpScale=p.r*.0007;mat.needsUpdate=true;});}
  if(id==='earth'){
   mat.roughness=.65;loader.load(asset('earth-normal.jpg'),t=>{mat.normalMap=t;mat.normalScale.set(.45,.45);mat.needsUpdate=true;},undefined,()=>{});
   loader.load(asset('earth-night.jpg'),night=>{night.colorSpace=T.SRGBColorSpace;mat.emissiveMap=night;mat.emissive.set(0xffffff);mat.emissiveIntensity=.65;mat.onBeforeCompile=shader=>{shader.uniforms.sunDirection={value:sunlight};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPlanetNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPlanetNormal=normalize(mat3(modelMatrix)*normal);');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vPlanetNormal;uniform vec3 sunDirection;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=1.0-smoothstep(-0.15,0.2,dot(normalize(vPlanetNormal),sunDirection));');};mat.needsUpdate=true;},undefined,()=>{});
   for(const child of p.group.children){if(child.isMesh&&child!==p.globe&&child.geometry.type==='SphereGeometry'&&child.geometry.parameters.radius<p.r*.5){loader.load(asset('moon.jpg'),t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;child.material=new T.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:.03,roughness:1});});}}
  }
  if(!['mercury','mars'].includes(id)){
   const color=id==='earth'?0x438ecb:id==='venus'?0xcfa471:id==='jupiter'||id==='saturn'?0xc4a985:0x76b1ce;
   const atmoMat=new T.ShaderMaterial({uniforms:{color:{value:new T.Color(color)},sunDirection:{value:sunlight},strength:{value:id==='earth'?1.4:.32}},vertexShader:'varying vec3 n;varying vec3 w;void main(){n=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);w=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',fragmentShader:'uniform vec3 color;uniform vec3 sunDirection;uniform float strength;varying vec3 n;varying vec3 w;void main(){vec3 N=normalize(n);float facing=dot(N,normalize(cameraPosition-w));float rim=pow(1.-abs(facing),4.);float day=smoothstep(-.35,.55,dot(N,sunDirection));gl_FragColor=vec4(color*1.2,rim*day*strength);}',transparent:true,depthWrite:false,blending:T.AdditiveBlending});
   const atmosphere=mesh(p.group,new T.SphereGeometry(p.r*1.018,96,64),atmoMat);atmosphere.castShadow=false;atmosphere.receiveShadow=false;
  }
  if(id==='saturn'){
   for(const child of [...p.group.children])if(child.geometry?.type==='RingGeometry')p.group.remove(child);
   const geom=new T.RingGeometry(p.r*1.23,p.r*2.27,256,1);const uv=geom.attributes.uv,pos=geom.attributes.position;for(let i=0;i<uv.count;i++){const r=Math.sqrt(pos.getX(i)**2+pos.getY(i)**2);uv.setXY(i,(r/p.r-1.23)/1.04,.5);}uv.needsUpdate=true;
   const material=new T.MeshStandardMaterial({color:0xc0b6a1,side:T.DoubleSide,transparent:true,opacity:.95,roughness:.95,depthWrite:false});const rings=mesh(p.group,geom,material,[0,0,0],[1.2,.15,.1]);rings.castShadow=false;rings.receiveShadow=false;
   loader.load(asset('saturn-ring.png'),tex=>{tex.colorSpace=T.SRGBColorSpace;material.map=tex;material.needsUpdate=true;},undefined,()=>{});
  }
 }
 sunGroup.position.set(-2100,1100,1600);
 loader.load(asset('sun.jpg'),t=>{t.colorSpace=T.SRGBColorSpace;const sphere=sunGroup.children.find(o=>o.isMesh);if(sphere){sphere.material.map=t;sphere.material.color.set(0xffffff);sphere.material.needsUpdate=true;}},undefined,()=>{});
 loader.load(asset('milkyway.jpg'),t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;sky.clear();const bg=mesh(sky,new T.SphereGeometry(12000,64,40),new T.MeshBasicMaterial({map:t,side:T.BackSide,color:0x888e98,depthWrite:false}));bg.rotation.set(.4,2.1,-.5);bg.castShadow=false;bg.receiveShadow=false;},undefined,()=>{});
}

// HDR highlight extraction and a small separable blur preserve surface detail.
export function createPostFX(renderer){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true});target.samples=2;
 const ping=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});const pong=ping.clone();
 const camera=new T.OrthographicCamera(-1,1,1,-1,0,1),scene=new T.Scene();
 const vert='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const blur=new T.ShaderMaterial({uniforms:{image:{value:null},direction:{value:new T.Vector2()},extract:{value:0}},vertexShader:vert,fragmentShader:'uniform sampler2D image;uniform vec2 direction;uniform float extract;varying vec2 vUv;vec3 readAt(vec2 uv){vec3 c=texture2D(image,uv).rgb;float lum=max(max(c.r,c.g),c.b);return mix(c,c*smoothstep(.85,2.2,lum),extract);}void main(){vec3 c=readAt(vUv)*.227027;c+=readAt(vUv+direction*1.384615)*.316216;c+=readAt(vUv-direction*1.384615)*.316216;c+=readAt(vUv+direction*3.230769)*.070270;c+=readAt(vUv-direction*3.230769)*.070270;gl_FragColor=vec4(c,1.);}',depthTest:false,depthWrite:false,toneMapped:false});
 const composite=new T.ShaderMaterial({uniforms:{image:{value:target.texture},bloom:{value:pong.texture}},vertexShader:vert,fragmentShader:'uniform sampler2D image;uniform sampler2D bloom;varying vec2 vUv;void main(){vec3 c=texture2D(image,vUv).rgb+texture2D(bloom,vUv).rgb*.17;float grain=fract(sin(dot(vUv,vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.0018;gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',depthTest:false,depthWrite:false});
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),blur);quad.frustumCulled=false;scene.add(quad);
 function resize(){const size=renderer.getDrawingBufferSize(new T.Vector2());target.setSize(size.x,size.y);ping.setSize(Math.max(1,size.x/4|0),Math.max(1,size.y/4|0));pong.setSize(ping.width,ping.height);}
 resize();
 return{resize,render(world,view){renderer.setRenderTarget(target);renderer.render(world,view);quad.material=blur;blur.uniforms.image.value=target.texture;blur.uniforms.extract.value=1;blur.uniforms.direction.value.set(1/ping.width,0);renderer.setRenderTarget(ping);renderer.render(scene,camera);blur.uniforms.image.value=ping.texture;blur.uniforms.extract.value=0;blur.uniforms.direction.value.set(0,1/ping.height);renderer.setRenderTarget(pong);renderer.render(scene,camera);quad.material=composite;renderer.setRenderTarget(null);renderer.render(scene,camera);}};
}
