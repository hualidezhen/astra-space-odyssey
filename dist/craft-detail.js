import * as T from './vendor/three.module.js';

const tau = Math.PI * 2;
const alongZ = [Math.PI / 2, 0, 0];
const unitBox = new T.BoxGeometry();
const unitRod = new T.CylinderGeometry(1, 1, 1, 10);
const unitDisk = new T.CylinderGeometry(1, 1, 1, 36);
const unitBolt = new T.CylinderGeometry(1, 1, 1, 6);
const up = new T.Vector3(0, 1, 0);
const rings = new Map();
const lathe = points => new T.LatheGeometry(points.map(p => new T.Vector2(...p)), 48);
const radial = (a, r, z) => [Math.cos(a) * r, Math.sin(a) * r, z];

function metal(color, roughness, metalness) {
  return new T.MeshStandardMaterial({ color, roughness, metalness });
}
const shell = metal(0xc9c8b9, .48, .51);
const edge = metal(0x88949b, .34, .78);
const graphite = metal(0x272c30, .57, .65);
const carbon = metal(0x151a1e, .8, .24);
const nickel = metal(0x978778, .43, .81);
const ceramic = metal(0x70645e, .8, .18);
const brass = metal(0xa48853, .43, .72);
const orange = metal(0xad622a, .54, .34);
const glass = new T.MeshPhysicalMaterial({ color: 0x5c8a90, metalness: .09, roughness: .09, clearcoat: 1, clearcoatRoughness: .07, transparent: true, opacity: .32, depthWrite: false });
const signal = (color, strength) => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: .35, metalness: .14 });
const warm = signal(0xffd6a2, 2.6);
const panelLight = signal(0x78bfbd, 1.3);

// The hot edges oxide-tint the nickel petals. Longitudinal sanding marks affect
// specularity, while the thin discoloration bands stay in the albedo layer.
function annealedNickel() {
  const w=128, h=128, albedo=new Uint8Array(w*h*4), rough=new Uint8Array(w*h*4);
  const stops=[[0,148,139,122],[.27,122,116,107],[.50,150,125,87],
    [.63,132,103,80],[.75,108,94,110],[.86,90,100,119],[.96,74,73,72],[1,106,109,107]];
  for(let x=0;x<w;x++) {
    const brush=Math.sin(x*1.53)*.44+Math.cos(x*3.17)*.28+Math.sin(x*.58)*.28;
    for(let y=0;y<h;y++) {
      const i=(y*w+x)*4, t=T.MathUtils.clamp(y/(h-1)+.014*brush,0,1);
      let j=1;
      while(stops[j][0]<t) j++;
      const lo=stops[j-1], hi=stops[j], k=(t-lo[0])/(hi[0]-lo[0]);
      const speckle=Math.cos(x*38.9+y*76.7)*Math.sin(x*13.1-y*27.3);
      for(let ch=0;ch<3;ch++) {
        albedo[i+ch]=Math.round(T.MathUtils.lerp(lo[ch+1],hi[ch+1],k)+6*brush+2*speckle);
        rough[i+ch]=Math.round(175+24*brush+22*t+8*speckle);
      }
      albedo[i+3]=rough[i+3]=255;
    }
  }
  function map(data, color) {
    const t=new T.DataTexture(data,w,h);
    if(color) t.colorSpace=T.SRGBColorSpace;
    t.magFilter=T.LinearFilter; t.minFilter=T.LinearMipmapLinearFilter;
    t.generateMipmaps=true; t.needsUpdate=true;
    return t;
  }
  return new T.MeshStandardMaterial({ map:map(albedo,true), roughnessMap:map(rough,false), roughness:.66, metalness:.83 });
}
const petalMetal=annealedNickel();

