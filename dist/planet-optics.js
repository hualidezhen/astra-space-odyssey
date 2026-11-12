import * as T from './vendor/three.module.js';

const sphereVertex = `
varying vec3 vOpticRadius;
uniform float opticRadius;
`;
const spherePosition = `
vOpticRadius = mat3(modelMatrix) * position
  / max(0.000001, opticRadius * length(modelMatrix[0].xyz));
`;
const cloudFlow = `
uniform float opticTime;
vec2 cloudUv(vec2 uv) {
  float latitude = (uv.y - 0.5) * 3.14159265;
  float flow = 0.000033 + 0.000020 * cos(latitude * 4.0);
  return vec2(fract(uv.x + opticTime * flow), uv.y);
}
`;

// The position and light are in world axes, both centred on this body's origin.
// Working in radii keeps the same penumbra on a 340-unit planet and its gallery miniature.
function bodyShader(shader, uniforms, fragmentDeclarations) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + sphereVertex)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + spherePosition);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
    '#include <common>\nvarying vec3 vOpticRadius;\nuniform vec3 opticSun;\n' + fragmentDeclarations);
}

function afterChunk(shader, chunk, code) {
  const tag = '#include <' + chunk + '>';
  shader.fragmentShader = shader.fragmentShader.replace(tag, tag + '\n' + code);
}

function sunDirection(scene, target) {
  let key = null;
  for (const light of scene.children) {
    if (light.isDirectionalLight && light.visible && (!key || light.intensity > key.intensity)) key = light;
  }
  if (!key) return target.set(-130, 160, 180).normalize();
  const position = key.matrixWorld.elements;
  const aim = key.target.matrixWorld.elements;
  return target.set(position[12] - aim[12], position[13] - aim[13], position[14] - aim[14]).normalize();
}

function beforeDraw(material, callback) {
  const original = material.onBeforeRender;
  material.onBeforeRender = function(renderer, scene, camera, geometry, object, group) {
    original.call(this, renderer, scene, camera, geometry, object, group);
    callback(scene, object);
  };
}

// visuals.js installs Earth's night map asynchronously. Recompose whenever it replaces
// onBeforeCompile, retaining both its emissive terminator and Three's normal-map path.
function extendMaterial(material, name, configure) {
  const baseKey = material.customProgramCacheKey;
  let installed;
  let version = 0;
  function refresh() {
    if (installed && installed === material.onBeforeCompile) return;
    const previous = material.onBeforeCompile;
    installed = function(shader, renderer) {
      previous.call(this, shader, renderer);
      configure(shader);
    };
    material.onBeforeCompile = installed;
    version++;
    material.customProgramCacheKey = function() {
      return baseKey.call(this) + '|planet-optics-' + name + '-' + version;
    };
    material.needsUpdate = true;
  }
  refresh();
  return refresh;
}

const cloudLayer = body => body.children.find(child => child.material?.alphaMap && child.isMesh);
const ringLayer = body => body.children.find(child => child.geometry?.type === 'RingGeometry');

