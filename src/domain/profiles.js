const normalize = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
export function activeProfileId(state) { return String(state.workspace?.profileId || state.activeProfileId || 'ps_default'); }
export function profileGroups(state) {
  const active=activeProfileId(state),byId=new Map();
  for(const item of state.profiles||[]){if(!item?.id)continue;const id=String(item.id).trim();if(!id)continue;const old=byId.get(id);byId.set(id,{...old,...item,id});}
  if(!byId.has(active))byId.set(active,{id:active,name:state.profileSettings?.name||active});
  const groups=new Map();
  for(const profile of byId.values()){
    const name=String(profile.name||profile.company||profile.id).trim().replace(/\s+/g,' '),key=normalize(name);
    if(!groups.has(key))groups.set(key,{name,aliases:[]});groups.get(key).aliases.push(profile);
  }
  return [...groups.values()].map(group=>{
    const current=group.aliases.find(p=>p.id===active);
    const primary=current||group.aliases.find(p=>normalize(p.id)===normalize(group.name))||group.aliases.slice().sort((a,b)=>String(b.modifiedAt||b.createdAt||'').localeCompare(String(a.modifiedAt||a.createdAt||'')))[0];
    return {...primary,name:group.name,aliases:group.aliases.map(p=>p.id),active:Boolean(current)};
  }).sort((a,b)=>Number(b.active)-Number(a.active)||a.name.localeCompare(b.name));
}
