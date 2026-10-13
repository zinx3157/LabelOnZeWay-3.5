const KEYS = ['customers','parcels','archive','claims','inventory','stockMovements','settlements','profiles','profileSettings'];
const scope = s => s.session?.user?.id && s.workspace?.id ? `${s.session.user.id}:${s.workspace.id}:${s.workspace.profileId || 'ps_default'}` : '';
const signature = s => JSON.stringify(KEYS.map(k => s[k]));
export function startAutoSync({store,sync,intervalMs=10000,debounceMs=700,timers=globalThis}) {
  let previous=store.getState(),currentScope=scope(previous),lastSignature=signature(previous),dirty=true,busy=false,stopped=false,stamping=false,timer=null;
  function schedule(){if(timer)timers.clearTimeout(timer);timer=timers.setTimeout(()=>void run(),debounceMs);}
  const unsubscribe=store.subscribe(state=>{
    const nextScope=scope(state),changed=signature(state)!==lastSignature;
    if(!stamping&&changed&&!sync.isApplying()&&nextScope===currentScope){
      const now=new Date().toISOString(),patch={};
      for(const key of KEYS){if(JSON.stringify(state[key])===JSON.stringify(previous[key]))continue;if(Array.isArray(state[key])){const old=new Map((previous[key]||[]).map(i=>[i.id,i]));patch[key]=state[key].map(i=>JSON.stringify(i)!==JSON.stringify(old.get(i.id))?{...i,modifiedAt:now}:i);}else if(key==='profileSettings')patch[key]={...state[key],modifiedAt:now};}
      if(Object.keys(patch).length){stamping=true;try{store.setState(patch);}finally{stamping=false;}return;}
    }
    if(nextScope!==currentScope){currentScope=nextScope;dirty=true;}
    else if(changed&&!sync.isApplying()){sync.captureChanges(previous,state);dirty=true;sync.queue('local-change');}
    previous=state;lastSignature=signature(state);
    if(changed&&!sync.isApplying())schedule();
    if(nextScope&&dirty&&!busy)schedule();
  });
  async function run(){
    if(stopped||busy)return;const state=store.getState();if(!scope(state)||state.online===false)return;
    busy=true;const startedScope=scope(state);
    try {
      if(dirty||sync.pending()){dirty=false;await sync.pushSnapshot({reason:'automatic'});}
      if(scope(store.getState())===startedScope&&!dirty)await sync.pullSnapshot();
    } catch(error){dirty=true;store.setState({sync:{...store.getState().sync,status:'error',message:error?.message||'Automatic sync failed'}});}
    finally{busy=false;}
  }
  const interval=timers.setInterval(()=>void run(),intervalMs);
  const resume=()=>void run();globalThis.addEventListener?.('focus',resume);globalThis.addEventListener?.('online',resume);
  const visible=()=>{if(globalThis.document?.visibilityState==='visible')void run()};globalThis.document?.addEventListener?.('visibilitychange',visible);
  schedule();
  return {run,stop(){stopped=true;unsubscribe();timers.clearInterval(interval);if(timer)timers.clearTimeout(timer);globalThis.removeEventListener?.('focus',resume);globalThis.removeEventListener?.('online',resume);globalThis.document?.removeEventListener?.('visibilitychange',visible);}};
}
