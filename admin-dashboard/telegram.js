(() => {
 'use strict';
 const el=id=>document.getElementById(id);
 let client=null,version=0,data=null,requestId=null,pending=false;
 const form=el('telegram-announcement-form');
 async function call(body){const result=await client.functions.invoke('telegram',{body});if(result.error){let message='Telegram is unavailable. Try again.';try{message=(await result.error.context.json()).error||message;}catch{/* Fixed fallback. */}throw new Error(message);}if(result.data?.error)throw new Error(result.data.error);return result.data;}
 function audience(){const type=el('telegram-audience').value;el('telegram-target-label').hidden=type==='all';el('telegram-target').required=type!=='all';el('telegram-groups').disabled=type==='user';if(type==='user')el('telegram-groups').checked=false;const choices=type==='team'?data?.teams??[]:data?.users??[];el('telegram-target').replaceChildren(...choices.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name??item.email;return option;}));}
 function clear(){version++;client=null;data=null;pending=false;requestId=null;form.reset();el('telegram-message').textContent='';el('telegram-campaigns').replaceChildren();el('telegram-send').disabled=true;el('telegram-health').textContent='';audience();}
 async function load(nextClient){client=nextClient;const current=++version;try{const result=await call({action:'adminStatus'});if(current!==version)return;data=result;el('telegram-health').textContent=result.health?.webhookRegistered?`Telegram ready · @${result.health.botUsername}`:'Telegram backend needs setup.';el('telegram-send').disabled=pending;audience();el('telegram-campaigns').replaceChildren(...result.campaigns.map(c=>{const li=document.createElement('li');li.textContent=`${c.title}: ${c.sent} sent · ${c.pending} queued · ${c.failed} failed · ${c.skipped??0} skipped`;return li;}));}catch(error){if(current===version)el('telegram-message').textContent=error.message;}}
 el('telegram-audience').addEventListener('change',audience);
 form.addEventListener('input',()=>{requestId=null;});
 form.addEventListener('submit',async event=>{event.preventDefault();if(!client||pending)return;const current=version;
 const body={action:'announce',requestId:requestId??crypto.randomUUID(),audience:el('telegram-audience').value,target:el('telegram-audience').value==='all'?null:el('telegram-target').value,title:el('telegram-title').value,text:el('telegram-text').value,inbox:el('telegram-inbox').checked,private:el('telegram-private').checked,groups:el('telegram-groups').checked};
 if(!body.inbox&&!body.private&&!body.groups){el('telegram-message').textContent='Choose at least one delivery channel.';return;}
 requestId=body.requestId;pending=true;el('telegram-send').disabled=true;el('telegram-message').textContent='Sending…';
 try{const result=await call(body);if(current!==version)return;el('telegram-message').textContent=result.alreadyQueued?'This announcement was already queued.':`${result.inbox} inbox messages delivered · ${result.telegram} Telegram messages queued. Allow about one minute.`;form.reset();requestId=null;audience();}catch(error){if(current===version)el('telegram-message').textContent=error.message;}finally{if(current===version){pending=false;el('telegram-send').disabled=false;}}
 });
 el('telegram-refresh').addEventListener('click',()=>{if(client)void load(client);});
 window.TelegramAdmin={load,clear};
})();