function earthOptics(earth, time) {
  const mat = earth.globe.material;
  const rot = new T.Matrix4();
  const uniforms = {
    opticRadius: {value: earth.r},
    opticSun: {value: new T.Vector3()},
    opticTime: time,
    opticCloud: {value: null},
    opticCloudInverse: {value: new T.Matrix3()},
    opticCloudShell: {value: 1.003},
    opticCloudOpacity: {value: 0}
  };
  const refreshEarth = extendMaterial(mat, 'earth', shader => {
    bodyShader(shader, uniforms, cloudFlow + `
uniform sampler2D opticCloud;
uniform mat3 opticCloudInverse;
uniform float opticCloudShell;
uniform float opticCloudOpacity;
`);
    // Reuse the night map hook's uniform so city lights face away from the gallery's own sun.
    if (shader.uniforms.sunDirection) shader.uniforms.sunDirection = uniforms.opticSun;
    afterChunk(shader, 'roughnessmap_fragment', `
#ifdef USE_MAP
  vec3 landSea = diffuseColor.rgb;
  float ocean = smoothstep(0.12, 0.53, (landSea.b - max(landSea.r, landSea.g)) / max(landSea.b, 0.0008));
  roughnessFactor = mix(roughnessFactor, 0.145, ocean);
#endif
`);
    afterChunk(shader, 'lights_fragment_end', `
vec3 ground = normalize(vOpticRadius);
float solarElevation = dot(ground, opticSun);
if (opticCloudOpacity > 0.0 && solarElevation > -0.01) {
  float path = sqrt(max(0.0, solarElevation * solarElevation + opticCloudShell * opticCloudShell - 1.0)) - solarElevation;
  vec3 cloudNormal = normalize(opticCloudInverse * (ground + opticSun * path));
  vec2 projectedUv = vec2(atan(cloudNormal.z, -cloudNormal.x) * 0.159154943,
                          0.5 + asin(clamp(cloudNormal.y, -1.0, 1.0)) * 0.318309886);
  float depth = texture2D(opticCloud, cloudUv(projectedUv)).g * opticCloudOpacity;
  float transmission = 1.0 - 0.57 * depth * smoothstep(-0.01, 0.10, solarElevation);
  reflectedLight.directDiffuse *= transmission;
  reflectedLight.directSpecular *= transmission;
}
`);
  });
  beforeDraw(mat, (scene, globe) => {
    sunDirection(scene, uniforms.opticSun.value);
    const cloud = cloudLayer(globe.parent);
    uniforms.opticCloudOpacity.value = cloud?.visible ? cloud.material.opacity : 0;
    if (!cloud) return;
    uniforms.opticCloud.value = cloud.material.alphaMap;
    uniforms.opticCloudShell.value = cloud.geometry.parameters.radius / earth.r;
    uniforms.opticCloudInverse.value.setFromMatrix4(rot.extractRotation(cloud.matrixWorld)).transpose();
  });
  let lastCloud;
  return () => {
    refreshEarth();
    const cloud = cloudLayer(earth.group);
    if (!cloud || cloud === lastCloud) return;
    lastCloud = cloud;
    cloud.material.alphaMap.wrapS = T.RepeatWrapping;
    cloud.material.alphaMap.needsUpdate = true;
    extendMaterial(cloud.material, 'clouds', shader => {
      shader.uniforms.opticTime = time;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + cloudFlow)
        .replace('#include <alphamap_fragment>', `
#ifdef USE_ALPHAMAP
  diffuseColor.a *= texture2D(alphaMap, cloudUv(vAlphaMapUv)).g;
#endif
`);
    });
  };
}

const ringMin = 1.23;
const ringMax = 2.27;

