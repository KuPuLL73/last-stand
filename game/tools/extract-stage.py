from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=(root/'game/arena.js').read_text(encoding='utf-8')
start=source.index("scene.background=new THREE.Color")
end=source.index('const targetSpecs=')
body=source[start:end]
body=body.replace("const camera=new THREE.PerspectiveCamera(40,1,.1,100),cameraTarget=new THREE.Vector3(0,0,3);",'')
obstacles=source[source.index('const obstacles='):source.index('let renderer;')]
out="import * as THREE from 'three';\nimport {MAP} from './logic.js';\n\nexport function createDesertArena(scene,{mobile=false}={}) {\nconst touch=mobile;\n"+obstacles+body+"\nreturn {obstacles,bounds:MAP};\n}\n"
(root/'game/desert-stage.js').write_text(out,encoding='utf-8')
