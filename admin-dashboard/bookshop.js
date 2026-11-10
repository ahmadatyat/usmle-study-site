/* Uses the console's verified session; database RLS independently enforces owner access. */
(() => {
 'use strict';
 const root=document.getElementById('bookshop-admin');
 let generation=0;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;};
 const field=(form,title,name,value='',type='text')=>{const label=el('label',title),input=el('input');input.name=name;input.type=type;if(type==='checkbox'){input.checked=Boolean(value);label.className='check';}else input.value=value??'';label.append(input);form.append(label);return input;};
 const button=(form,title)=>{const node=el('button',title,'primary');node.type='submit';form.append(node);return node;};
 function clear(){generation++;root.replaceChildren();}
 async function load(client){
  const version=++generation;
  root.replaceChildren(el('h2','Bookshelf'),el('p','Loading catalog and orders…'));
  const [catalog,settings,orders]=await Promise.all([client.from('bookshop_catalog').select('*').order('id'),client.from('bookshop_settings').select('payment_instructions').single(),client.from('bookshop_orders').select('*').order('created_at',{ascending:false}).limit(100)]);
  if(version!==generation)return;
  root.replaceChildren(el('h2','Bookshelf'));
  const feedback=el('p','','muted');feedback.setAttribute('role','status');root.append(feedback);
  if(catalog.error||settings.error||orders.error){feedback.textContent='Could not load books and orders.';const retry=el('button','Retry','secondary');retry.onclick=()=>void load(client);root.append(retry);return;}
  const link=el('a','Open customer bookshelf ↗');link.href='../bookshelf/';link.target='_blank';link.rel='noopener noreferrer';root.append(link);
  async function save(form,action){
   if(form.dataset.busy)return;
   form.dataset.busy='1';const submit=form.querySelector('button[type=submit]');submit.disabled=true;feedback.textContent='Saving…';
   try{const result=await action();if(version!==generation)return;if(result.error)throw Error(result.error.message);await load(client);}
   catch(error){if(version===generation)feedback.textContent=`Could not save: ${error.message}`;}
   finally{delete form.dataset.busy;submit.disabled=false;}
  }
  const payment=el('form',null,'code-form'),label=el('label','Payment instructions'),textarea=el('textarea');textarea.name='instructions';textarea.maxLength=2000;textarea.value=settings.data.payment_instructions;label.append(textarea);payment.append(label);button(payment,'Save payment instructions');root.append(payment);
  payment.onsubmit=e=>{e.preventDefault();void save(payment,()=>client.from('bookshop_settings').update({payment_instructions:textarea.value}).eq('id',true));};
  const books=catalog.data.filter(item=>!item.book_ids.length);
  function editor(item,kind){
   const form=el('form',null,'code-form shop-editor');form.append(el('h3',item?item.title:kind==='bundle'?'Create a bundle':'Add a book'));
   const title=field(form,'Title','title',item?.title);title.required=true;title.maxLength=160;
   const description=field(form,'Description','description',item?.description);description.maxLength=500;
   const bundle=kind==='bundle'||Boolean(item?.book_ids.length);
   if(bundle){const group=el('fieldset',null,'features');group.append(el('legend','Included books'));books.forEach(book=>field(group,book.title,'books',item?.book_ids.includes(book.id),'checkbox').value=book.id);form.append(group);}
   const price=field(form,'Price (JD)','price',item?.price_jd,'number');price.min='0.001';price.max='10000';price.step='0.001';
   field(form,'Available for sale','active',item?.active,'checkbox');button(form,item?'Save changes':bundle?'Create bundle':'Add book');root.append(form);
   form.onsubmit=e=>{e.preventDefault();const data=new FormData(form),included=data.getAll('books');if(bundle&&included.length<2){feedback.textContent='Choose at least two books.';return;}if(data.has('active')&&!price.value){feedback.textContent='Enter a price before enabling orders.';return;}
    const patch={title:title.value.trim(),description:description.value.trim(),book_ids:included,price_jd:price.value?Number(price.value):null,active:data.has('active')};
    void save(form,()=>item?client.from('bookshop_catalog').update(patch).eq('id',item.id).select('id').single():client.from('bookshop_catalog').insert({id:`${bundle?'bundle':'book'}-${crypto.randomUUID()}`,...patch}).select('id').single());
   };
  }
  editor(null,'book');catalog.data.forEach(item=>editor(item));editor(null,'bundle');
  root.append(el('h3','Order inbox'));
  const refresh=el('button','Refresh orders','secondary');refresh.onclick=()=>void load(client);root.append(refresh);
  if(!orders.data.length)root.append(el('p','No orders yet.','muted'));
  for(const order of orders.data){
   const article=el('article',null,'shop-order');article.append(el('h3',`${order.item_title} · ${order.price_jd} JD`),el('p',`${order.buyer_name} · ${order.phone}`),el('p',`${order.id} · ${new Date(order.created_at).toLocaleString()}`));
   const receipt=el('button','Open private receipt','secondary');receipt.onclick=async()=>{receipt.disabled=true;try{const result=await client.storage.from('bookshop-receipts').createSignedUrl(order.receipt_path,60);if(version!==generation)return;if(result.error)throw result.error;const a=el('a');a.href=result.data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';a.click();}catch{if(version===generation)feedback.textContent='Could not open receipt.';}finally{receipt.disabled=false;}};article.append(receipt);
   const form=el('form',null,'code-form'),label=el('label','Order status'),select=el('select');select.name='status';select.setAttribute('aria-label',`Status for ${order.id}`);['pending','confirmed','fulfilled','rejected'].forEach(status=>{const option=el('option',status);option.value=status;select.append(option);});select.value=order.status;label.append(select);form.append(label);button(form,'Save status');form.onsubmit=e=>{e.preventDefault();void save(form,()=>client.from('bookshop_orders').update({status:select.value}).eq('id',order.id).select('id').single());};article.append(form);root.append(article);
  }
 }
 window.BookshopAdmin={load,clear};
})();
