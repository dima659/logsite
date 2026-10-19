(()=>{
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATS={clothes:'Одежда',shoes:'Обувь',bags:'Сумки',accessories:'Аксессуары'};
const ST=['Склад в Китае','Отправлен в Россию','Таможня','Сортировка','Пункт выдачи'];
const money=n=>(+n||0).toLocaleString('ru-RU')+' ₽';
const fdate=d=>new Date(d).toLocaleDateString('ru-RU');
const isVid=u=>/\.(mp4|webm)$/i.test(u);
const HEART='<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z"/></svg>';
const BURGER='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
const ls={g(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch{return d}},s(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
let U=null,ADMIN=false,P=window.__P||[],S=window.__S||{},cart=ls.g('lc_cart',[]),fav=ls.g('lc_fav',[]);
const vis=()=>P.filter(p=>!p.hidden),byId=id=>P.find(p=>p.id===id);
const V=()=>$('#view');

async function api(m,u,b){
  const o={method:m,headers:{'X-Requested-With':'lc'}};
  if(b instanceof Blob){o.headers['Content-Type']=b.type;o.body=b}
  else if(b!==undefined){o.headers['Content-Type']='application/json';o.body=JSON.stringify(b)}
  try{const r=await fetch(u,o),j=await r.json().catch(()=>({}));return Array.isArray(j)?j:{ok:r.ok,...j}}
  catch{return{ok:false,error:'Нет связи с сервером'}}
}
function toast(t){let e=$('#toast');if(!e){e=document.createElement('div');e.id='toast';document.body.appendChild(e)}
  e.textContent=t;e.className='show';clearTimeout(toast.t);toast.t=setTimeout(()=>e.className='',2800)}
function modal(html,cls=''){closeModal();const m=document.createElement('div');m.id='mdl';
  m.innerHTML=`<div class="mb"></div><div class="mc ${cls}" role="dialog"><button class="x" data-x aria-label="Закрыть">✕</button>${html}</div>`;
  document.body.appendChild(m);document.body.style.overflow='hidden';
  m.addEventListener('click',e=>{if(e.target.closest('.mb,[data-x]'))closeModal()});return m}
function closeModal(){const m=$('#mdl');if(m){m.remove();document.body.style.overflow=''}}

/* ---------- корзина / избранное ---------- */
let sst;
function saveState(){
  ls.s('lc_cart',cart);ls.s('lc_fav',fav);badges();
  if(U){clearTimeout(sst);sst=setTimeout(()=>api('PUT','/api/state',{cart,fav}),400)}
}
function badges(){
  $('#cartn').textContent=cart.reduce((a,i)=>a+i.qty,0);
  $('#favn').hidden=!fav.length;$('#acc').classList.toggle('on',!!U);
}
async function mergeState(){
  const r=await api('GET','/api/state');if(!r.ok)return;
  fav=[...new Set([...fav,...(r.fav||[])])];
  (r.cart||[]).forEach(i=>{if(!cart.some(c=>c.pid===i.pid&&c.size===i.size))cart.push(i)});
  saveState();
}
async function loadMe(){
  const r=await api('GET','/api/me');U=r.user||null;ADMIN=!!r.admin;
  if(ADMIN){const a=await api('GET','/api/products');if(Array.isArray(a))P=a}
  if(U)await mergeState();else badges();
}

/* ---------- вход / регистрация ---------- */
function authModal(){
  const m=modal(`<h3>Вход или регистрация</h3>
  <p class="mu">Введите почту — отправим одноразовый код. Новый аккаунт создаётся автоматически. Подходит Gmail, Яндекс, Mail.ru и любая другая почта.</p>
  <div id="a1"><input id="ae" type="email" placeholder="you@gmail.com" autocomplete="email">
   <div class="chips">${['@gmail.com','@yandex.ru','@mail.ru'].map(d=>`<button class="chip" data-d="${d}">${d}</button>`).join('')}</div>
   <button class="btn b w" id="asend">Получить код</button></div>
  <div id="a2" hidden><p class="mu">Код отправлен на <b id="aem"></b>. Если письма нет — проверьте «Спам».</p>
   <input id="ac" inputmode="numeric" maxlength="6" placeholder="Код из письма" autocomplete="one-time-code">
   <input id="an" placeholder="Ваше имя (для нового аккаунта)" maxlength="40">
   <button class="btn b w" id="aok">Войти</button><button class="lnk" id="aback">Ввести другую почту</button></div>
  <div class="err" id="aerr"></div>`);
  const err=t=>$('#aerr',m).textContent=t||'',ae=$('#ae',m);ae.focus();
  m.addEventListener('click',e=>{const d=e.target.dataset.d;if(d){ae.value=ae.value.split('@')[0]+d;ae.focus()}});
  const send=async()=>{
    const b=$('#asend',m);b.disabled=true;err();
    const r=await api('POST','/api/login',{email:ae.value});b.disabled=false;
    if(!r.ok)return err(r.error||'Ошибка');
    if(r.dev)toast('SMTP не настроен: код смотрите в консоли сервера');
    $('#a1',m).hidden=true;$('#a2',m).hidden=false;$('#aem',m).textContent=ae.value.trim();$('#ac',m).focus();
  };
  const ok=async()=>{
    const b=$('#aok',m);b.disabled=true;err();
    const r=await api('POST','/api/verify',{email:ae.value,code:$('#ac',m).value,name:$('#an',m).value});b.disabled=false;
    if(!r.ok)return err(r.error||'Ошибка');
    closeModal();await loadMe();toast('Вы вошли');
    if(location.pathname==='/')homeRender();else render();
  };
  $('#asend',m).onclick=send;$('#aok',m).onclick=ok;
  $('#aback',m).onclick=()=>{$('#a2',m).hidden=true;$('#a1',m).hidden=false;err()};
  ae.onkeydown=e=>{if(e.key==='Enter')send()};$('#ac',m).onkeydown=e=>{if(e.key==='Enter')ok()};
}
async function logout(){await api('POST','/api/logout');location.href='/'}

/* ---------- карточки ---------- */
function card(p){
  const im=(p.media||[]).find(u=>!isVid(u)),vd=(p.media||[]).find(isVid);
  const isNew=Date.now()-new Date(p.created)<14*864e5;
  return `<a class="pr" href="/product/${p.id}"><div class="ph${im?' im':''}"${im?` style="background-image:url('${esc(im)}')"`:''}>${isNew?'<span class="new">NEW</span>':''}${!im&&vd?`<video src="${esc(vd)}#t=0.1" muted playsinline preload="metadata"></video>`:''}${!im&&!vd?'<em>Фото скоро</em>':''}<button class="hrt${fav.includes(p.id)?' on':''}" data-fav="${p.id}" aria-label="В избранное">${HEART}</button></div><div class="cat">${CATS[p.cat]}${p.sub?' · '+esc(p.sub):''}</div><div class="nm">${esc(p.name)}</div><div class="pc">${money(p.price)}</div></a>`;
}
const thumb=p=>{const m=(p&&p.media||[]),im=m.find(u=>!isVid(u)),vd=m.find(isVid);return im?`<div class="t" style="background-image:url('${esc(im)}')"></div>`:vd?`<div class="t"><video src="${esc(vd)}#t=0.1" muted playsinline preload="metadata"></video></div>`:'<div class="t"></div>'};
const grid=(a,id='')=>`<div class="grid" ${id}>${a.map(card).join('')}</div>`;
const none=(t,btn)=>`<div class="empty"><p>${t}</p>${btn||''}</div>`;
const crumbs=(...a)=>`<div class="crumbs"><a href="/">Главная</a> / ${a.join(' / ')}</div>`;

/* ---------- главная ---------- */
function homeRender(){
  const a=vis().slice().sort((x,y)=>x.created<y.created?1:-1).slice(0,8);
  $('#pgrid').innerHTML=a.length?a.map(card).join(''):'<p class="mu">Скоро здесь появятся товары</p>';
  $$('#catalog .tile').forEach(t=>t.querySelector('span').textContent=vis().filter(p=>p.cat===t.dataset.cat).length+' шт · Смотреть →');
  const t=[];
  if(S.tg)t.push(`<a href="https://t.me/${esc(S.tg)}" target="_blank" rel="noopener">Telegram: @${esc(S.tg)}</a>`);
  if(S.wa)t.push(`<a href="https://wa.me/${esc(S.wa)}" target="_blank" rel="noopener">WhatsApp: +${esc(S.wa)}</a>`);
  if(S.phone)t.push(`<a href="tel:${esc(S.phone)}">Тел.: ${esc(S.phone)}</a>`);
  if(S.email)t.push(`<a href="mailto:${esc(S.email)}">Почта: ${esc(S.email)}</a>`);
  $('#ct').innerHTML=t.join('')||'<span>Контакты скоро появятся</span>';
}

/* ---------- каталог + фильтр-бургер ---------- */
let F={cat:'all',sub:'',min:'',max:'',q:'',sort:'new'};
function vCatalog(c){
  if(F.cat!==c){F.cat=c;F.sub=''}
  const title=c==='all'?'Каталог':CATS[c];document.title=title+' — Logistic Center';
  V().innerHTML=`<div class="wrap view">${crumbs(c==='all'?'Каталог':`<a href="/catalog">Каталог</a> / ${CATS[c]}`)}
  <div class="sh"><h2>${title}</h2><span class="mu" id="cnt"></span></div>
  <div class="bar"><button class="btn b" id="fbtn">${BURGER} Фильтры</button><input id="cq" placeholder="Поиск по названию" value="${esc(F.q)}">
   <select id="cs">${[['new','Сначала новые'],['asc','Дешевле'],['desc','Дороже']].map(([k,t])=>`<option value="${k}"${F.sort===k?' selected':''}>${t}</option>`).join('')}</select></div>
  <div class="chipsrow">${['all',...Object.keys(CATS)].map(k=>`<a class="${k===c?'on':''}" href="${k==='all'?'/catalog':'/catalog/'+k}">${k==='all'?'Все':CATS[k]}</a>`).join('')}</div>
  <div id="cgrid"></div></div>`;
  $('#cq').oninput=e=>{F.q=e.target.value;list()};
  $('#cs').onchange=e=>{F.sort=e.target.value;list()};
  $('#fbtn').onclick=filterDrawer;list();
}
function list(){
  const q=F.q.toLowerCase();
  const a=vis().filter(p=>(F.cat==='all'||p.cat===F.cat)&&(!F.sub||p.sub===F.sub)&&(!F.min||p.price>=+F.min)&&(!F.max||p.price<=+F.max)&&(!q||(p.name+' '+p.sub).toLowerCase().includes(q)));
  a.sort({new:(x,y)=>x.created<y.created?1:-1,asc:(x,y)=>x.price-y.price,desc:(x,y)=>y.price-x.price}[F.sort]);
  if($('#cnt'))$('#cnt').textContent=a.length+' шт';if($('#fn'))$('#fn').textContent=a.length;
  if($('#cgrid'))$('#cgrid').innerHTML=a.length?grid(a):none('Ничего не найдено. Попробуйте изменить фильтры.','<button class="btn b" id="rst">Сбросить фильтры</button>');
}
function fBody(){
  const inCat=vis().filter(p=>F.cat==='all'||p.cat===F.cat),subs=[...new Set(inCat.map(p=>p.sub).filter(Boolean))];
  return `<div class="fg"><h4>Категория</h4>${['all',...Object.keys(CATS)].map(k=>`<label class="rd"><input type="radio" name="fc" value="${k}"${F.cat===k?' checked':''}> ${k==='all'?'Все товары':CATS[k]}<i>${vis().filter(p=>k==='all'||p.cat===k).length}</i></label>`).join('')}</div>
  ${subs.length?`<div class="fg"><h4>Тип</h4><label class="rd"><input type="radio" name="fs" value=""${!F.sub?' checked':''}> Любой</label>${subs.map(s=>`<label class="rd"><input type="radio" name="fs" value="${esc(s)}"${F.sub===s?' checked':''}> ${esc(s)}<i>${inCat.filter(p=>p.sub===s).length}</i></label>`).join('')}</div>`:''}
  <div class="fg"><h4>Цена, ₽</h4><div class="two"><input id="fmin" type="number" min="0" placeholder="от" value="${esc(F.min)}"><input id="fmax" type="number" min="0" placeholder="до" value="${esc(F.max)}"></div></div>`;
}
function filterDrawer(){
  const m=modal(`<h3>Фильтры</h3><div id="fb">${fBody()}</div><div class="two"><button class="btn" id="frs">Сбросить</button><button class="btn b" data-x>Показать (<span id="fn"></span>)</button></div>`,'dr');
  list();
  m.addEventListener('change',e=>{
    if(e.target.name==='fc'){F.cat=e.target.value;F.sub='';history.replaceState(null,'',F.cat==='all'?'/catalog':'/catalog/'+F.cat);vCatalog(F.cat);$('#fb',m).innerHTML=fBody()}
    if(e.target.name==='fs'){F.sub=e.target.value;list()}
  });
  m.addEventListener('input',e=>{if(e.target.id==='fmin'){F.min=e.target.value;list()}if(e.target.id==='fmax'){F.max=e.target.value;list()}});
  $('#frs',m).onclick=()=>{F={cat:F.cat,sub:'',min:'',max:'',q:'',sort:'new'};vCatalog(F.cat);$('#fb',m).innerHTML=fBody();list()};
}

/* ---------- страница товара ---------- */
function vProduct(id){
  const p=byId(id);
  if(!p)return notFound();
  document.title=p.name+' — Logistic Center';
  const ms=p.media||[],sizes=p.sizes||[];let i=0,size='',qty=1;
  V().innerHTML=`<div class="wrap view">${crumbs(`<a href="/catalog">Каталог</a>`,`<a href="/catalog/${p.cat}">${CATS[p.cat]}</a>`,esc(p.name))}
  <div class="pd"><div class="gal"><div class="stage" id="stg"></div>
   ${ms.length>1?'<button class="gn pv" data-g="-1" aria-label="Назад">‹</button><button class="gn nx" data-g="1" aria-label="Вперёд">›</button>':''}
   ${ms.length>1?`<div class="thumbs">${ms.map((u,k)=>`<button data-t="${k}">${isVid(u)?`<video src="${esc(u)}#t=0.1" muted preload="metadata"></video><b>▶</b>`:`<img src="${esc(u)}" alt="">`}</button>`).join('')}</div>`:''}</div>
  <div class="pi"><div class="cat">${CATS[p.cat]}${p.sub?' · '+esc(p.sub):''}</div><h1>${esc(p.name)}</h1><div class="price">${money(p.price)}</div>
   ${p.hidden?'<p class="err">Товар скрыт с сайта (виден только вам)</p>':''}
   ${p.desc?`<p class="d">${esc(p.desc)}</p>`:''}
   ${sizes.length?`<div class="cat">Размер (<a href="/#sizes" style="text-decoration:underline">таблица размеров</a>)</div><div class="szs" id="szs">${sizes.map(s=>`<button class="sz" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>`:''}
   <div class="buy"><div class="qty"><button data-q="-1">−</button><span id="qv">1</span><button data-q="1">+</button></div>
    <button class="btn b" id="add">В корзину</button><button class="ib hrt2 btn ${fav.includes(p.id)?'o':''}" data-fav="${p.id}" style="width:42px;padding:0" aria-label="В избранное">${HEART}</button></div>
   <div class="info"><span>• Выкупаем у поставщика и проверяем на складе</span><span>• Номер для отслеживания придёт на почту</span><span>• Доставка по России</span></div></div></div>
  <div id="rel"></div></div>`;
  const show=k=>{
    i=(k+ms.length)%ms.length;const u=ms[i],s=$('#stg');
    s.innerHTML=!u?'<span class="mu">Фото скоро появится</span>':isVid(u)?`<video src="${esc(u)}" controls playsinline></video>`:`<img src="${esc(u)}" alt="${esc(p.name)}">`;
    $$('[data-t]').forEach(b=>b.classList.toggle('on',+b.dataset.t===i));
  };
  show(0);
  const rel=vis().filter(x=>x.cat===p.cat&&x.id!==p.id).slice(0,4);
  if(rel.length)$('#rel').innerHTML=`<div class="rel"><h2>Похожие товары</h2>${grid(rel)}</div>`;
  const stg=$('#stg');let x0=null;
  stg.ontouchstart=e=>x0=e.touches[0].clientX;
  stg.ontouchend=e=>{if(x0==null)return;const d=e.changedTouches[0].clientX-x0;if(Math.abs(d)>40)show(i+(d<0?1:-1));x0=null};
  document.onkeydown=e=>{if(ms.length>1&&e.key==='ArrowLeft')show(i-1);if(ms.length>1&&e.key==='ArrowRight')show(i+1)};
  V().onclick=e=>{
    const t=e.target.closest('[data-g],[data-t],[data-s],[data-q],#add');if(!t)return;
    if(t.dataset.g)show(i+ +t.dataset.g);
    else if(t.dataset.t)show(+t.dataset.t);
    else if(t.dataset.s){size=t.dataset.s;$$('.sz').forEach(b=>b.classList.toggle('on',b.dataset.s===size))}
    else if(t.dataset.q){qty=Math.min(20,Math.max(1,qty+ +t.dataset.q));$('#qv').textContent=qty}
    else if(t.id==='add'){
      if(sizes.length&&!size){const z=$('#szs');z.classList.remove('shake');void z.offsetWidth;z.classList.add('shake');return toast('Выберите размер')}
      const c=cart.find(c=>c.pid===p.id&&c.size===size);
      if(c)c.qty=Math.min(20,c.qty+qty);else cart.push({pid:p.id,size,qty});
      saveState();toast('Добавлено в корзину');
    }
  };
}

/* ---------- избранное ---------- */
function vFav(){
  document.title='Избранное — Logistic Center';
  const a=fav.map(byId).filter(p=>p&&!p.hidden);
  V().innerHTML=`<div class="wrap view">${crumbs('Избранное')}<div class="sh"><h2>Избранное</h2></div>
   ${a.length?grid(a):none('Здесь пока пусто. Нажимайте ♥ на товарах, чтобы сохранить их.','<a class="btn b" href="/catalog">В каталог</a>')}</div>`;
}

/* ---------- корзина ---------- */
function vCart(){
  document.title='Корзина — Logistic Center';
  const L=cart.map(i=>({...i,p:byId(i.pid)})).filter(i=>i.p&&!i.p.hidden);
  if(L.length!==cart.length){cart=L.map(({pid,size,qty})=>({pid,size,qty}));saveState()}
  const total=L.reduce((s,i)=>s+i.p.price*i.qty,0);
  V().innerHTML=`<div class="wrap view">${crumbs('Корзина')}<div class="sh"><h2>Корзина</h2></div>
  ${!L.length?none('Корзина пуста.','<a class="btn b" href="/catalog">Перейти в каталог</a>'):
  L.map((i,k)=>`<div class="cl">${thumb(i.p)}<div><a class="nm" href="/product/${i.p.id}">${esc(i.p.name)}</a><div class="mu">${i.size?'Размер: '+esc(i.size)+' · ':''}${money(i.p.price)}</div>
   <div class="qty" style="margin-top:8px"><button data-c="${k}|-1">−</button><span>${i.qty}</span><button data-c="${k}|1">+</button></div></div>
   <div class="r"><div class="pc">${money(i.p.price*i.qty)}</div><button class="rm" data-rm="${k}">Удалить</button></div></div>`).join('')+
  `<div class="sum"><div class="tot"><span>Итого</span><span>${money(total)}</span></div>
   <p class="mu" style="margin:0">Цена указана за вещи; доставку и итоговую стоимость мы подтвердим при связи с вами.</p>
   <textarea id="note" rows="3" maxlength="500" placeholder="Комментарий: удобный мессенджер, пункт выдачи, пожелания"></textarea>
   <button class="btn b w" id="co">${U?'Оформить заказ':'Войти и оформить заказ'}</button><div class="err" id="cerr"></div></div>`}</div>`;
  V().onclick=async e=>{
    const t=e.target.closest('[data-c],[data-rm],#co');if(!t)return;
    if(t.dataset.c){const[k,d]=t.dataset.c.split('|'),c=cart.find(x=>x.pid===L[k].pid&&x.size===L[k].size);c.qty=Math.min(20,Math.max(1,c.qty+ +d));saveState();vCart()}
    else if(t.dataset.rm){const l=L[t.dataset.rm];cart=cart.filter(x=>!(x.pid===l.pid&&x.size===l.size));saveState();vCart()}
    else if(t.id==='co'){
      if(!U)return authModal();
      t.disabled=true;const r=await api('POST','/api/checkout',{items:cart,note:$('#note').value});t.disabled=false;
      if(!r.ok)return $('#cerr').textContent=r.error||'Ошибка';
      cart=[];saveState();toast('Заказ '+r.id+' оформлен! Подтверждение отправлено на почту');go('/profile');
    }
  };
}

/* ---------- профиль ---------- */
async function vProfile(){
  document.title='Профиль — Logistic Center';
  if(!U){V().innerHTML=`<div class="wrap view">${none('Войдите, чтобы открыть профиль.','<button class="btn b" id="lg">Войти</button>')}</div>`;$('#lg').onclick=authModal;return authModal()}
  let tab='o';
  const draw=async()=>{
    let body='';
    if(tab==='o'){
      const o=await api('GET','/api/my/orders');
      body=Array.isArray(o)&&o.length?o.map(x=>`<div class="oc"><div class="h"><b>${x.id}</b><span class="mu">${fdate(x.created)}${x.total?' · '+money(x.total):''}</span></div>
        <ul>${(x.items&&x.items.length?x.items.map(i=>`<li>${esc(i.name)}${i.size?' ('+esc(i.size)+')':''} × ${i.qty}</li>`):[`<li>${esc(x.item||'Посылка')}</li>`]).join('')}</ul>
        <div class="seg">${ST.map((s,k)=>`<i class="${k<=x.stage?'on':''}"></i>`).join('')}</div><b style="font-size:12px">${ST[x.stage]}</b></div>`).join(''):none('Заказов пока нет.','<a class="btn b" href="/catalog">Выбрать вещи</a>');
    }else body=`<div class="fm" style="max-width:520px"><label>Имя<input id="sn" value="${esc(U.name)}" maxlength="40"></label>
      <label>Почта<input value="${esc(U.email)}" disabled></label><label>Телефон<input id="sp" value="${esc(U.phone)}" placeholder="+7 900 000-00-00" maxlength="20"></label>
      <div class="two"><label>Город<input id="sc" value="${esc(U.city)}" maxlength="60"></label><label>Адрес / пункт выдачи<input id="sa" value="${esc(U.address)}" maxlength="200"></label></div>
      <label class="ck"><input type="checkbox" id="snf"${U.notify?' checked':''}> Присылать на почту статусы заказов</label>
      <div class="fl"><button class="btn b" id="ssv">Сохранить</button><button class="btn" id="slo">Выйти</button><button class="btn red" id="sdel">Удалить аккаунт</button></div><div class="err" id="serr"></div></div>`;
    $('#pb').innerHTML=body;
    $$('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  };
  V().innerHTML=`<div class="wrap view">${crumbs('Профиль')}
  <div class="pcard"><div class="av">${esc((U.name||U.email)[0].toUpperCase())}</div><div><h2>${esc(U.name||'Без имени')}</h2><div class="mu" style="color:#000">${esc(U.email)}</div><span class="tag">${ADMIN?'Администратор':'Покупатель'}</span></div>
   <div class="acts">${ADMIN?'<a class="btn b" href="/admin">Админ-панель →</a>':''}<a class="btn" href="/favorites">Избранное (${fav.length})</a><a class="btn" href="/cart">Корзина</a></div></div>
  <div class="tabs"><button data-tab="o">Мои заказы</button><button data-tab="s">Настройки</button></div><div id="pb"></div></div>`;
  V().onclick=async e=>{
    const t=e.target.closest('[data-tab],#ssv,#slo,#sdel');if(!t)return;
    if(t.dataset.tab){tab=t.dataset.tab;draw()}
    else if(t.id==='slo')logout();
    else if(t.id==='ssv'){
      const r=await api('PUT','/api/me',{name:$('#sn').value,phone:$('#sp').value,city:$('#sc').value,address:$('#sa').value,notify:$('#snf').checked});
      if(r.ok){U=r.user;toast('Сохранено');vProfile()}else $('#serr').textContent=r.error||'Ошибка';
    }else if(t.id==='sdel'&&confirm('Удалить аккаунт? Это действие нельзя отменить.')){
      const r=await api('DELETE','/api/me');if(r.ok)location.href='/';else $('#serr').textContent=r.error||'Ошибка';
    }
  };
  draw();
}

/* ---------- админ-панель ---------- */
async function vAdmin(){
  document.title='Админ-панель — Logistic Center';
  if(!ADMIN){V().innerHTML=`<div class="wrap view">${none('Доступ только для администратора.','<a class="btn b" href="/">На главную</a>')}</div>`;if(!U)authModal();return}
  let tab=vAdmin.tab||'p',orders=[],ofil='all';
  const mini=p=>thumb(p);
  const drawP=()=>`<div class="fl"><button class="btn b" id="newp">+ Добавить товар</button><span class="mu">Всего: ${P.length}</span></div>`+
    (P.length?P.slice().sort((a,b)=>a.created<b.created?1:-1).map(p=>`<div class="ar ${p.hidden?'hid':''}">${mini(p)}<div><b>${esc(p.name)}</b><div class="mu">${CATS[p.cat]}${p.sub?' · '+esc(p.sub):''} · ${money(p.price)} · ${(p.media||[]).length} медиа${p.hidden?' · скрыт':''}</div></div>
     <div class="b"><a class="btn sm" href="/product/${p.id}">Открыть</a><button class="btn sm o" data-ep="${p.id}">Править</button><button class="btn sm red" data-dp="${p.id}">Удалить</button></div></div>`).join(''):none('Товаров нет. Добавьте первый.'));
  const drawO=()=>{
    const a=orders.filter(o=>ofil==='all'||o.stage===+ofil);
    return `<div class="fl"><button class="btn b" id="newo">+ Новая посылка</button><select id="of"><option value="all">Все статусы</option>${ST.map((s,k)=>`<option value="${k}"${ofil==k?' selected':''}>${s}</option>`).join('')}</select><span class="mu">${a.length} шт</span></div>`+
    (a.length?a.map(o=>`<div class="oc"><div class="h"><b>${o.id}</b><span class="mu">${fdate(o.created)}${o.total?' · '+money(o.total):''}</span></div>
     <div style="font-size:13px"><b>${esc(o.customer||'—')}</b> · ${esc(o.contact||o.phone||'')} · ${esc(o.email||'')}${o.address?'<br>'+esc(o.address):''}</div>
     <ul>${(o.items&&o.items.length?o.items.map(i=>`<li>${esc(i.name)}${i.size?' ('+esc(i.size)+')':''} × ${i.qty}${i.price?' — '+money(i.price*i.qty):''}</li>`):[`<li>${esc(o.item||'—')}</li>`]).join('')}</ul>
     ${o.note?`<div class="mu">Комментарий: ${esc(o.note)}</div>`:''}
     <div class="fl" style="margin:10px 0 0"><select data-st="${o.id}">${ST.map((s,k)=>`<option value="${k}"${o.stage===k?' selected':''}>${k+1}. ${s}</option>`).join('')}</select><button class="btn sm" data-eo="${o.id}">Править</button><button class="btn sm red" data-do="${o.id}">Удалить</button></div></div>`).join(''):none('Посылок нет.'));
  };
  const drawS=()=>`<div class="fm" style="max-width:480px"><p class="mu">Эти контакты показываются внизу сайта.</p>
    <label>Telegram (ник)<input id="s1" value="${esc(S.tg)}" placeholder="username"></label><label>WhatsApp (номер с кодом страны)<input id="s2" value="${esc(S.wa)}" placeholder="79001234567"></label>
    <label>Телефон<input id="s3" value="${esc(S.phone)}" placeholder="+79001234567"></label><label>Почта для связи<input id="s4" value="${esc(S.email)}" placeholder="shop@example.com"></label>
    <button class="btn b" id="ssv">Сохранить</button></div>`;
  const draw=async()=>{
    if(tab==='o'&&!orders.length){const r=await api('GET','/api/orders');if(Array.isArray(r))orders=r}
    $('#ab').innerHTML=tab==='p'?drawP():tab==='o'?drawO():drawS();
    $$('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  };
  const reload=async()=>{const r=await api('GET','/api/products');if(Array.isArray(r))P=r;const o=await api('GET','/api/orders');if(Array.isArray(o))orders=o;draw()};
  V().innerHTML=`<div class="wrap view">${crumbs('Админ-панель')}<div class="sh"><h2>Админ-панель</h2><a class="btn" href="/profile">Мой профиль</a></div>
   <div class="tabs"><button data-tab="p">Товары</button><button data-tab="o">Заказы и посылки</button><button data-tab="s">Контакты сайта</button></div><div id="ab"></div></div>`;
  V().onclick=async e=>{
    const t=e.target.closest('[data-tab],[data-ep],[data-dp],[data-eo],[data-do],#newp,#newo,#ssv');if(!t)return;
    if(t.dataset.tab){tab=vAdmin.tab=t.dataset.tab;draw()}
    else if(t.id==='newp')prodEditor(null,reload);
    else if(t.dataset.ep)prodEditor(byId(t.dataset.ep),reload);
    else if(t.dataset.dp){if(confirm('Удалить товар?')){await api('DELETE','/api/products/'+t.dataset.dp);reload();toast('Удалено')}}
    else if(t.id==='newo')orderEditor(null,reload);
    else if(t.dataset.eo)orderEditor(orders.find(o=>o.id===t.dataset.eo),reload);
    else if(t.dataset.do){if(confirm('Удалить посылку?')){await api('DELETE','/api/orders/'+t.dataset.do);reload()}}
    else if(t.id==='ssv'){
      const r=await api('PUT','/api/settings',{tg:$('#s1').value,wa:$('#s2').value,phone:$('#s3').value,email:$('#s4').value});
      if(r.ok){S=r.settings;toast('Сохранено')}else toast(r.error||'Ошибка');
    }
  };
  V().onchange=async e=>{
    if(e.target.id==='of'){ofil=e.target.value;draw()}
    if(e.target.dataset.st){const r=await api('PUT','/api/orders/'+e.target.dataset.st,{stage:+e.target.value});
      if(r.ok){const o=orders.find(o=>o.id===r.id);if(o)o.stage=r.stage;toast('Статус обновлён')}}
  };
  draw();
}
function prodEditor(p,done){
  const n=!p;p=p||{name:'',cat:'clothes',sub:'',price:'',desc:'',sizes:[],media:[],hidden:false};let media=[...(p.media||[])];
  const m=modal(`<h3>${n?'Новый товар':'Редактировать товар'}</h3><div class="fm">
   <label>Название<input id="e_n" value="${esc(p.name)}" maxlength="120"></label>
   <div class="two"><label>Категория<select id="e_c">${Object.entries(CATS).map(([k,t])=>`<option value="${k}"${p.cat===k?' selected':''}>${t}</option>`).join('')}</select></label>
   <label>Тип (для фильтра)<input id="e_s" value="${esc(p.sub)}" maxlength="40" placeholder="Худи, кроссовки, рюкзак…"></label></div>
   <div class="two"><label>Цена, ₽<input id="e_p" type="number" min="0" value="${esc(p.price)}"></label><label>Размеры через запятую<input id="e_z" value="${esc((p.sizes||[]).join(', '))}" placeholder="S, M, L, XL"></label></div>
   <label>Описание<textarea id="e_d" rows="4" maxlength="3000">${esc(p.desc)}</textarea></label>
   <div class="fg"><h4>Фото и видео — можно несколько, первое = обложка</h4><div class="mm" id="mm"></div>
    <label class="up">+ Загрузить файлы<input type="file" id="e_f" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden></label><div class="mu" id="e_u" style="margin-top:6px"></div></div>
   <label class="ck"><input type="checkbox" id="e_h"${p.hidden?' checked':''}> Скрыть товар с сайта</label>
   <button class="btn b w" id="e_sv">Сохранить</button><div class="err" id="e_err"></div></div>`,'big');
  const dm=()=>{$('#mm',m).innerHTML=media.map((u,i)=>`<div class="mi">${isVid(u)?`<video src="${esc(u)}#t=0.1" muted preload="metadata"></video>`:`<img src="${esc(u)}" alt="">`}<div class="mt">${i?`<button data-first="${i}" title="Сделать обложкой">★</button>`:'<b>обложка</b>'}<button data-del="${i}" title="Убрать">✕</button></div></div>`).join('')};
  dm();
  m.addEventListener('click',e=>{
    const f=e.target.closest('[data-first]'),d=e.target.closest('[data-del]');
    if(f){media.unshift(...media.splice(+f.dataset.first,1));dm()}
    if(d){media.splice(+d.dataset.del,1);dm()}
  });
  $('#e_f',m).onchange=async e=>{
    const fs=[...e.target.files],u=$('#e_u',m);let k=0;
    for(const f of fs){
      k++;u.textContent=`Загрузка ${k} из ${fs.length}: ${f.name}…`;
      if(media.length>=12){u.textContent='Максимум 12 файлов';break}
      const r=await api('POST','/api/upload',f);
      if(r.ok&&r.url){media.push(r.url);dm()}else{u.textContent='Ошибка: '+(r.error||'не удалось загрузить '+f.name+' (формат: JPG, PNG, WebP, MP4, WebM)');return}
    }
    u.textContent='Готово — не забудьте нажать «Сохранить»';e.target.value='';
  };
  $('#e_sv',m).onclick=async()=>{
    const body={name:$('#e_n',m).value,cat:$('#e_c',m).value,sub:$('#e_s',m).value,price:$('#e_p',m).value,sizes:$('#e_z',m).value,desc:$('#e_d',m).value,media,hidden:$('#e_h',m).checked};
    if(!body.name.trim())return $('#e_err',m).textContent='Введите название';
    const r=n?await api('POST','/api/products',body):await api('PUT','/api/products/'+p.id,body);
    if(!r.ok)return $('#e_err',m).textContent=r.error||'Ошибка';
    closeModal();toast('Товар сохранён');done();
  };
}
function orderEditor(o,done){
  const n=!o;o=o||{};
  const m=modal(`<h3>${n?'Новая посылка':'Посылка '+o.id}</h3><div class="fm">
   <label>Клиент<input id="o_c" value="${esc(o.customer||'')}" maxlength="80"></label>
   <div class="two"><label>Контакт (Telegram/WhatsApp)<input id="o_k" value="${esc(o.contact||'')}"></label><label>Телефон<input id="o_p" value="${esc(o.phone||'')}"></label></div>
   <label>Почта клиента (на неё приходят статусы)<input id="o_e" type="email" value="${esc(o.email||'')}"></label>
   ${n?'<label>Товар<input id="o_i" maxlength="200" placeholder="Что в посылке"></label>':`<label>Адрес<input id="o_a" value="${esc(o.address||'')}"></label>`}
   <label>Комментарий<textarea id="o_n" rows="2" maxlength="500">${esc(o.note||'')}</textarea></label>
   <button class="btn b w" id="o_sv">Сохранить</button><div class="err" id="o_err"></div></div>`,'big');
  $('#o_sv',m).onclick=async()=>{
    const b={customer:$('#o_c',m).value,contact:$('#o_k',m).value,phone:$('#o_p',m).value,email:$('#o_e',m).value,note:$('#o_n',m).value};
    if(n)b.item=$('#o_i',m).value;else b.address=$('#o_a',m).value;
    const r=n?await api('POST','/api/orders',b):await api('PUT','/api/orders/'+o.id,b);
    if(!r.ok)return $('#o_err',m).textContent=r.error||'Ошибка';
    closeModal();toast(n?'Создана посылка '+r.id:'Сохранено');done();
  };
}

/* ---------- маршрутизация ---------- */
function notFound(){document.title='Не найдено';V().innerHTML=`<div class="wrap view">${none('Страница или товар не найдены.','<a class="btn b" href="/catalog">В каталог</a>')}</div>`}
function go(u,replace){
  const url=new URL(u,location.origin);if(url.origin!==location.origin){location.href=u;return}
  const same=url.pathname===location.pathname;
  history[replace?'replaceState':'pushState'](null,'',url.pathname+url.search+url.hash);
  render(same);
}
function render(keep){
  closeModal();document.onkeydown=null;
  const p=location.pathname,v=V();v.onclick=v.onchange=null;let m;
  $('#home').hidden=p!=='/';v.hidden=p==='/';
  if(p==='/'){document.title='Logistic Center — вещи из Китая до вашей двери';v.innerHTML=''}
  else if(p==='/catalog'||(m=p.match(/^\/catalog\/(\w+)$/)))vCatalog(m&&CATS[m[1]]?m[1]:'all');
  else if(m=p.match(/^\/product\/([\w-]+)$/))vProduct(m[1]);
  else if(p==='/favorites')vFav();else if(p==='/cart')vCart();
  else if(p==='/profile')vProfile();else if(p==='/admin')vAdmin();else notFound();
  const h=location.hash;
  if(h&&$(h))$(h).scrollIntoView({behavior:'smooth'});else if(!keep)scrollTo(0,0);
}
addEventListener('popstate',()=>render());
document.addEventListener('click',e=>{
  const f=e.target.closest('[data-fav]');
  if(f){
    e.preventDefault();e.stopPropagation();const id=f.dataset.fav;
    fav=fav.includes(id)?fav.filter(x=>x!==id):[...fav,id];saveState();
    $$(`[data-fav="${id}"]`).forEach(b=>{b.classList.toggle('on',fav.includes(id));if(b.classList.contains('hrt2'))b.classList.toggle('o',fav.includes(id))});
    if(location.pathname==='/favorites')vFav();return;
  }
  if($('#rst')&&e.target.id==='rst'){F={cat:F.cat,sub:'',min:'',max:'',q:'',sort:'new'};return vCatalog(F.cat)}
  const a=e.target.closest('a[href]');
  if(!a||a.target||e.metaKey||e.ctrlKey||e.shiftKey||e.button||a.hasAttribute('download'))return;
  const h=a.getAttribute('href');
  if(!h||/^(https?:|mailto:|tel:)/.test(h)&&new URL(h,location.href).origin!==location.origin)return;
  e.preventDefault();closeModal();go(h);
  if(a.id==='srch')setTimeout(()=>$('#cq')&&$('#cq').focus(),0);
});
$('#acc').onclick=()=>U?go('/profile'):authModal();
$('#burger').onclick=()=>modal(`<h3>Меню</h3><div class="menu">
  <a href="/catalog">Весь каталог</a>${Object.entries(CATS).map(([k,t])=>`<a href="/catalog/${k}">${t}</a>`).join('')}
  <a href="/#new">Новинки</a><a href="/#how">Как заказать</a><a href="/#track">Отследить заказ</a><a href="/#sizes">Размеры</a><a href="/#contacts">Контакты</a>
  <a href="/favorites">Избранное</a><a href="/cart">Корзина</a>
  ${U?`<a href="/profile">Профиль</a>${ADMIN?'<a href="/admin">Админ-панель</a>':''}`:'<button id="mlg">Войти / регистрация</button>'}</div>`,'dr l');
document.addEventListener('click',e=>{if(e.target.id==='mlg'){closeModal();authModal()}});

/* ---------- старт ---------- */
badges();
(async()=>{
  if(location.pathname==='/'){render(true);homeRender();await loadMe();if(ADMIN)homeRender()}
  else{await loadMe();homeRender();render(true)}
})();
})();
