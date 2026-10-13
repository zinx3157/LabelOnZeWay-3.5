import { activeProfileId } from '../domain/profiles.js';
export const PROFILE_COLLECTIONS = ['customers','parcels','archive','claims','inventory','stockMovements','settlements'];
const key=(workspaceId,profileId)=>`lz35.profileData:${workspaceId||'local'}:${profileId}`;
export function saveProfileData(state) {
  const data={settings:state.profileSettings||{},savedAt:new Date().toISOString()};
  for(const name of PROFILE_COLLECTIONS)data[name]=state[name]||[];
  localStorage.setItem(key(state.workspace?.id,activeProfileId(state)),JSON.stringify(data));
}
export async function switchProfile({store,services},profile) {
  const id=String(profile?.id||'').trim();if(!id)throw Error('Choose a company profile.');
  const before=store.getState();if(id===activeProfileId(before))return{status:'unchanged'};
  saveProfileData(before);
  // Finish sending the old company before changing the sync destination.
  if(before.session&&before.workspace?.id&&services?.sync)await services.sync.pushSnapshot({reason:'profile-switch'});
  const current=store.getState();if(activeProfileId(current)!==activeProfileId(before))throw Error('Profile changed while switching; try again.');
  let saved={};try{saved=JSON.parse(localStorage.getItem(key(before.workspace?.id,id))||'{}')}catch{/* retain the saved source profile */}
  const patch={};for(const name of PROFILE_COLLECTIONS)patch[name]=Array.isArray(saved[name])?saved[name]:[];
  patch.profileSettings=saved.settings&&typeof saved.settings==='object'?saved.settings:{name:profile.name||profile.company||id,manifestEmail:''};
  patch.activeProfileId=id;patch.workspace=before.workspace?{...before.workspace,profileId:id}:null;
  patch.labelDraft={step:1,customerId:null,customer:{name:'',phone:'',address:''},parcel:{qty:1,unitPrice:0,collect:0,deliveryCharge:0,notes:''}};
  patch.sync={status:before.session?'switching':'local-only',conflict:false};
  patch.ui={...current.ui,notice:`Active company: ${profile.name||id}`};
  store.setState(patch);localStorage.setItem('lzb2.profile',id);localStorage.setItem('lz.profile',id);
  if(before.session&&before.workspace?.id&&services?.sync)await services.sync.pullSnapshot();
  return{status:'switched',profileId:id};
}