// Bake fixed fittings into one indexed draw per material and per moving assembly.
class Fittings {
  constructor(parent) {
    this.parent = parent;
    this.buckets = new Map();
    this.transform = new T.Object3D();
    this.v = new T.Vector3();
    this.normal = new T.Matrix3();
  }
  add(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const object = this.transform;
    object.position.set(...position);
    object.scale.set(...scale);
    if (rotation.isQuaternion) object.quaternion.copy(rotation);
    else object.rotation.set(...rotation);
    object.updateMatrix();
    return this.stamp(geometry, material, object.matrix);
  }
  stamp(geometry, material, matrix) {
    if (!this.buckets.has(material)) this.buckets.set(material, { pos: [], nor: [], uv: [], ix: [] });
    const { pos, nor, uv, ix } = this.buckets.get(material);
    const start = pos.length / 3, a = geometry.attributes;
    const v = this.v, n = this.normal.getNormalMatrix(matrix);
    for (let i = 0; i < a.position.count; i++) {
      v.fromBufferAttribute(a.position, i).applyMatrix4(matrix);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(a.normal, i).applyNormalMatrix(n);
      nor.push(v.x, v.y, v.z);
      uv.push(a.uv?.getX(i) ?? 0, a.uv?.getY(i) ?? 0);
    }
    const index = geometry.index;
    for (let i = 0; i < (index ? index.count : a.position.count); i++) ix.push(start + (index ? index.getX(i) : i));
  }
  box(mat, p, s, r) { this.add(unitBox, mat, p, s, r); }
  disk(mat, p, r, depth, rotation = alongZ, geo = unitDisk) { this.add(geo, mat, p, [r, depth, r], rotation); }
  ring(mat, p, radius, thickness, rotation = [0, 0, 0]) {
    const ratio = thickness / radius, key = ratio.toFixed(5);
    if (!rings.has(key)) rings.set(key, new T.TorusGeometry(1, ratio, 6, radius > 1.5 ? 56 : 32));
    this.add(rings.get(key), mat, p, [radius, radius, radius], rotation);
  }
  rod(mat, a, b, diameter) {
    const u = new T.Vector3(...a), v = new T.Vector3(...b), d = v.clone().sub(u);
    const height = d.length();
    this.add(unitRod, mat, u.lerp(v, .5).toArray(), [diameter / 2, height, diameter / 2], new T.Quaternion().setFromUnitVectors(up, d.normalize()));
  }
  tube(mat, path, radius) {
    const curve = new T.CatmullRomCurve3(path.map(p => new T.Vector3(...p)));
    this.add(new T.TubeGeometry(curve, Math.max(path.length * 3, 12), radius, 6, false), mat, [0, 0, 0]);
  }
  flush() {
    for (const [material, b] of this.buckets) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(b.uv, 2));
      g.setIndex(b.ix);
      g.computeBoundingSphere();
      const m = new T.Mesh(g, material);
      m.castShadow = m.receiveShadow = true;
      this.parent.add(m);
    }
    this.buckets.clear();
  }
}

