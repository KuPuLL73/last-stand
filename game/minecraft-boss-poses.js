// Neutral poses and lightweight bone animation derived from Mojang's public
// geometry/animation samples. Source meshes retain their original UV layouts.
const UNIT=1.85/32;
const sourceOf=json=>json['minecraft:geometry']?.[0]||Object.values(json).find(v=>v?.bones);
const copy=value=>JSON.parse(JSON.stringify(value));
export function guardianGeometry(json){
 const source=copy(sourceOf(json));
 const x=[0,0,8,-8,-8,8,8,-8,0,0,8,-8],y=[16,16,16,16,8,8,8,8,0,0,0,0],z=[8,-8,0,0,-8,-8,8,8,8,-8,0,0];
 const rotations=[[-45,0,0],[45,0,0],[0,0,45],[0,0,-45],[90,45,0],[90,-45,0],[90,-135,0],[90,135,0],[-135,0,0],[135,0,0],[0,0,135],[0,0,-135]];
 for(const b of source.bones){
  if(b.name==='eye')b.pose_pivot=[0,24,-8.25];
  if(b.name==='tailpart1')b.pose_pivot=[-1.5,23.5,14];
  if(b.name==='tailpart2')b.pose_pivot=[-1,23,20];
  if(b.name.startsWith('spikepart')){const n=Number(b.name.slice(9));b.pose_pivot=[x[n],y[n],z[n]];b.rotation=rotations[n];}
 }
 return{'minecraft:geometry':[source]};
}

export function dragonGeometry(json){
 const source=copy(sourceOf(json)),by=Object.fromEntries(source.bones.map(b=>[b.name,b])),bones=[];
 function add(name,parent,pivot,options={}){const b=copy(by[name]);if(parent)b.parent=parent;if(pivot)b.pose_pivot=pivot;Object.assign(b,options);bones.push(b);return b;}
 add('body',null,null);
 add('head','body',[0,24,-48]);add('jaw','head',[0,20,-56]);
 for(let i=0;i<5;i++){const b=copy(by.neck);b.name='neck'+(i+1);b.parent='body';b.pose_pivot=[0,16+i*2,-8-i*8];bones.push(b);}
 for(let i=0;i<12;i++){const b=copy(by.neck);b.name='tail'+(i+1);b.parent='body';b.pose_pivot=[0,8-i*.35,56+i*8];b.geometry_scale=[1-i*.045,1-i*.045,1];bones.push(b);}
 add('wing','body',[-12,19,2]);add('wingtip','wing',[-68,19,2]);
 add('wing1','body',[12,19,2],{mirror_x:true});add('wingtip1','wing1',[68,19,2],{mirror_x:true});
 for(const side of ['', '1']){
  const sign=side?1:-1;
  add('rearleg'+side,'body',[sign*16,8,42]);add('rearlegtip'+side,'rearleg'+side,[sign*16,-24,42]);add('rearfoot'+side,'rearlegtip'+side,[sign*16,-54,46]);
  add('frontleg'+side,'body',[sign*12,4,2]);add('frontlegtip'+side,'frontleg'+side,[sign*12,-20,2]);add('frontfoot'+side,'frontlegtip'+side,[sign*12,-43,2]);
 }
 return{'minecraft:geometry':[{...source,bones}]};
}

export function applyBossPose(animation,name,pivot,time,stride,walk,e){
 const casting=Number(e.castUntil||0)>time;
 if(animation==='wither'){
  if(name==='upperBodyPart2')pivot.rotation.x+=.10+Math.sin(time*.75)*.04;
  if(name==='upperBodyPart3')pivot.rotation.x+=.17;
  if(name==='head2'||name==='head3'){const side=name==='head2'?-1:1;pivot.rotation.y+=side*.10+Math.sin(time*.7+side)*.08;}
  return true;
 }
 if(animation==='warden'){
  if(name==='right_leg')pivot.rotation.x+=walk*.36;
  if(name==='left_leg')pivot.rotation.x-=walk*.36;
  if(name==='right_arm'||name==='left_arm')pivot.rotation.x+=casting?-1.35:(name==='right_arm'?1:-1)*walk*.23;
  if(name==='body'){pivot.rotation.x+=casting?-.08:0;pivot.position.y+=Math.abs(Math.sin(stride))*.008;}
  if(name.includes('tendril'))pivot.rotation.z+=(name.startsWith('right')?-1:1)*Math.sin(time*2.0)*.075;
  return true;
 }
 if(animation==='guardian'){
  if(name.startsWith('tailpart'))pivot.rotation.y+=Math.sin(time*2.0+Number(name.slice(-1))*.5)*(.10+Number(name.slice(-1))*.07);
  if(name==='eye')pivot.position.x+=Math.sin(time*.45)*.011;
  if(name.startsWith('spikepart'))pivot.position.multiplyScalar(casting?1.035:1+Math.sin(time*1.8)*.003);
  return true;
 }
 if(animation==='brute'){
  if(name==='rightLeg'||name==='leftLeg')pivot.rotation.x+=(name==='rightLeg'?1:-1)*walk*.42;
  if(name==='rightArm'||name==='leftArm'){pivot.rotation.x+=casting?-1.42:e.charge?-1.0:-.19+(name==='rightArm'?1:-1)*walk*.18;pivot.rotation.z+=(name==='rightArm'?1:-1)*.075;}
  if(name.includes('Forearm'))pivot.rotation.x+=casting?.55:e.charge?.22:.14;
  if(name==='body')pivot.rotation.x+=e.charge?-.12:0;
  return true;
 }
 if(animation==='dragon'){
  const flap=time*2.8;
  if(name==='wing'||name==='wing1'){const side=name==='wing'?-1:1;pivot.rotation.z+=side*(Math.sin(flap)*.24+.12);pivot.rotation.x+=-.06;}
  if(name==='wingtip'||name==='wingtip1')pivot.rotation.z+=(name==='wingtip'?1:-1)*(Math.sin(flap+.6)*.17+.12);
  if(name==='jaw')pivot.rotation.x+=casting?.34:.09;
  if(name.startsWith('rearlegtip'))pivot.rotation.x-=.55;
  else if(name.startsWith('rearleg'))pivot.rotation.x+=.96;
  if(name.startsWith('frontlegtip'))pivot.rotation.x-=.58;
  else if(name.startsWith('frontleg'))pivot.rotation.x+=.75;
  if(name.startsWith('rearfoot'))pivot.rotation.x+=.42;
  if(name.startsWith('frontfoot'))pivot.rotation.x+=.30;
  if(name.startsWith('tail')){const n=Number(name.slice(4));pivot.rotation.y+=Math.sin(time*.8+n*.3)*.055;pivot.position.x+=Math.sin(time*.8+n*.3)*n*.007;}
  if(name.startsWith('neck')||name==='head')pivot.rotation.y+=Math.sin(time*.6)*.035;
  return true;
 }
 return false;
}
