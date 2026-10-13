import {heading} from '../components/view.js';
import {field,action} from '../components/form.js';
import {profileGroups,activeProfileId} from '../domain/profiles.js';
import {saveProfileData,switchProfile} from '../services/profile-data.js';
export function createProfilesModule({store,services}) {
 return {render(state){
  const section=document.createElement('section');section.className='screen';section.append(heading('Profiles','Company details and separate operational data.'));
  const card=document.createElement('div');card.className='workspace-card';
  const label=document.createElement('label');label.textContent='Company profile';
  const select=document.createElement('select');select.className='select';select.setAttribute('aria-label','Company profile');
  const groups=profileGroups(state);for(const profile of groups){const option=document.createElement('option');option.value=profile.id;option.textContent=profile.name+(profile.active?' · Active':'');option.selected=profile.active;select.append(option);}label.append(select);
  const company=field('Company name','profileName',state.profileSettings?.name||groups.find(p=>p.active)?.name||'');
  const email=field('Daily manifest email','manifestEmail',state.profileSettings?.manifestEmail||'',{type:'email'});
  const phone=field('Support WhatsApp number','supportPhone',state.profileSettings?.supportPhone||'');
  const save=action('Save company details','primary'),use=action('Switch company');
  const notice=document.createElement('p');notice.textContent=state.ui?.notice||'';
  save.addEventListener('click',()=>{const current=store.getState(),id=activeProfileId(current),name=company.input.value.trim();if(!name){notice.textContent='Enter a company name.';return;}store.setState({profileSettings:{...current.profileSettings,name,manifestEmail:email.input.value.trim(),supportPhone:phone.input.value.trim(),modifiedAt:new Date().toISOString()},profiles:(current.profiles||[]).map(p=>(groups.find(g=>g.active)?.aliases||[id]).includes(String(p.id))?{...p,name,company:name}:p),ui:{...current.ui,notice:'Company details saved.'}});saveProfileData(store.getState());});
  use.addEventListener('click',async()=>{use.disabled=true;try{await switchProfile({store,services},groups.find(p=>p.id===select.value))}catch(error){store.setState({ui:{...store.getState().ui,notice:error.message}})}finally{use.disabled=false}});
  const actions=document.createElement('div');actions.className='button-row';actions.append(use,save);card.append(label,company.wrap,email.wrap,phone.wrap,actions,notice);section.append(card);return section;
 }};
}