// Revolve each station of the fuselage around Z, leaving a real cockpit cutout.
function pressureHull() {
  const stations = [[-7,.075,.06],[-6.55,.24,.13],[-5.6,.55,.25],[-4.05,1.04,.65],[-3.8,1.1,.66],[-3.35,1.2,.78],[-2.8,1.29,.93],[-2,1.36,1.03],[-1.3,1.4,1],[-.65,1.44,.94],[-.2,1.46,.85],[.05,1.47,.7],[.27,1.48,.83],[1.5,1.5,.8],[3.7,1.15,.62],[4.3,.92,.5]];
  const n = 40, pos = [], uv = [], ix = [];
  for (const [z, w, h] of stations) {
    const r = Math.sqrt(Math.max(0, 1 - ((z + 2) / 2.05) ** 2));
    const cut = Math.asin(.79 * r / w);
    for (let j = 0; j <= n; j++) {
      const a = Math.PI / 2 + cut + (tau - 2 * cut) * j / n;
      const k = Math.sin(a);
      const blend = r > .001 && k > 0 ? (k / Math.cos(cut)) ** 5 : 0;
      pos.push(w * Math.cos(a), h * k + blend * (.65 - h * Math.cos(cut)), z);
      uv.push(j / n, (z + 7) / 11.3);
    }
  }
  for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < n; j++) {
    const a = i * (n + 1) + j, c = a + n + 1;
    ix.push(a, a + 1, c, a + 1, c + 1, c);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.computeVertexNormals();
  // Average the UV seam on the closed sections only.
  const norm = g.attributes.normal, v = new T.Vector3(), w = new T.Vector3();
  stations.forEach(([z], i) => {
    if (z > -4.05 && z < .05) return;
    const a = i * (n + 1), b = a + n;
    v.fromBufferAttribute(norm, a).add(w.fromBufferAttribute(norm, b)).normalize();
    norm.setXYZ(a, v.x, v.y, v.z);
    norm.setXYZ(b, v.x, v.y, v.z);
  });
  return g;
}
function canopyAndSeat(ship, f) {
  const canopy = ship.children.find(m => m.geometry?.type === 'SphereGeometry' && m.position.z === -2);
  if (canopy) canopy.material = glass;
  const body = ship.children.find(m => m.geometry?.type === 'BufferGeometry' && !m.isInstancedMesh);
  if (body) {
    body.geometry.dispose();
    body.geometry = pressureHull();
  }
  // Replace the original constant-width arches with frames conforming to the glazing.
  for (const m of [...ship.children]) {
    if (m.geometry?.type === 'TubeGeometry') {
      ship.remove(m);
      m.geometry.dispose();
    }
    if (m.isInstancedMesh && m.geometry?.type === 'CylinderGeometry') {
      const matrix = new T.Matrix4(), p = new T.Vector3();
      for (let i = 0; i < m.count; i++) {
        m.getMatrixAt(i, matrix);
        p.setFromMatrixPosition(matrix);
        if (Math.abs(p.y - 1.55) < .001 && Math.abs(p.x) < .001) {
          m.setMatrixAt(i, matrix.makeScale(0, 0, 0));
          m.instanceMatrix.needsUpdate = true;
        }
      }
    }
  }
  for (const z of [-3.17, -.75]) {
    const r = Math.sqrt(1 - ((z + 2) / 2.05) ** 2);
    f.tube(edge, Array.from({length: 13}, (_, i) => [.8 * r * Math.cos(i * Math.PI / 12), .65 + .9 * r * Math.sin(i * Math.PI / 12), z]), .038);
  }
  for (const side of [-1, 1]) {
    f.tube(graphite, Array.from({length: 17}, (_, i) => [side * .8 * Math.sin(i * Math.PI / 16), .65, -2 - 2.05 * Math.cos(i * Math.PI / 16)]), .047);
    f.box(nickel, [side * .32, .72, -1.75], [.1, .28, .76]);
    f.box(brass, [side * .15, .89, -1.34], [.064, .55, .04], [-.21, 0, side * -.13]);
  }
  f.box(carbon, [0, .35, -1.94], [1.35, .19, 2.35]);
  f.box(graphite, [0, .78, -1.26], [.61, .75, .19], [-.21, 0, 0]);
  f.box(ceramic, [0, 1.16, -1.19], [.44, .25, .22], [-.14, 0, 0]);
  f.box(graphite, [0, .64, -2.83], [1.05, .29, .4], [.28, 0, 0]);
  for (const x of [-.26, .26]) f.box(panelLight, [x, .73, -2.62], [.3, .12, .018], [.28, 0, 0]);
}

