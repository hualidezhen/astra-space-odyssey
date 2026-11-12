const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve(process.argv[2] || '../../outputs');
const read = name => fs.readFileSync(path.join(__dirname, 'dist', name), 'utf8');
const data = (file,mime) => 'data:'+mime+';base64,'+fs.readFileSync(path.join(__dirname,'dist',file)).toString('base64');
const assets = {};
for (const name of fs.readdirSync(path.join(__dirname,'dist/assets/real'))) {
  if (/\.(jpg|png)$/.test(name)) assets[name]=data('assets/real/'+name,name.endsWith('.png')?'image/png':'image/jpeg');
}

// Bundle our local, named ES modules in dependency order, preserving their private scopes.
const modules=new Map();
function bundle(file){
  if(modules.has(file))return;
  let source=read(file).replace(/^import \* as T from '\.\/vendor\/three\.module\.js';\s*$/gm,'');
  source=source.replace(/^import \{([^}]+)\} from '(\.\/[^']+)';$/gm,(_,names,relative)=>{
    const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),relative));
    bundle(target);
    return 'const {'+names.replace(/\s+as\s+/g,':')+'}=__modules['+JSON.stringify(target)+'];';
  });
  const names=[];
  source=source.replace(/^export (const|function|class) (\w+)/gm,(_,kind,name)=>{names.push(name);return kind+' '+name;});
  source=source.replace('const embeddedAssets={};','const embeddedAssets=__assets;');
  source=source.replace(/'\.\/assets\/real\/([^']+\.(?:png|jpg))'/g,(_,name)=>'__assets['+JSON.stringify(name)+']');
  source=source.replace(/'\.\/assets\/([^/']+\.(?:png|jpg))'/g,(_,name)=>JSON.stringify(data('assets/'+name,name.endsWith('.png')?'image/png':'image/jpeg')));
  modules.set(file,'__modules['+JSON.stringify(file)+']=(()=>{\n'+source+'\nreturn {'+names.join(',')+'};\n})();');
}
bundle('app.js');
const js='import * as T from '+JSON.stringify(data('vendor/three.module.js','text/javascript'))+';\nconst __assets='+JSON.stringify(assets)+';\nconst __modules={};\n'+[...modules.values()].join('\n');
let html=read('index.html').replace(/<link rel="stylesheet" href="\.\/([^"]+)">/g,(_,file)=>'<style>'+read(file).replace(/@import\s+url\([^)]*\)\s*;/g,'')+'</style>');
html=html.replace('<script type="module" src="./app.js"></script>',()=>'<script type="module">'+js.replaceAll('</script','<\\/script')+'</script>');
html=html.replace('</head>',()=> '<!-- Three.js license\n'+read('vendor/THREE-LICENSE.txt')+'\nPlanetary imagery attribution\n'+read('assets/real/ATTRIBUTION.md')+'\n--></head>');
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'ASTRA-星海远征.html'),html);
console.log('Exported '+modules.size+' modules, '+(Buffer.byteLength(html)/1048576).toFixed(1)+' MiB');