function saturnOptics(saturn) {
  const ring = ringLayer(saturn.group);
  if (!ring) return;
  const bodyUniforms = {
    opticRadius: {value: saturn.r}, opticSun: {value: new T.Vector3()},
    opticRingAxis: {value: new T.Vector3()}, opticRingMap: {value: null},
    opticRingOpacity: {value: 0}, opticRingRange: {value: new T.Vector2(ringMin, ringMax)}
  };
  extendMaterial(saturn.globe.material, 'ring-on-globe', shader => {
    bodyShader(shader, bodyUniforms, `
uniform vec3 opticRingAxis;
uniform sampler2D opticRingMap;
uniform float opticRingOpacity;
uniform vec2 opticRingRange;
`);
    afterChunk(shader, 'lights_fragment_end', `
vec3 ground = normalize(vOpticRadius);
float tilt = dot(opticSun, opticRingAxis);
if (opticRingOpacity > 0.0 && abs(tilt) > 0.001 && dot(ground, opticSun) > 0.0) {
  float path = -dot(ground, opticRingAxis) / tilt;
  vec3 intercept = ground + path * opticSun;
  float u = (length(intercept) - opticRingRange.x) / (opticRingRange.y - opticRingRange.x);
  if (path > 0.0 && u > 0.0 && u < 1.0) {
    float blur = min(0.012, 0.0023 * path / abs(tilt));
    float density = texture2D(opticRingMap, vec2(u, 0.5)).a * 0.5;
    density += texture2D(opticRingMap, vec2(u - blur, 0.5)).a * 0.25;
    density += texture2D(opticRingMap, vec2(u + blur, 0.5)).a * 0.25;
    float edge = smoothstep(0.0, 0.009, min(u, 1.0-u));
    float transmission = 1.0 - 0.88 * density * opticRingOpacity * edge;
    reflectedLight.directDiffuse *= transmission;
    reflectedLight.directSpecular *= transmission;
  }
}
`);
  });
  beforeDraw(saturn.globe.material, (scene, globe) => {
    sunDirection(scene, bodyUniforms.opticSun.value);
    const bands = ringLayer(globe.parent);
    bodyUniforms.opticRingOpacity.value = bands?.visible && bands.material.map ? bands.material.opacity : 0;
    if (!bands) return;
    bodyUniforms.opticRingMap.value = bands.material.map;
    bodyUniforms.opticRingAxis.value.set(0, 0, 1).transformDirection(bands.matrixWorld);
  });
  const ringUniforms = {opticRadius: {value: saturn.r}, opticSun: {value: new T.Vector3()}};
  extendMaterial(ring.material, 'globe-on-ring', shader => {
    bodyShader(shader, ringUniforms, '');
    afterChunk(shader, 'lights_fragment_end', `
float alongSun = dot(vOpticRadius, opticSun);
float impact = length(vOpticRadius - alongSun * opticSun);
float penumbra = 0.006 + max(0.0, -alongSun) * 0.004;
float shadow = (1.0 - smoothstep(1.0 - penumbra, 1.0 + penumbra, impact))
             * (1.0 - smoothstep(-0.02, 0.02, alongSun));
reflectedLight.directDiffuse *= 1.0 - 0.94 * shadow;
reflectedLight.directSpecular *= 1.0 - 0.94 * shadow;
// Thin ice scatters sunlight through the ring plane, including its backlit face.
float incidence = abs(dot(normalize(cross(dFdx(vOpticRadius), dFdy(vOpticRadius))), opticSun));
reflectedLight.indirectDiffuse += diffuseColor.rgb * (0.12 + 0.9 * incidence) * (1.0 - 0.94 * shadow);
`);
  });
  beforeDraw(ring.material, scene => sunDirection(scene, ringUniforms.opticSun.value));
}

function lightAtmosphere(body) {
  const atmosphere = body.group.children.find(child => child.material?.uniforms?.sunDirection
    && child.material.uniforms.strength);
  if (!atmosphere) return;
  const mat = atmosphere.material;
  // The originals share a single vector; gallery and solar-system draws have different key lights.
  mat.uniforms.sunDirection.value = mat.uniforms.sunDirection.value.clone();
  beforeDraw(mat, scene => sunDirection(scene, mat.uniforms.sunDirection.value));
  if (body.id !== 'earth') return;
  mat.fragmentShader = `
uniform vec3 color;
uniform vec3 sunDirection;
uniform float strength;
varying vec3 n;
varying vec3 w;
void main() {
  vec3 normal = normalize(n);
  float grazing = 1.0 - abs(dot(normal, normalize(cameraPosition - w)));
  float elevation = dot(normal, sunDirection);
  float daylight = smoothstep(-0.24, 0.34, elevation);
  float twilight = exp(-abs(elevation + 0.025) * 16.0);
  vec3 scatter = mix(color, vec3(0.98, 0.28, 0.065), twilight * 0.76);
  float density = pow(max(0.0, grazing), 4.8) * (0.035 + 0.78 * daylight + 0.18 * twilight);
  gl_FragColor = vec4(scatter, strength * density);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
  mat.needsUpdate = true;
}

export function installPlanetOptics(planets) {
  const time = {value: 0};
  const earth = planets.get('earth');
  const updateEarth = earth && earthOptics(earth, time);
  const saturn = planets.get('saturn');
  if (saturn) saturnOptics(saturn);
  for (const body of planets.values()) lightAtmosphere(body);
  updateEarth?.();
  return dt => {
    time.value += dt;
    updateEarth?.();
  };
}
