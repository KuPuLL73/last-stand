// Code-native pixel illustrations, matching the cubic equipment in the scene.
const sword=`<g transform="rotate(43 36 36)"><path d="M32 7h8v5h5v25h-5v7h-8v-7h-5V12h5Z" fill="#164b58"/><path d="M33 10h6v5h3v21h-3v5h-6v-5h-3V15h3Z" fill="#31cec5"/><path d="M34 13h3v24h-3Z" fill="#b4fff3"/><path d="M23 40h26v7H23Z" fill="#146579"/><path d="M26 40h20v3H26Z" fill="#71e9dc"/><path d="M32 47h8v17h-8Z" fill="#513d29"/><path d="M34 48h4v14h-4Z" fill="#b18447"/><path d="M31 61h10v5H31Z" fill="#1a535e"/></g>`;
const bow=`<path d="M21 8h12v7h9v8h7v25h-7v9h-9v7H21v-7h8v-8h7V24h-7v-8h-8Z" fill="#4d3427"/><path d="M25 11h6v7h8v9h6v18h-6v9h-8v7h-6v-4h5v-9h7V24h-7v-8h-5Z" fill="#c19a59"/><path d="m23 13-8 23 8 24" fill="none" stroke="#f2eccb" stroke-width="2"/><path d="M12 34h45v4H12Z" fill="#ad824a"/><path d="m53 29 12 7-12 7v-5H23v-4h30Z" fill="#c5dedf"/><path d="m14 32 8-5v7l-8 2Z" fill="#fff5d8"/><path d="m14 40 8 5v-7l-8-2Z" fill="#ecdfbc"/>`;
export function steveIcon(kind='sword'){
 let detail='';
 if(kind==='sweep'||kind==='return')detail=`<path d="M9 27C4 51 24 66 52 61" fill="none" stroke="#70f2e6" stroke-width="5"/><path d="m45 54 10 7-10 6" fill="none" stroke="#dcfff4" stroke-width="3"/>`;
 if(kind==='return')detail+=`<path d="M63 46C69 24 48 7 22 12" fill="none" stroke="#ffe289" stroke-width="3"/>`;
 if(kind==='fire')detail=`<path d="M18 39c-2 9-12 12-10 21 2 10 18 11 22 1 4-9-4-15-6-20 0 8-6 11-6-2Z" fill="#ffbd46" stroke="#a95129" stroke-width="2"/><path d="M19 53c-8 8-4 13 1 12s7-7-1-12Z" fill="#fff1a1"/>`;
 return `<svg class="weapon-icon" data-icon="${kind==='bow'?'bow':'sword'}" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><ellipse cx="36" cy="66" rx="23" ry="4" fill="#0c2735" opacity=".2"/>${kind==='bow'?bow:sword}${detail}</svg>`;
}