function nozzle(f, x) {
  const y = -.15;
  const profile = [[.47,4.79],[.66,4.83],[.67,4.99],[.55,5.09],[.67,5.64],[.645,5.64],[.43,5.05],[.32,4.96]];
  f.add(lathe(profile), graphite, [x,y,0], undefined, alongZ);
  // A petal is a shallow, tapered corrugated heat shield, with a rolled lip.
  const p = [], ix = [], uv = [];
  for (const [z,r,width] of [[4.85,.692,.162],[5.06,.58,.148],[5.57,.679,.161],[5.65,.665,.145]]) {
    for (const j of [-1,0,1]) {
      const a = j * width;
      p.push(Math.cos(a) * (r + (j === 0 ? .02 : 0)), Math.sin(a) * r, z);
      uv.push((j + 1) / 2, (z-4.85)/.80);
    }
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const a = i * 3 + j;
    ix.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
  }
  const petal = new T.BufferGeometry();
  petal.setAttribute('position', new T.Float32BufferAttribute(p,3));
  petal.setAttribute('uv', new T.Float32BufferAttribute(uv,2)); petal.setIndex(ix); petal.computeVertexNormals();
  for (let i = 0; i < 18; i++) {
    const a = i * tau / 18, c = Math.cos(a), s = Math.sin(a);
    f.add(petal, i % 3 === 0 ? ceramic : petalMetal, [x,y,0], undefined, [0,0,a]);
    if (i % 2 === 0) f.rod(edge, [x + .72*c,y + .72*s,4.55],[x + .6*c,y + .6*s,5.12], .055);
  }
  f.ring(edge,[x,y,4.84],.702,.052);
  f.ring(nickel,[x,y,5.02],.595,.023);
  for (const z of [5.08,5.23,5.39,5.54]) f.ring(ceramic,[x,y,z],.43 + (z-5.05)*.37,.015);
}

// Service panels are chamfered, with exposed hinges and quarter-turn fasteners.
function hatch(f, side) {
  const y = .135, z = -.85, x = side * 1.40;
  f.box(graphite, [x,y,z], [.09,.63,1.14]);
  f.box(shell, [x + side * .054,y,z], [.05,.52,1.0]);
  f.box(orange, [x + side * .085,y+.13,z], [.018,.038,.62]);
  for (const dz of [-.4,.4]) for (const dy of [-.17,.17]) {
    f.disk(nickel, [x+side*.089, y+dy, z+dz], .034,.022, [0,0,-side*Math.PI/2], unitBolt);
  }
  f.rod(edge,[x+side*.13,y-.04,z-.18],[x+side*.13,y-.04,z+.18],.05);
  for (const dz of [-.18,.18]) f.rod(nickel,[x+side*.06,y-.04,z+dz],[x+side*.13,y-.04,z+dz],.05);
  // Three fold-flat boarding rungs and two side cheeks, tucked under the pressure door.
  for (const dz of [-.3,.3]) f.rod(graphite,[x,-.2,z+dz],[x+side*.07,-.65,z+dz],.06);
  for (let i=0;i<3;i++) {
    const offset=i*.023;
    f.rod(edge,[x+side*(.025+offset),-.27-i*.15,z-.3],[x+side*(.025+offset),-.27-i*.15,z+.3],.044);
  }
}

function buildThruster(f, point, direction) {
  const q = new T.Quaternion().setFromUnitVectors(up, new T.Vector3(...direction).normalize());
  const bell = lathe([[.035,-.11],[.122,-.08],[.158,.08],[.124,.08],[.07,-.048]]);
  f.add(bell, nickel, point, undefined, q);
}

