const express=require('express'),crypto=require('crypto'),fs=require('fs'),path=require('path'),nodemailer=require('nodemailer');
const {PORT=3000,ADMIN_EMAIL='',SMTP_HOST,SMTP_PORT=465,SMTP_USER,SMTP_PASS,MAIL_FROM,DATA_DIR='data',NODE_ENV}=process.env;
const ADMIN=ADMIN_EMAIL.trim().toLowerCase();
if(!ADMIN){console.error('Укажите ADMIN_EMAIL в файле .env');process.exit(1)}

/* ---------- хранилище ---------- */
const D=path.resolve(DATA_DIR),UP=path.join(D,'uploads'),SF=path.join(D,'secret');
fs.mkdirSync(UP,{recursive:true});
const J=(f,d)=>{try{return JSON.parse(fs.readFileSync(path.join(D,f),'utf8'))}catch{return d}};
const W=(f,v)=>{const t=path.join(D,f+'.tmp');fs.writeFileSync(t,JSON.stringify(v));fs.renameSync(t,path.join(D,f))};
const SECRET=process.env.SESSION_SECRET||(fs.existsSync(SF)?fs.readFileSync(SF,'utf8'):(()=>{const s=crypto.randomBytes(32).toString('hex');fs.writeFileSync(SF,s,{mode:0o600});return s})());
const hmac=s=>crypto.createHmac('sha256',SECRET).update(s).digest('base64url');
const rid=()=>crypto.randomBytes(4).toString('hex');
const S=(v,n=120)=>typeof v==='string'?v.trim().slice(0,n):'';
const CATS={clothes:1,shoes:1,bags:1,accessories:1};
const STAGES=['Склад в Китае','Отправлен в Россию','Таможня','Сортировка','Пункт выдачи'];
const MEDIA=/^\/uploads\/[\w-]+\.(jpg|png|webp|mp4|webm)$/;
const EMAIL_RE=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const normEmail=v=>{v=S(v,80).toLowerCase();return EMAIL_RE.test(v)?v:null};

/* ---------- почта ---------- */
const tx=SMTP_HOST?nodemailer.createTransport({host:SMTP_HOST,port:+SMTP_PORT,secure:+SMTP_PORT===465,auth:{user:SMTP_USER,pass:SMTP_PASS}}):null;
const mail=(to,subject,text)=>tx?tx.sendMail({from:MAIL_FROM||SMTP_USER,to,subject,text}):Promise.resolve(console.log(`\n[ПИСЬМО → ${to}] ${subject}\n${text}\n`));
const bg=p=>p.catch(e=>console.error('Ошибка отправки письма:',e.message));

/* ---------- сессии ---------- */
const sign=e=>{const p=Buffer.from(JSON.stringify({e,x:Date.now()+30*864e5})).toString('base64url');return p+'.'+hmac(p)};
function me(req){
  const m=(req.headers.cookie||'').match(/(?:^|; )lc=([^;]+)/);if(!m)return null;
  const [p,s]=m[1].split('.');if(!p||!s)return null;
  const a=Buffer.from(hmac(p)),b=Buffer.from(s);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  try{const j=JSON.parse(Buffer.from(p,'base64url'));return j.x>Date.now()&&typeof j.e==='string'?j.e:null}catch{return null}
}
const users=()=>J('users.json',{});
const cur=req=>{const e=me(req);return e?users()[e]||null:null};
const isAdmin=req=>{const u=cur(req);return !!u&&u.email===ADMIN};
const need=(req,res,next)=>isAdmin(req)?next():res.status(401).json({error:'auth'});
const logged=(req,res,next)=>cur(req)?next():res.status(401).json({error:'auth'});
const pubUser=u=>({email:u.email,name:u.name,phone:u.phone,city:u.city,address:u.address,notify:u.notify!==false});
const codes=new Map(),hits=new Map();
function limited(k,n,ms){const t=Date.now(),a=(hits.get(k)||[]).filter(x=>t-x<ms);a.push(t);hits.set(k,a);return a.length>n}

/* ---------- данные ---------- */
const prods=()=>J('products.json',[]).map(p=>({sub:CATS[p.cat]?'':p.cat||'',desc:'',sizes:[],hidden:false,created:'2026-01-01T00:00:00.000Z',...p,
  cat:CATS[p.cat]?p.cat:'clothes',price:+p.price||0,media:p.media||(p.img?[p.img]:[])}));
