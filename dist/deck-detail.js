import * as T from './vendor/three.module.js';

const ink = '#07151d', mint = '#a4e4d5', amber = '#f1af72', white = '#e4e8db';
const legs = ['校准导航', '地球观测', '火星调查', '木星航测', '土星采样', '返航交付', '远征完成'];
const bodies = {station:'奥德赛空间站', mercury:'水星', venus:'金星', earth:'地球', mars:'火星', jupiter:'木星', saturn:'土星', uranus:'天王星', neptune:'海王星'};

function canvasTexture(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return {ctx:canvas.getContext('2d'), texture};
}

// Tooling marks, fine streaks and dust change the reflection across painted panels.
function brushedSurface() {
  const {ctx, texture} = canvasTexture(256, 256);
  let seed = 31991;
  function rand() { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; }
  ctx.fillStyle = '#d7d6d0';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3400; i++) {
    ctx.fillStyle = rand() > .52 ? 'rgba(72,70,66,.10)' : 'rgba(252,248,236,.16)';
    ctx.fillRect(rand()*256, rand()*256, .3+rand()*24, .4+rand()*.7);
  }
  for (let i = 0; i < 130; i++) {
    const x=rand()*256, y=rand()*256;
    ctx.strokeStyle='rgba(97,91,81,.25)';
    ctx.lineWidth=.45;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+rand()*12,y-rand()*3); ctx.stroke();
  }
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.needsUpdate=true;
  return texture;
}

function write(ctx, text, x, y, size, color = white, mono = false) {
  ctx.fillStyle=color;
  ctx.font=(mono?'500 ':'600 ')+size+'px '+(mono?'Consolas, "Microsoft YaHei", monospace':'"Microsoft YaHei", Arial, sans-serif');
  ctx.fillText(text,x,y);
}

function panelBackground(ctx, heading) {
  const {width:w,height:h}=ctx.canvas;
  ctx.fillStyle=ink; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#10272e'; ctx.fillRect(0,0,w,53);
  ctx.fillStyle=mint; ctx.fillRect(0,0,8,53);
  write(ctx,heading,26,35,22,mint,true);
  ctx.strokeStyle='#355056'; ctx.lineWidth=1;
  ctx.strokeRect(9,62,w-18,h-73);
}

