import { action } from '../components/form.js';
import { profileGroups } from '../domain/profiles.js';
import { switchProfile } from '../services/profile-data.js';
export function renderProfileManager(state, store, services) {
  const card=document.createElement('article');card.className='workspace-card';
  const title=document.createElement('h2');title.textContent='Company Profiles';
  const help=document.createElement('p');help.textContent='Choose the company whose customers, parcels and stock you want to use.';
  card.append(title,help);
  const list=document.createElement('div');list.className='card-list';
  for(const profile of profileGroups(state)){
    const row=document.createElement('div');row.className='card profile-row';
    const copy=document.createElement('div');copy.className='profile-copy';
    const name=document.createElement('strong');name.textContent=profile.name;
    const meta=document.createElement('small');meta.textContent=profile.active?'Active company':'Saved company';copy.append(name,meta);row.append(copy);
    if(!profile.active){const open=action('Switch company','primary');open.addEventListener('click',async()=>{open.disabled=true;try{await switchProfile({store,services},profile)}catch(error){store.setState({ui:{...store.getState().ui,notice:error.message}})}finally{open.disabled=false}});row.append(open);}
    list.append(row);
  }
  card.append(list);return card;
}