function cleanProd(b,x){
  const o={...x};
  if('name' in b)o.name=S(b.name,120)||'Без названия';
  if('cat' in b&&CATS[b.cat])o.cat=b.cat;
  if('sub' in b)o.sub=S(b.sub,40);
  if('price' in b)o.price=Math.max(0,Math.round(+b.price||0));
  if('desc' in b)o.desc=S(b.desc,3000);
  if('sizes' in b){const a=Array.isArray(b.sizes)?b.sizes:String(b.sizes||'').split(',');o.sizes=[...new Set(a.map(s=>S(s,12)).filter(Boolean))].slice(0,20)}
  if('media' in b&&Array.isArray(b.media))o.media=b.media.filter(u=>typeof u==='string'&&MEDIA.test(u)).slice(0,12);
  if('hidden' in b)o.hidden=!!b.hidden;
  return o;
}
const settings=()=>({tg:'',wa:'',email:'',phone:'',...J('settings.json',{})});
const cleanCart=a=>(Array.isArray(a)?a:[]).slice(0,50).map(i=>({pid:S(i&&i.pid,16),size:S(i&&i.size,12),qty:Math.min(20,Math.max(1,parseInt(i&&i.qty)||1))})).filter(i=>i.pid);
const cleanFav=a=>(Array.isArray(a)?a:[]).slice(0,200).map(x=>S(x,16)).filter(Boolean);
function newOrder(f){
  const o=J('orders.json',[]);
  const id='LC-'+String(o.reduce((m,i)=>Math.max(m,+i.id.slice(3)||0),0)+1).padStart(6,'0');
  const items=f.items||[];
  const x={id,customer:'',contact:'',email:'',phone:'',address:'',note:'',...f,items,
    item:items.map(i=>i.name+(i.qty>1?' ×'+i.qty:'')).join('; '),total:items.reduce((s,i)=>s+i.price*i.qty,0),stage:0,created:new Date().toISOString()};
  o.unshift(x);W('orders.json',o);return x;
}

/* ---------- приложение ---------- */
const app=express();app.set('trust proxy',1);app.disable('x-powered-by');
app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'});next()});
app.use('/api',(req,res,next)=>{
  if(req.method!=='GET'){
    const o=req.headers.origin;
    if(req.headers['x-requested-with']!=='lc'||(o&&o!==`${req.protocol}://${req.get('host')}`))return res.status(403).json({error:'forbidden'});
  }
  res.set('Cache-Control','no-store');next();
});
app.use('/api',express.json({limit:'200kb'}));