export function dressDeck(world, ship) {
  const art=new T.Group();
  art.name='Pressure deck fittings'; world.add(art);
  const paint=brushedSurface();
  function finish(color,metalness,roughness) {
    return new T.MeshStandardMaterial({color,map:paint,metalness,roughness,roughnessMap:paint,bumpMap:paint,bumpScale:.004});
  }
  const ivory=finish(0xc9c6b5,.28,.56), slate=finish(0x56696f,.62,.44);
  const alloy=finish(0xacaaa2,.78,.36), rubber=finish(0x262c31,.12,.82);
  const brass=finish(0xa4804f,.65,.46), fabric=finish(0x687d77,.02,.94);
  const luminous=color=>new T.MeshBasicMaterial({color,toneMapped:false});
  const lamp=luminous(0xffe2b8), blue=luminous(0xb4e7e6), yellow=luminous(0xe7ad59);
  const boxGeo=new T.BoxGeometry(1,1,1), rodGeo=new T.CylinderGeometry(1,1,1,10);
  const batches=new Map(), transform=new T.Object3D(), axis=new T.Vector3(0,1,0);
  function stamp(geo, mat) {
    if(!batches.has(mat)) batches.set(mat,new Map());
    const shapes=batches.get(mat);
    if(!shapes.has(geo)) shapes.set(geo,[]);
    transform.updateMatrix(); shapes.get(geo).push(transform.matrix.clone());
  }
  function box(mat,x,y,z,w,h,d,rx=0,ry=0,rz=0) {
    transform.position.set(x,y,z); transform.rotation.set(rx,ry,rz);
    transform.scale.set(w,h,d); stamp(boxGeo,mat);
  }
  function rod(mat,a,b,r) {
    const delta=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    const length=delta.length();
    transform.position.set((a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5);
    transform.quaternion.setFromUnitVectors(axis,delta.normalize());
    transform.scale.set(r,length,r); stamp(rodGeo,mat);
  }
  function mesh(geometry,material,x,y,z,rx=0,ry=0) {
    const m=new T.Mesh(geometry,material); m.position.set(x,y,z);
    m.rotation.set(rx,ry,0); art.add(m); return m;
  }
  function screen(x,y,z,w,h,pitch=0,yaw=0,res=[640,320]) {
    const lcd=canvasTexture(...res), assembly=new T.Group();
    assembly.position.set(x,y,z); assembly.rotation.set(0,yaw,0);
    const face=new T.Group(); face.rotation.x=pitch; assembly.add(face); art.add(assembly);
    const bezel=new T.Mesh(boxGeo,rubber); bezel.scale.set(w+.12,h+.12,.095); face.add(bezel);
    const image=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:lcd.texture,toneMapped:false}));
    image.position.z=.05; face.add(image);
    return lcd;
  }
  function placard(x,y,z,w,h,yaw,title,sub) {
    const lcd=canvasTexture(512,144), {ctx}=lcd;
    ctx.fillStyle='#cecbbb'; ctx.fillRect(0,0,512,144);
    ctx.fillStyle='#a16d39'; ctx.fillRect(0,0,15,144);
    write(ctx,title,33,62,42,'#263539'); write(ctx,sub,34,112,24,'#39494a',true);
    lcd.texture.needsUpdate=true;
    mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:lcd.texture,roughness:.7}),x,y,z,0,yaw);
  }

  // Each pressure frame returns into the overhead service trunk. Split handrails stop at the side doors.
  for(const z of [-8,-5,-2,4,7,10]) {
    for(const s of [-1,1]) {
      box(rubber,s*2.879,2.35,z,.07,3.93,2.67);
      box(ivory,s*2.826,2.67,z,.09,1.62,2.45);
      box(slate,s*2.819,3.77,z,.10,.43,2.45);
      box(alloy,s*2.794,2.67,z-1.29,.16,2.57,.10);
      box(ivory,s*2.59,4.16,z-1.29,.13,1.03,.17,0,0,s*.61);
      for(const dz of [-1.08,1.08]){
        box(slate,s*2.766,2.08,z+dz,.036,.07,.09);
        box(slate,s*2.766,3.27,z+dz,.036,.07,.09);
        rod(alloy,[s*2.84,1.33,z+dz],[s*2.74,1.33,z+dz],.044);
      }
      rod(alloy,[s*2.741,1.33,z-1.16],[s*2.741,1.33,z+1.16],.035);
      for(let j=0;j<8;j++) box(rubber,s*2.761,3.76,z-.80+j*.22,.019,.21,.055);
      for(const x of [1.48,1.65]) rod(x===1.48?alloy:brass,[s*x,4.52,z-1.49],[s*x,4.52,z+1.49],.048);
      box(rubber,s*1.56,4.49,z-.98,.38,.13,.10);
      box(slate,s*2.14,.015,z,.032,.015,2.58);
      box(z%2?yellow:ivory,s*2.14,.024,z+1.31,.16,.012,.07);
    }
    box(rubber,0,4.59,z,1.02,.23,1.90);
    box(lamp,0,4.465,z,.79,.026,1.62);
    for(const dz of [-.7,-.36,0,.36,.7]) box(alloy,0,4.441,z+dz,.9,.024,.03);
  }
  placard(2.765,2.73,7,.95,.27,-Math.PI/2,'AFT  /  04','AIRLOCK');
  placard(-2.765,2.73,-5,1.05,.30,Math.PI/2,'FWD  /  01','FLIGHT DECK');
  for(const s of [-1,1]) {
    for(const z of [-20,-16,-12]) {
      box(rubber,s*7.93,2.50,z,.12,3.30,3.28);
      box(ivory,s*7.83,2.84,z,.12,1.82,3.02);
      for(const dz of [-1.32,1.32]) box(alloy,s*7.73,2.82,z+dz,.08,1.98,.08);
      box(slate,s*7.79,1.25,z,.17,.70,3.06);
      box(lamp,s*7.72,3.97,z,.08,.09,2.50);
    }
    // Padded acceleration-chair headrests and lateral shoulder supports.
    box(fabric,s*5.2,1.72,-15.21,.73,.68,.15,-.08);
    box(rubber,s*5.2,2.12,-15.12,.63,.23,.20,-.09);
    for(const dx of [-.43,.43]) box(alloy,s*5.2+dx,1.29,-15.66,.08,.11,.58);
  }

  // A real opening, sill and double lip allow parallax across the dock when walking past the hatch.
  const loop=[[-2.33,1.38],[-2.02,1.05],[2.02,1.05],[2.33,1.38],[2.33,2.89],[2.02,3.22],[-2.02,3.22],[-2.33,2.89]];
  const wallShape=new T.Shape();
  wallShape.moveTo(-3.15,-.02); wallShape.lineTo(3.15,-.02); wallShape.lineTo(3.15,4.93); wallShape.lineTo(-3.15,4.93); wallShape.closePath();
  const aperture=new T.Path(); aperture.moveTo(...loop[0]); for(const p of loop.slice(1)) aperture.lineTo(...p);
  aperture.closePath(); wallShape.holes.push(aperture);
  mesh(new T.ExtrudeGeometry(wallShape,{depth:.31,bevelEnabled:false}),slate,0,0,12.83);
  for(let i=0;i<loop.length;i++) {
    const a=loop[i], b=loop[(i+1)%loop.length];
    rod(rubber,[...a,12.80],[...b,12.80],.13);
    rod(alloy,[...a,12.72],[...b,12.72],.065);
  }
  const pane=new T.Shape(loop.map(([x,y])=>new T.Vector2(x,y)));
  const glass=new T.MeshPhysicalMaterial({color:0xb5d6d5,metalness:.3,roughness:.13,opacity:.035,transparent:true,depthWrite:false,side:T.DoubleSide});
  mesh(new T.ShapeGeometry(pane),glass,0,0,13.02);
  box(rubber,0,.79,12.73,5.1,.27,.25); box(ivory,0,.86,12.55,4.85,.10,.38);
  for(const s of [-1,1]) {
    box(ivory,s*2.64,2.16,12.71,.41,3.44,.15);
    for(const y of [.74,1.12,2.91,3.29]) box(alloy,s*2.64,y,12.59,.18,.11,.11);
    for(let i=0;i<6;i++) box(brass,s*(.3+i*.32),.45,12.78,.145,.47,.10,0,0,-.40);
  }
  const berth=screen(0,3.84,12.74,2.62,.53,0,Math.PI,[768,166]);
  const parked=ship?.clone(true);
  if(parked) {
    parked.name='Explorer at berth'; parked.position.set(.25,1.97,21);
    parked.rotation.set(.12,-.95,-.07); parked.scale.setScalar(.72);
    parked.traverse(o=>{
      if(o.isLight || (o.isMesh && o.material?.blending===T.AdditiveBlending)) o.visible=false;
      if(o.isMesh) {o.castShadow=false; o.receiveShadow=false;}
    });
    art.add(parked);
  }
  for(const s of [-1,1]) {
    for(let j=0;j<5;j++) {
      const z=16+j*2.45;
      rod(slate,[s*4.7,-.45,z],[s*4.7,.18,z+2.45],.10);
      rod(alloy,[s*4.7,.18,z],[s*4.7,.18,z+2.45],.12);
      rod(slate,[s*4.7,-.45,z],[s*4.7,-.45,z+2.45],.12);
      box(blue,s*4.7,.32,z,.26,.075,.28);
    }
    box(slate,s*1.7,.06,21,.47,.65,6.4);
    box(rubber,s*1.7,.46,21,.60,.16,3.5);
  }
  const yardLamp=new T.PointLight(0xffe0bb,32,15,2);
  yardLamp.position.set(-3.5,5.1,17.6); art.add(yardLamp);
  const stars=[];
  for(let i=0;i<700;i++){
    const dx=Math.sin(i*91.383)*43758.546, dy=Math.sin(i*17.113)*21934.219;
    stars.push((dx-Math.floor(dx)-.5)*230,(dy-Math.floor(dy)-.5)*145,105+(i%31)*1.7);
  }
  const sky=new T.BufferGeometry();
  sky.setAttribute('position',new T.Float32BufferAttribute(stars,3));
  art.add(new T.Points(sky,new T.PointsMaterial({color:0xa1b8c8,size:.095,transparent:true,opacity:.72,depthWrite:false})));

  // Physical instruments surround the three displays. Buttons and cabinets share instanced geometry.
  const nav=screen(0,1.72,-20.48,2.13,.81,-.21);
  const flight=screen(-5.2,1.64,-17.92,2.64,.76,-.24,0,[768,256]);
  const survey=screen(5.2,1.64,-17.92,2.64,.76,-.24,0,[768,256]);
  const lab=screen(7.06,1.90,1.50,2.24,1.06,-.14,-Math.PI/2,[704,352]);
  for(const [cx,z] of [[0,-20.3],[-5.2,-17.7],[5.2,-17.7]]) {
    box(rubber,cx,1.28,z+.40,3.12,.08,.41);
    for(let bank=0;bank<3;bank++) for(let row=0;row<2;row++) for(let col=0;col<7;col++){
      const x=cx-1.34+bank*.96+col*.109;
      box(col===6&&row===0?(bank%2?yellow:blue):slate,x,1.333,z+.32+row*.13,.085,.048,.095);
    }
    for(const dx of [-1.37,0,1.37]){
      box(ivory,cx+dx,.68,z+.59,.61,.67,.04);
      box(rubber,cx+dx,.91,z+.623,.22,.047,.03);
    }
  }
  // Quilting compresses at the seams and settles over the rounded mattress edge.
  const quilt=new T.PlaneGeometry(1.24,1.46,54,56);
  quilt.rotateX(-Math.PI/2);
  const pos=quilt.attributes.position;
  for(let i=0;i<pos.count;i++){
    const u=pos.getX(i)/1.24+.5,v=pos.getZ(i)/1.46+.5;
    const seam=Math.abs(Math.sin(u*Math.PI*4)*Math.sin(v*Math.PI*5));
    const edge=Math.min(1,u*15,(1-u)*15,v*15,(1-v)*15);
    pos.setY(i,.053*Math.sqrt(seam)+.04*edge+.007*Math.sin(30*u+19*v));
  }
  quilt.computeVertexNormals();
  const softPad=new T.SphereGeometry(1,30,18);
  for(const z of [-1,3.8]){
    box(slate,-7.83,.39,z,1.97,.66,1.78);
    box(rubber,-7.83,.67,z,1.90,.12,1.68);
    box(ivory,-7.83,.75,z,1.86,.13,1.58);
    box(rubber,-8.78,1.42,z,.13,1.47,1.76);
    for(const side of [-1,1]){
      box(ivory,-7.83,1.44,z+side*.868,1.99,1.42,.085);
      box(alloy,-6.815,1.47,z+side*.865,.085,1.56,.13);
      box(fabric,-8.38,1.39,z+side*.805,.56,.97,.059);
    }
    box(slate,-7.83,2.22,z,2.09,.16,1.93);
    box(lamp,-8.12,2.123,z+.68,.81,.024,.07);
    const pillow=mesh(softPad,ivory,-8.42,.89,z);
    pillow.scale.set(.29,.13,.63); pillow.rotation.z=.08;
    mesh(quilt,fabric,-7.50,.82,z);
    // Bedside lockers, restraint rail and warm reading lamps stay inside the solid footprint.
    rod(alloy,[-6.78,.81,z-.63],[-6.78,.81,z+.63],.028);
    for(const dz of [-.51,.51]) box(ivory,-6.82,.36,z+dz,.08,.43,.71);
    box(rubber,-6.765,.44,z-.51,.025,.047,.21);
    box(rubber,-6.765,.44,z+.51,.025,.047,.21);
  }
  for(let k=0;k<3;k++) {
    const x=4.05+k*1.44;
    for(let j=0;j<4;j++){
      const y=.55+j*.59;
      box(rubber,x,y,-1.773,.62,.10,.035);
      box(lamp,x+.29,y,-1.748,.058,.055,.018);
    }
  }
  for(const [mat,shapes] of batches) for(const [geo,matrices] of shapes) {
    const instances=new T.InstancedMesh(geo,mat,matrices.length);
    matrices.forEach((m,i)=>instances.setMatrixAt(i,m));
    instances.computeBoundingSphere(); art.add(instances);
  }

  let lastStep,lastDocked,lastDestination,lastPhoto;
  function update({step=0,docked=false,destination='station',photo=null}={}) {
    step=Math.max(0,Math.min(6,Math.floor(step)||0));
    const changed=step!==lastStep || docked!==lastDocked || destination!==lastDestination;
    if(changed) {
      if(parked) parked.visible=Boolean(docked);
      const target=bodies[destination] || String(destination || '—');
      const c=nav.ctx;
      panelBackground(c,'ODYSSEY   /   EXPEDITION CONTROL');
      write(c,legs[step],28,139,64);
      write(c,'当前导航',31,195,25,mint); write(c,target,165,195,29);
      for(let i=0;i<6;i++){
        const x=31+i*97;
        c.fillStyle=i<step?mint:i===step?amber:'#284048'; c.fillRect(x,230,87,11);
        write(c,'0'+(i+1),x,279,23,i<=step?white:'#64818a',true);
      }
      const d=berth.ctx;
      d.fillStyle=ink; d.fillRect(0,0,768,166);
      d.fillStyle=docked?mint:amber; d.fillRect(0,0,11,166);
      write(d,'AIRLOCK    /    BERTH 04',30,56,30,mint,true);
      write(d,docked?'探索者号已停靠':'泊位空闲',29,127,55);
      const f=flight.ctx;
      panelBackground(f,'FLIGHT OPERATIONS   /   BERTH 04');
      write(f,docked?'DOCKED':'VACANT',28,145,66,docked?mint:amber,true);
      write(f,docked?'探索者号  ·  停泊中':'停靠位  ·  等待飞船',31,208,29);
      const s=survey.ctx;
      panelBackground(s,'MISSION DATA   /   EXPEDITION');
      write(s,String(step).padStart(2,'0')+' / 06',27,147,68,white,true);
      write(s,'已完成任务',32,204,31,mint);
      for(let i=0;i<6;i++) {s.fillStyle=i<step?mint:'#2d4249'; s.fillRect(360+i*55,96,38,100);}
      for(const lcd of [nav,berth,flight,survey]) lcd.texture.needsUpdate=true;
      lastStep=step; lastDocked=docked; lastDestination=destination;
    }
    const ready=photo && (photo.naturalWidth===undefined?photo.width:photo.naturalWidth)>0;
    const currentPhoto=ready?photo:null;
    if(currentPhoto!==lastPhoto) {
      const c=lab.ctx;
      panelBackground(c,'SCIENCE LAB    /    IMAGE ARCHIVE');
      if(currentPhoto) {
        const w=photo.naturalWidth||photo.width,h=photo.naturalHeight||photo.height;
        const scale=Math.min(674/w,276/h);
        c.drawImage(photo,Math.floor((704-w*scale)/2),65+Math.floor((276-h*scale)/2),w*scale,h*scale);
      } else {
        const cx=534,cy=206;
        c.lineWidth=2;
        for(const r of [26,53,81]){c.strokeStyle='#436168'; c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.stroke();}
        c.fillStyle=amber; c.beginPath(); c.arc(cx,cy,9,0,Math.PI*2); c.fill();
        for(const [dx,dy] of [[16,-20],[-52,10],[60,54]]) {c.fillStyle=mint; c.beginPath(); c.arc(cx+dx,cy+dy,4,0,Math.PI*2); c.fill();}
        write(c,'行星影像档案',28,168,49);
        write(c,'等待首张观测照片',30,234,27,mint);
      }
      lab.texture.needsUpdate=true; lastPhoto=currentPhoto;
    }
  }
  update();
  return update;
}
