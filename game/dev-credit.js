// Explicit, once-per-profile credit for this developer's requested playtest.
// Imported only by dev-credit.html, which is excluded from production entries.
export function grantTestCredit(storage){
 const key='rift-survival-profile.v1',receipt='rift-test-credit.2026-11-04.100000';
 const profile=JSON.parse(storage.getItem(key)||'{}');
 if(!profile||typeof profile!=='object'||Array.isArray(profile))throw new Error('Invalid profile');
 const wallet=Number.isFinite(profile.wallet)?Math.max(0,Math.floor(profile.wallet)):0;
 if(storage.getItem(receipt)==='claimed')return {applied:false,wallet};
 profile.wallet=wallet+100000;
 storage.setItem(key,JSON.stringify(profile));storage.setItem(receipt,'claimed');
 return {applied:true,wallet:profile.wallet};
}
