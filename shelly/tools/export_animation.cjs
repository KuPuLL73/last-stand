const fs=require('fs');
const SC3D=require('./SC3D.js');
SC3D.importPath=require('path').resolve(__dirname,'../source');
const clips={};
for(const name of ['shelly_geo.scw','shelly_idle.scw']){
 const lib=SC3D.importLib(name);
 clips[name]=lib.findChunks('NODE').flatMap(c=>c.nodes).map(n=>({name:n.name,parent:n.parent,frames:n.frames.map(f=>({index:f.index,position:f.position,rotation:f.rotation,scale:f.scale}))}));
}
fs.writeFileSync(require('path').resolve(__dirname,'../model/animation-data.json'),JSON.stringify(clips));
