const fs = require('fs');
const targets=[
['https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js','dist/vendor/three.module.js'],
['https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/earth_atmos_2048.jpg','dist/assets/earth.jpg'],
['https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/earth_clouds_1024.png','dist/assets/clouds.png'],
['https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/textures/planets/moon_1024.jpg','dist/assets/moon.jpg']
];
Promise.all(targets.map(async([url,file])=>{try{const r=await fetch(url);if(!r.ok)throw new Error(r.status);fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));console.log(file+' ready');}catch(e){console.log(file+' failed '+e.message);process.exitCode=1;}}));
