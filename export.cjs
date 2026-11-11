const fs = require('fs');
const path = require('path');
const out = path.resolve(process.argv[2] || '../../outputs');
fs.mkdirSync(out,{recursive:true});
let html=fs.readFileSync('dist/index.html','utf8');
let css=fs.readFileSync('dist/style.css','utf8').replace(/@import\s+url\([^)]*\)\s*;/g,'');
let js=fs.readFileSync('dist/app.js','utf8');
let missions=fs.readFileSync('dist/mission.js','utf8').replaceAll('export const ','const ').replaceAll('export function ','function ');
let experience=fs.readFileSync('dist/experience.js','utf8').replace("import * as T from './vendor/three.module.js';",'').replace("import {createMission,expeditionSteps} from './mission.js';",'').replaceAll('export function ','function ');
js=js.replace("import {createExperience} from './experience.js';",()=> 'const {createExperience}=(()=>{'+missions+'\n'+experience+';return{createExperience};})();');
html=html.replace('<link rel="stylesheet" href="./experience.css">',()=>'<style>'+fs.readFileSync('dist/experience.css','utf8')+'</style>');
const assetData={};
for(const file of fs.readdirSync('dist/assets/real')){
  if(!/\.(jpg|png)$/.test(file))continue;
  const mime=file.endsWith('.png')?'image/png':'image/jpeg';
  assetData[file]='data:'+mime+';base64,'+fs.readFileSync('dist/assets/real/'+file).toString('base64');
}
let visuals=fs.readFileSync('dist/visuals.js','utf8').replace("import * as T from './vendor/three.module.js';",'').replaceAll('export function ','function ');
visuals=visuals.replace('const embeddedAssets={};',()=> 'const embeddedAssets='+JSON.stringify(assetData)+';');
js=js.replace("import {buildStation,buildShip,setupLighting,upgradePlanets,createPostFX} from './visuals.js';",()=> 'const {buildStation,buildShip,setupLighting,upgradePlanets,createPostFX}=(()=>{'+visuals+';return{buildStation,buildShip,setupLighting,upgradePlanets,createPostFX};})();');
const three=fs.readFileSync('dist/vendor/three.module.js');
js=js.replace("'./vendor/three.module.js'",JSON.stringify('data:text/javascript;base64,'+three.toString('base64')));
for(const [name,mime] of [['earth.jpg','image/jpeg'],['clouds.png','image/png'],['moon.jpg','image/jpeg']]){
  const data='data:'+mime+';base64,'+fs.readFileSync('dist/assets/'+name).toString('base64');
  js=js.replaceAll("'./assets/"+name+"'",JSON.stringify(data));
}
for(const [file,data]of Object.entries(assetData))js=js.replaceAll("'./assets/real/"+file+"'",()=>JSON.stringify(data));
html=html.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+css+'</style>').replace('<script type="module" src="./app.js"></script>',()=>'<script type="module">'+js.replaceAll('</script','<\\/script')+'</script>');
html=html.replace('<html lang="zh-CN">',()=>'<html lang="zh-CN">\n<!-- Third-party license: Three.js\n'+fs.readFileSync('dist/vendor/THREE-LICENSE.txt','utf8')+'\n-->');
html=html.replace('</head>',()=> '<!-- Planetary texture attribution\n'+fs.readFileSync('dist/assets/real/ATTRIBUTION.md','utf8')+'\n--></head>');
fs.writeFileSync(path.join(out,'ASTRA-星海远征.html'),html);
console.log('Standalone offline HTML exported ('+(Buffer.byteLength(html)/1024/1024).toFixed(1)+' MB)');
