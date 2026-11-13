export const MAP={minX:-11.3,maxX:11.3,minZ:-12.3,maxZ:12.3};
export function normalize2(x,z){const n=Math.hypot(x,z);return n>1?{x:x/n,z:z/n}:{x,z};}
export function movePlayer(position,dx,dz,radius,obstacles,bounds=MAP){
 const p={x:position.x,z:position.z};
 for(const axis of ['x','z']){
  p[axis]+=axis==='x'?dx:dz;
  p.x=Math.max(bounds.minX+radius,Math.min(bounds.maxX-radius,p.x));p.z=Math.max(bounds.minZ+radius,Math.min(bounds.maxZ-radius,p.z));
  for(const box of obstacles){
   const x=Math.max(box.x-box.w/2,Math.min(box.x+box.w/2,p.x)),z=Math.max(box.z-box.d/2,Math.min(box.z+box.d/2,p.z));
   const vx=p.x-x,vz=p.z-z,n=Math.hypot(vx,vz);
   if(n<radius){if(n>.00001){p.x+=vx/n*(radius-n);p.z+=vz/n*(radius-n);}else{const sign=p[axis]>=box[axis]?1:-1;p[axis]=box[axis]+sign*((axis==='x'?box.w:box.d)/2+radius);}}
  }
 }
 return p;
}
export function segmentCircle(x0,z0,x1,z1,cx,cz,r){const dx=x1-x0,dz=z1-z0,a=dx*dx+dz*dz;if(!a)return Math.hypot(x0-cx,z0-cz)<=r?0:null;const fx=x0-cx,fz=z0-cz,c=fx*fx+fz*fz-r*r;if(c<=0)return 0;const b=2*(fx*dx+fz*dz),disc=b*b-4*a*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;}
export function segmentBox(x0,z0,x1,z1,box){let lo=0,hi=1;for(const [a,b,min,max] of [[x0,x1,box.x-box.w/2,box.x+box.w/2],[z0,z1,box.z-box.d/2,box.z+box.d/2]]){const d=b-a;if(Math.abs(d)<1e-8){if(a<min||a>max)return null;}else{let t0=(min-a)/d,t1=(max-a)/d;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return null;}}return lo;}
export function pelletDirections(x,z,count=5,spread=.36){const n=Math.hypot(x,z)||1,a=Math.atan2(x/n,z/n);return Array.from({length:count},(_,i)=>{const theta=a+(count===1?0:(i/(count-1)-.5)*spread);return{x:Math.sin(theta),z:Math.cos(theta)};});}