export function detailCraft(ship) {
  const f = new Fittings(ship);
  const oldFlames = ship.children.filter(m => m.geometry?.type === 'ConeGeometry' && m.material?.isShaderMaterial);
  // A circumferential plume avoids the facing-dependent seam of a billboard.
  const exhaust = new T.ShaderMaterial({
    transparent:true, depthWrite:false, side:T.FrontSide, blending:T.AdditiveBlending,
    uniforms:{ time:{value:0}, thrust:{value:0} },
    vertexShader:`varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform float time,thrust;
      varying vec2 vUv;
      void main(){
        float z=clamp(vUv.y,0.,1.), phi=6.2831853*vUv.x;
        float streak=.78+.22*cos(5.*phi+.7*sin(2.*phi+z*18.-time*4.));
        float cell=pow(.5+.5*cos(27.*z+5.*z*z-.24*sin(time*9.)),5.);
        float density=(.13+.30*thrust+.12*cell)*pow(1.-z,1.8)*streak;
        vec3 light=mix(vec3(.18,.31,.95),vec3(.68,.88,1.),exp(-8.*z));
        gl_FragColor=vec4(light*(1.1+.5*cell),density);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  if (oldFlames.length) {
    const original=oldFlames[0].material;
    for (const flame of oldFlames) flame.material=exhaust;
    original.dispose();
  }
  canopyAndSeat(ship, f);
  f.add(unitDisk, graphite, [0,0,4.305], [.92,.075,.50], alongZ);
  f.add(unitDisk, graphite, [0,0,-7.005], [.077,.023,.061], alongZ);
  // Conductive contact rings and the rounded coupling probe meet the lock throat
  // when the vehicle origin is six metres ahead of the station's collar.
  f.add(lathe([[.04,-7.15],[.10,-7.09],[.12,-6.83],[.18,-6.60],[.17,-6.54]]),nickel,[0,0,0],undefined,alongZ);
  for (const z of [-6.94,-6.83]) f.ring(brass,[0,0,z],.12,.021);
  const jetMaterial = new T.MeshBasicMaterial({ color:0x9bd9ff, transparent:true, opacity:.5, depthWrite:false, blending:T.AdditiveBlending, toneMapped:false });
  const jetGeometry = new T.ConeGeometry(.115,.83,14,1,true);
  const jets = [];
  for (const side of [-1, 1]) {
    nozzle(f, side * 2.2);
    hatch(f, side);
    // Dorsal equipment shoulders and recessed radiator louvers.
    f.box(graphite,[side*.91,.69,1.58],[.59,.10,2.2],[0,0,side*-.27]);
    for(let i=0;i<11;i++) f.box(edge,[side*.91,.765,.66+i*.18],[.48,.048,.078],[.35,0,side*-.27]);
    for (const offset of [0,.15]) {
      f.tube(offset ? edge : brass,[[side*(1.15+offset),.2,.48],[side*(1.51+offset),.26,.83],[side*(1.54+offset),.32,2.05],[side*(1.71+offset),.29,2.63]], .04);
    }
    // Metallic leading edge, thermal breaks and separate wingtip attitude pods.
    f.rod(edge,[side*1.28,.005,-2.02],[side*5.75,.005,2.40],.088);
    f.rod(nickel,[side*3.24,-.035,3.48],[side*5.91,-.035,3.53],.105);
    f.box(graphite,[side*5.62,.0,2.92],[.46,.36,1.06]);
    for (const row of [-1,1]) {
      const origin=[side*5.63,row*.20,2.99], dir=[0,row,0];
      buildThruster(f, origin, dir);
      const plume=new T.Mesh(jetGeometry,jetMaterial);
      plume.quaternion.setFromUnitVectors(up,new T.Vector3(...dir));
      plume.visible=false;ship.add(plume);jets.push({plume,origin,dir:new T.Vector3(...dir),yaw:0,pitch:row});
    }
    const origin=[side*5.9,0,2.94],dir=[side,0,0];
    buildThruster(f,origin,dir);
    const plume=new T.Mesh(jetGeometry,jetMaterial);
    plume.quaternion.setFromUnitVectors(up,new T.Vector3(...dir));
    plume.visible=false;ship.add(plume);jets.push({plume,origin,dir:new T.Vector3(...dir),yaw:side,pitch:0});
    for (const z of [4.05,4.26]) {
      f.box(carbon,[side*.53,.13,z],[.5,.53,.16]);
      for (const dy of [-.14,.14]) f.disk(nickel,[side*.53,dy+.13,z+.1],.058,.06,alongZ,unitBolt);
    }
  }
  f.flush();
  return { update(throttle=0,yaw=0,pitch=0,seconds=0) {
    const jitter=.92+.08*Math.sin(seconds*26);
    exhaust.uniforms.time.value=seconds;
    exhaust.uniforms.thrust.value=throttle;
    for (const flame of oldFlames) {
      flame.scale.y=Math.min(flame.scale.y,.44+1.9*throttle);
      flame.position.z=5.50+2.4*flame.scale.y;
    }
    for (const jet of jets) {
      const power=T.MathUtils.clamp(jet.yaw*yaw+jet.pitch*pitch,0,1);
      jet.plume.visible=power>.04;
      if (!jet.plume.visible) continue;
      const len=(.1+power*(1.05+.22*throttle))*jitter;
      jet.plume.scale.set(.65+.35*power,len,.65+.35*power);
      const extension=.08+.415*len;
      jet.plume.position.set(...jet.origin).addScaledVector(jet.dir,extension);
    }
  }};
}

// A genderless structural flange. Both faces belong to their respective detachable module.
function bulkhead(f, center, normal, radius) {
  const axis = new T.Vector3(...normal).normalize();
  const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),axis);
  const qc = q.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(...alongZ)));
  const p=(x,y,z)=>new T.Vector3(x,y,z).applyQuaternion(q).add(new T.Vector3(...center)).toArray();
  f.disk(graphite,center,radius,.24,qc);
  f.ring(edge,p(0,0,.135),radius*.9,radius*.055,q);
  f.disk(shell,p(0,0,.14),radius*.65,.065,qc);
  f.ring(carbon,p(0,0,.184),radius*.59,radius*.035,q);
  for (let i=0;i<8;i++) {
    const a=i*tau/8,c=Math.cos(a),s=Math.sin(a);
    f.disk(i%2?nickel:brass,p(c*radius*.77,s*radius*.77,.17),radius*.075,.115,qc,unitBolt);
  }
}

function joints(modules) {
  const entries = new Map();
  const permanent = new Map();
  function get(name) {
    if (!entries.has(name)) {
      const carrier=modules.get(name).group, faces=new T.Group();
      faces.name='Separation flanges';
      faces.visible=false;
      carrier.add(faces);
      entries.set(name,{ carrier,faces,adjacent:new Set(),fittings:new Fittings(faces) });
    }
    return entries.get(name).fittings;
  }
  function structure(name) {
    if (!permanent.has(name)) permanent.set(name,new Fittings(modules.get(name).group));
    return permanent.get(name);
  }
  function pair(a,b,center,normal,r,depthA=-.115,depthB=.115) {
    bulkhead(get(a),center.map((v,i)=>v+normal[i]*depthA),normal,r);
    bulkhead(get(b),center.map((v,i)=>v+normal[i]*depthB),normal.map(v=>-v),r);
    entries.get(a).adjacent.add(modules.get(b).group);
    entries.get(b).adjacent.add(modules.get(a).group);
  }
  for (let i=0;i<8;i++) {
    const a=i*Math.PI/4,c=Math.cos(a),s=Math.sin(a),dir=[c,0,s];
    pair('core','spokes',[c*8,-.4,s*8],dir,1.52,.23,-1.07);
    pair('spokes','habitat',[c*44,-.4,s*44],dir,1.5,1.10,-.10);
    if (i%2) pair('habitat','solar',[c*48,-3,s*48],[0,-1,0],1.28);
    else pair('habitat','dock',[c*52,-.53,s*52],dir,1.72,.08,-8.10);
  }
  pair('reactor','core',[0,-12,0],[0,1,0],5.54,1.62,-.12);
  // Short pressure tunnels connect the laboratories to the habitat. The domes and
  // collars travel with each lab when the player moves the assembly apart.
  for(let i=0;i<4;i++) {
    const a=i*Math.PI/2+Math.PI/8,c=Math.cos(a),s=Math.sin(a),dir=[c,0,s];
    const lab=structure('labs'), radius=1.16;
    lab.rod(shell,[c*37,3.5,s*37],[c*44.65,1.8,s*44.65],radius*2);
    const slope=new T.Vector3(c*7.65,-1.7,s*7.65).normalize();
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),slope);
    for(const k of [.24,.5,.78]) lab.ring(graphite,[c*(37+7.65*k),3.5-1.7*k,s*(37+7.65*k)],radius,.08,q);
    pair('labs','habitat',[c*44.65,1.8,s*44.65],dir,1.27);
  }
  for(let i=0;i<3;i++) {
    const a=i*tau/3,c=Math.cos(a),s=Math.sin(a),g=structure('comms');
    g.rod(graphite,[c*5.36,23.8,s*5.36],[c*11,24,s*11],.86);
    g.rod(edge,[c*5.36,20.9,s*5.36],[c*10.7,24,s*10.7],.35);
    pair('core','comms',[c*5.44,23.8,s*5.44],[c,0,s],.85);
  }
  for(const {fittings} of entries.values()) fittings.flush();
  for(const f of permanent.values()) f.flush();
  return function updateExposure() {
    for(const {carrier,faces,adjacent} of entries.values()) {
      faces.visible=false;
      for(const other of adjacent) if(carrier.position.distanceToSquared(other.position)>.15**2) {
        faces.visible=true;
        break;
      }
    }
  };
}

function serviceArm(f) {
  const a=[-6.2,-.2,60.7],b=[-7.8,4.9,62.9],c=[-6.8,5.8,67.7],d=[-5.8,4.3,69.35];
  f.box(graphite,[-5.3,-.65,60.7],[3.6,.72,3.35]);
  for(const s of [-1,1]) f.rod(edge,[-3.3,-1.7,59.7+s],[-6.6,-.4,60.7+s],.28);
  f.disk(nickel,a,1.01,.53,[0,0,0]);
  for(const [from,to,width] of [[a,b,.42],[b,c,.32],[c,d,.21]]) {
    for(const s of [-1,1]) {
      const start=[from[0]+s*width,from[1],from[2]],end=[to[0]+s*width,to[1],to[2]];
      f.rod(shell,start,end,width*.84);
      f.rod(brass,[start[0],start[1]+.14,start[2]-.26],[end[0],end[1]+.14,end[2]-.26],width*.28);
    }
    f.rod(graphite,from,to,width);
    f.disk(graphite,to,width*1.9,width*2.8,[0,0,Math.PI/2]);
    f.disk(orange,[to[0]-width*1.42,to[1],to[2]],width*1.40,.12,[0,0,Math.PI/2]);
    f.tube(carbon,[[from[0]+width*.7,from[1],from[2]],[from[0]+width*1.8,(from[1]+to[1])*.5,(from[2]+to[2])*.5],[to[0]+width*1.2,to[1],to[2]]],.09);
  }
  for(const s of [-1,1]) {
    f.rod(nickel,d,[d[0]+s*.38,d[1]-.52,d[2]+.34],.15);
    f.rod(graphite,[d[0]+s*.38,d[1]-.52,d[2]+.34],[d[0]+s*.20,d[1]-.84,d[2]+.45],.12);
  }
}

export function detailStation(station, modules) {
  const updateExposure=joints(modules);
  const port = new T.Group();
  port.name='Forward transfer lock';
  port.position.set(0,2,68);
  modules.get('dock').group.add(port);
  const f = new Fittings(port);
  const axisShell=lathe([[2.23,-16],[2.23,-4.5],[2.49,-3.6],[2.56,-.47],[2.43,-.12],[2.11,-.12],[2.06,-.6],[2.06,-4.15]]);
  f.add(axisShell,graphite,[0,0,0],undefined,alongZ);
  for(let i=0;i<12;i++) {
    const a=i*tau/12,c=Math.cos(a),s=Math.sin(a);
    for(const [z,length,rad] of [[-11.2,8.7,2.21],[-5.5,2.36,2.21],[-1.99,2.8,2.48]]) {
      f.box(i%4===0?nickel:shell,[c*rad,s*rad,z],[.16,rad*.47,length],[0,0,a]);
    }
    f.rod(nickel,radial(a,2.55,-.55),radial(a,2.62,.24),.15);
    f.disk(i%2===0?brass:edge,radial(a,2.47,.09),.12,.14,alongZ,unitBolt);
  }
  for(const z of [-14.6,-11,-7,-4.7]) f.ring(nickel,[0,0,z],2.29,.098);
  for(const [r,z,thick,mat] of [[2.50,-.37,.15,edge],[2.44,0,.13,nickel],[2.16,-.08,.084,carbon],[2.03,-.49,.044,edge],[1.88,-3.32,.13,edge]]) {
    f.ring(mat,[0,0,z],r,thick);
  }
  // A split pressure door sits behind the soft-capture probe; its recess reads
  // through the collar even at shallow approach angles.
  f.disk(shell,[0,0,-3.55],1.99,.30);
  f.box(graphite,[0,0,-3.37],[.056,3.66,.024]);
  for(const side of [-1,1]) {
    f.disk(graphite,[side*.68,.47,-3.34],.33,.10);
    f.disk(panelLight,[side*.68,.47,-3.278],.21,.025);
    f.rod(nickel,[side*.39,-.72,-3.30],[side*1.14,-.72,-3.30],.13);
  }
  f.add(lathe([[.39,-2.94],[.43,-1.58],[.32,-1.04],[.54,-.72],[.5,-.62],[.20,-1.00],[.11,-1.43]]),nickel,[0,0,0],undefined,alongZ);
  for(let i=0;i<3;i++) {
    const a=(i/3+.25)*tau;
    f.rod(graphite,radial(a,1.9,-2.78),radial(a,.35,-1.68),.22);
    f.rod(edge,radial(a,1.74,-2.61),radial(a,.43,-1.72),.11);
  }
  for(let i=0;i<8;i++) {
    const a=(i+.5)*tau/8;
    f.box(i%2?warm:panelLight,radial(a,2.39,.138),[.10,.29,.036],[0,0,a]);
  }
  f.flush();

  const platform = new Fittings(modules.get('dock').group);
  serviceArm(platform);
  const guideLights=[];
  for(let k=0;k<3;k++) guideLights.push(signal(0x80d4d2,1.5));
  for(const side of [-1,1]) {
    platform.rod(graphite,[side*3.25,-.7,61],[side*6.9,-1.25,69.7],.43);
    platform.rod(edge,[side*3.15,-1.8,63.7],[side*6.9,-1.25,69.7],.22);
    platform.rod(graphite,[side*6.9,-1.25,69.7],[side*7.75,-1.25,79.7],.32);
    for(let i=0;i<6;i++) {
      const z=69.70+i*1.98,x=side*(6.90+i*.168);
      platform.box(graphite,[x,-1.05,z],[.57,.35,.64]);
      platform.box(guideLights[i%3],[x,-.86,z],[.36,.06,.38]);
      platform.box(guideLights[i%3],[x,-1.04,z+.33],[.35,.18,.025]);
    }
  }
  platform.flush();

  const jaws=[];
  for(let i=0;i<3;i++) {
    const a=(i/3+.25)*tau;
    const jaw=new T.Group(); jaw.rotation.z=a; port.add(jaw);
    const lock=new Fittings(jaw);
    lock.rod(nickel,[0,0,-1.38],[-.14,0,-.74],.115);
    lock.rod(graphite,[-.14,0,-.74],[-.25,0,-.53],.15);
    lock.box(orange,[-.25,0,-.55],[.20,.19,.17],[0,-.27,0]);
    lock.flush(); jaws.push({jaw,c:Math.cos(a),s:Math.sin(a)});
  }
  return { update(capture=0,seconds=0) {
    updateExposure();
    const progress=T.MathUtils.smoothstep(capture,0,1), r=.75-.27*progress;
    for(const {jaw,c,s} of jaws) jaw.position.set(c*r,s*r,-.23+.23*progress);
    for(let i=0;i<3;i++) {
      const phase=seconds*3.5+i*tau/3;
      guideLights[i].emissiveIntensity=1.1+(1-progress)*1.9*(.5+.5*Math.cos(phase))**5+progress;
    }
  }};
}