/* вход / регистрация по коду на почту (Gmail, Яндекс, Mail.ru и любая другая) */
app.post('/api/login',async(req,res)=>{
  const id=normEmail((req.body||{}).email);
  if(!id)return res.status(400).json({error:'Введите корректную почту'});
  if(limited('l'+req.ip,10,3600e3))return res.status(429).json({error:'Слишком много попыток, попробуйте позже'});
  const old=codes.get(id);if(old&&Date.now()-old.t<60e3)return res.status(429).json({error:'Код уже отправлен. Подождите минуту.'});
  const code=String(crypto.randomInt(0,1e6)).padStart(6,'0');
  codes.set(id,{h:hmac(code),x:Date.now()+600e3,t:Date.now(),n:0});
  try{await mail(id,'Код входа Logistic Center',`Ваш код: ${code}\nОн действует 10 минут. Если вы не запрашивали вход — проигнорируйте письмо.`);res.json({ok:true,dev:!tx})}
  catch(e){codes.delete(id);console.error('Ошибка отправки письма:',e.message);res.status(500).json({error:'Не удалось отправить письмо. Проверьте адрес или попробуйте позже.'})}
});
app.post('/api/verify',(req,res)=>{
  if(limited('v'+req.ip,20,3600e3))return res.status(429).json({error:'Слишком много попыток, попробуйте позже'});
  const b=req.body||{},email=normEmail(b.email),code=S(String(b.code||''),6),c=codes.get(email);
  if(!c||c.x<Date.now()||c.n>=5){codes.delete(email);return res.status(400).json({error:'Код недействителен. Запросите новый.'})}
  c.n++;
  if(!crypto.timingSafeEqual(Buffer.from(hmac(code)),Buffer.from(c.h)))return res.status(400).json({error:'Неверный код'});
  codes.delete(email);
  const all=users();let u=all[email];
  if(!u)u=all[email]={email,name:S(b.name,40),phone:'',city:'',address:'',notify:true,created:new Date().toISOString(),cart:[],fav:[]};
  else if(!u.name&&b.name)u.name=S(b.name,40);
  W('users.json',all);
  res.set('Set-Cookie',`lc=${sign(email)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${NODE_ENV==='production'?'; Secure':''}`);
  res.json({ok:true});
});
app.post('/api/logout',(req,res)=>{res.set('Set-Cookie','lc=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true})});

/* профиль */
app.get('/api/me',(req,res)=>{const u=cur(req);res.json({user:u?pubUser(u):null,admin:!!u&&u.email===ADMIN,mail:!!tx})});
app.put('/api/me',logged,(req,res)=>{
  const all=users(),u=all[me(req)],b=req.body||{};
  if('name' in b)u.name=S(b.name,40);
  if('phone' in b)u.phone=S(b.phone,20).replace(/[^\d+()\- ]/g,'');
  if('city' in b)u.city=S(b.city,60);
  if('address' in b)u.address=S(b.address,200);
  if('notify' in b)u.notify=!!b.notify;
  W('users.json',all);res.json({ok:true,user:pubUser(u)});
});
app.delete('/api/me',logged,(req,res)=>{
  const e=me(req);if(e===ADMIN)return res.status(400).json({error:'Аккаунт администратора удалить нельзя'});
  const all=users();delete all[e];W('users.json',all);
  res.set('Set-Cookie','lc=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true});
});
app.get('/api/state',logged,(req,res)=>{const u=cur(req);res.json({cart:u.cart||[],fav:u.fav||[]})});
app.put('/api/state',logged,(req,res)=>{
  const all=users(),u=all[me(req)],b=req.body||{};
  u.cart=cleanCart(b.cart);u.fav=cleanFav(b.fav);W('users.json',all);res.json({ok:true});
});

/* настройки сайта (контакты) */
app.get('/api/settings',(q,r)=>r.json(settings()));
app.put('/api/settings',need,(req,res)=>{
  const b=req.body||{},s={
    tg:S(b.tg,80).replace(/^.*t\.me\//,'').replace(/[^\w]/g,'').slice(0,32),
    wa:S(b.wa,20).replace(/\D/g,'').slice(0,15),
    email:normEmail(b.email)||'',
    phone:S(b.phone,20).replace(/[^\d+]/g,'')};
  W('settings.json',s);res.json({ok:true,settings:s});
});

/* товары */
app.get('/api/products',(req,res)=>res.json(isAdmin(req)?prods():prods().filter(p=>!p.hidden)));
app.post('/api/products',need,(req,res)=>{
  const p=prods(),x=cleanProd(req.body||{},{id:rid(),cat:'clothes',name:'Новый товар',price:0,sub:'',desc:'',sizes:[],media:[],hidden:false,created:new Date().toISOString()});
  p.push(x);W('products.json',p);res.json(x);
});
app.put('/api/products/:id',need,(req,res)=>{
  const p=prods(),i=p.findIndex(x=>x.id===req.params.id);
  if(i<0)return res.status(404).json({error:'Не найдено'});
  p[i]=cleanProd(req.body||{},p[i]);W('products.json',p);res.json(p[i]);
});
app.delete('/api/products/:id',need,(req,res)=>{W('products.json',prods().filter(i=>i.id!==req.params.id));res.json({ok:true})});

/* фото и видео */
const EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
app.post('/api/upload',need,express.raw({type:Object.keys(EXT),limit:'60mb'}),(req,res)=>{
  const e=EXT[req.headers['content-type']],b=req.body;
  if(!e||!Buffer.isBuffer(b)||!b.length)return res.status(400).json({error:'Нужен JPG, PNG, WebP, MP4 или WebM'});
  if(!/^(mp4|webm)$/.test(e)&&b.length>10*1048576)return res.status(400).json({error:'Фото — до 10 МБ'});
  const n=crypto.randomBytes(8).toString('hex')+'.'+e;fs.writeFileSync(path.join(UP,n),b);res.json({url:'/uploads/'+n});
});

/* заказы */
app.post('/api/checkout',logged,(req,res)=>{
  const u=cur(req),P=prods(),items=[];
  for(const i of cleanCart((req.body||{}).items)){
    const p=P.find(x=>x.id===i.pid&&!x.hidden);if(!p)continue;
    if(p.sizes.length&&!p.sizes.includes(i.size))return res.status(400).json({error:'Выберите размер: '+p.name});
    items.push({pid:p.id,name:p.name,price:p.price,size:i.size,qty:i.qty});
  }
  if(!items.length)return res.status(400).json({error:'Корзина пуста'});
  const o=newOrder({customer:u.name||u.email,contact:u.phone,email:u.email,phone:u.phone,address:[u.city,u.address].filter(Boolean).join(', '),note:S((req.body||{}).note,500),items});
  const list=items.map(i=>`• ${i.name}${i.size?' ('+i.size+')':''} × ${i.qty} — ${i.price*i.qty} ₽`).join('\n');
  bg(mail(u.email,`Заказ ${o.id} принят`,`Спасибо за заказ!\nНомер для отслеживания: ${o.id}\n\n${list}\nИтого: ${o.total} ₽\n\nМы свяжемся с вами для подтверждения.`));
  bg(mail(ADMIN,`Новый заказ ${o.id}`,`Клиент: ${o.customer} (${o.email}) ${o.phone}\nАдрес: ${o.address}\nКомментарий: ${o.note}\n\n${list}\nИтого: ${o.total} ₽`));
  res.json(o);
});
app.get('/api/my/orders',logged,(req,res)=>{
  const e=me(req);res.json(J('orders.json',[]).filter(o=>o.email===e).map(({id,items,item,total,stage,created,note})=>({id,items,item,total,stage,created,note})));
});
app.get('/api/orders',need,(q,r)=>r.json(J('orders.json',[])));
app.post('/api/orders',need,(req,res)=>{
  const b=req.body||{},item=S(b.item,200);
  if(!S(b.customer)&&!item)return res.status(400).json({error:'Заполните клиента или товар'});
  res.json(newOrder({customer:S(b.customer),contact:S(b.contact),email:normEmail(b.email)||'',phone:S(b.phone,20),note:S(b.note,500),items:item?[{name:item,price:0,qty:1,size:''}]:[]}));
});
app.put('/api/orders/:id',need,(req,res)=>{
  const o=J('orders.json',[]),x=o.find(i=>i.id===req.params.id),b=req.body||{};
  if(!x)return res.status(404).json({error:'Не найдено'});
  for(const k of['customer','contact','phone','address'])if(k in b)x[k]=S(b[k],k==='address'?200:80);
  if('note' in b)x.note=S(b.note,500);
  if('email' in b)x.email=normEmail(b.email)||'';
  const old=x.stage;
  if(Number.isInteger(b.stage)&&b.stage>=0&&b.stage<=4)x.stage=b.stage;
  W('orders.json',o);
  const u=x.email&&users()[x.email];
  if(x.stage!==old&&u&&u.notify!==false)bg(mail(x.email,`Заказ ${x.id}: ${STAGES[x.stage]}`,`Статус вашего заказа ${x.id} изменился.\nСейчас: ${STAGES[x.stage]}`));
  res.json(x);
});
app.delete('/api/orders/:id',need,(req,res)=>{W('orders.json',J('orders.json',[]).filter(i=>i.id!==req.params.id));res.json({ok:true})});
app.post('/api/track',(req,res)=>{
  if(limited('t'+req.ip,30,3600e3))return res.status(429).json({error:'Слишком много запросов'});
  const id=String((req.body||{}).id||'').trim().toUpperCase(),x=J('orders.json',[]).find(i=>i.id===id);
  res.json(x?{stage:x.stage}:{});
});

/* страницы: одна оболочка, маршруты обрабатывает public/app.js */
const jx=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const shell=(req,res)=>{
  const html=fs.readFileSync(path.join(__dirname,'public/index.html'),'utf8');
  res.type('html').send(html.replace('<!--CONTENT-->',`<script>window.__P=${jx(prods().filter(p=>!p.hidden))};window.__S=${jx(settings())}</script>`));
};
app.get(['/','/catalog','/catalog/:c','/product/:id','/favorites','/cart','/profile','/admin'],shell);
app.get('/index.html',(req,res)=>res.redirect('/'));
app.use('/uploads',express.static(UP,{maxAge:'7d'}));
app.use(express.static(path.join(__dirname,'public'),{index:false}));
app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.status===413?'Файл слишком большой':'Ошибка сервера'}));
app.listen(PORT,()=>console.log(`Сайт: http://localhost:${PORT}  (админ: ${ADMIN})${tx?'':'  [SMTP не настроен — коды входа печатаются здесь]'}`));
