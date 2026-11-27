(()=>{
'use strict';
const cfg=window.CLASSY_CONFIG||{},ready=cfg.SUPABASE_URL?.startsWith('http')&&cfg.SUPABASE_ANON_KEY&&window.supabase;
const db=ready?window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const demoProducts=[
{id:'d1',name:'قميص بولو كلاسي',category:'الرجالية',price:139,old_price:199,image_url:'assets/product-1.jpg',sizes:['S','M','L','XL'],colors:['أسود','أبيض'],is_active:true},
{id:'d2',name:'جاكيت عصري',category:'الرجالية',price:299,old_price:399,image_url:'assets/product-2.jpg',sizes:['M','L','XL'],colors:['أسود','كحلي'],is_active:true},
{id:'d3',name:'قميص فاخر',category:'الرجالية',price:129,old_price:199,image_url:'assets/product-3.jpg',sizes:['S','M','L'],colors:['أبيض','أزرق'],is_active:true},
{id:'d4',name:'بنطال كلاسي',category:'الرجالية',price:149,old_price:219,image_url:'assets/product-4.jpg',sizes:['30','32','34','36'],colors:['أسود','رمادي'],is_active:true}];
let products=[],categories=[],banners=[],reels=[],looks=[],cart=read('classy_cart',[]).map(x=>({...x,key:x.key||String(x.id),size:x.size||'',color:x.color||''})),wishlist=read('classy_wishlist',[]),bannerIndex=0,bannerTimer=[],onlyWishlist=false;
const $=id=>document.getElementById(id),money=n=>`${Number(n||0).toLocaleString('en-US')} SAR`;
function read(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}
function toast(msg){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fallbackData(){categories=[{name:'الرجالية',slug:'men',sort_order:1},{name:'الأطفال',slug:'boys',sort_order:2},{name:'الأحذية',slug:'shoes',sort_order:3},{name:'الإكسسوارات',slug:'accessories',sort_order:4},{name:'العطور',slug:'fragrance',sort_order:5}];products=demoProducts;banners=[{title:'أناقة تتحدث بلغة مختلفة',subtitle:'اختيارات راقية للرجل العصري والعائلة.',image_url:'assets/hero.jpg',button_text:'اكتشف التشكيلة',button_url:'#products'}]}
async function loadData(){if(!db){fallbackData();renderAll();return}try{const [p,c,b,r,l]=await Promise.all([db.from('products').select('*').eq('is_active',true).order('created_at',{ascending:false}),db.from('categories').select('*').eq('is_active',true).order('sort_order'),db.from('banners').select('*').eq('is_active',true).order('sort_order'),db.from('reels').select('*').eq('is_active',true).order('sort_order'),db.from('looks').select('*, look_items(*, products(*))').eq('is_active',true).order('sort_order')]);if(p.error)throw p.error;products=p.data||[];categories=c.data||[];banners=b.data||[];reels=r.data||[];looks=l.data||[];if(!banners.length)banners=[{title:'أناقة تتحدث بلغة مختلفة',subtitle:'اختيارات راقية للرجل العصري والعائلة.',image_url:'assets/hero.jpg',button_text:'اكتشف التشكيلة',button_url:'#products'}];renderAll();}catch(e){console.warn(e);fallbackData();renderAll();toast('تعذر الاتصال؛ نعرض بيانات المعاينة.')}}
function renderCategories(){const grid=$('categoryGrid'),filter=$('categoryFilter');const parents=categories.filter(c=>!c.parent_id),ordered=[...parents,...categories.filter(c=>c.parent_id)];grid.innerHTML=ordered.map(c=>`<a class="category-card ${c.parent_id?'subcategory-card':''}" href="#products" data-cat="${esc(c.name)}" ${c.image_url?`style="background-image:linear-gradient(0deg,#0009,#0002),url('${esc(c.image_url)}')"`:''}><span>${esc(c.name)}<small>${esc((c.slug||'CLASSY').toUpperCase())}</small></span></a>`).join('');filter.innerHTML='<option value="">كل الأقسام</option>'+ordered.map(c=>`<option value="${esc(c.name)}">${c.parent_id?'— ':''}${esc(c.name)}</option>`).join('');grid.querySelectorAll('[data-cat]').forEach(el=>el.onclick=()=>{filter.value=el.dataset.cat;renderProducts()});const colors=[...new Set(products.flatMap(p=>p.colors||[]))];$('colorFilter').innerHTML='<option value="">كل الألوان</option>'+colors.map(c=>`<option>${esc(c)}</option>`).join('')}
function smartMatch(p,q){if(!q)return true;const aliases={'جاكيت':'jacket','قميص':'shirt','بنطال':'pants','حذاء':'shoes','اسود':'أسود','ابيض':'أبيض','ملابس':'fashion'};const text=`${p.name} ${p.category} ${p.description||''} ${(p.colors||[]).join(' ')} ${(p.sizes||[]).join(' ')}`.toLowerCase();return text.includes(q)||Object.entries(aliases).some(([a,b])=>(q.includes(a)&&text.includes(b))||(q.includes(b)&&text.includes(a)))}
function productCard(p){
 const saved=wishlist.map(String).includes(String(p.id)), gallery=[p.image_url,...(p.gallery||[])].filter(Boolean);
 const sizeOptions=(p.sizes||[]).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
 const colorOptions=(p.colors||[]).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
 return `<article class="product-card">
 <button class="wishlist-toggle ${saved?'saved':''}" data-wish="${esc(p.id)}" aria-label="إضافة للمفضلة">${saved?'♥':'♡'}</button>
 <div class="product-photo"><img loading="lazy" src="${esc(p.image_url||'')}" alt="${esc(p.name)}">${p.old_price>p.price?`<span class="discount">-${Math.round((1-p.price/p.old_price)*100)}%</span>`:''}</div>
 ${gallery.length>1?`<div class="product-gallery-thumbs">${gallery.slice(0,5).map((u,i)=>`<button type="button" data-gallery="${esc(p.id)}" data-src="${esc(u)}" aria-label="صورة ${i+1}"><img loading="lazy" src="${esc(u)}" alt=""></button>`).join('')}</div>`:''}
 <div class="product-info"><div class="product-name">${esc(p.name)}</div><div class="product-meta">${esc(p.category||'CLASSY')}</div>
 <div class="product-price">${money(p.price)} ${p.old_price>p.price?`<span class="old-price">${money(p.old_price)}</span>`:''}</div>
 ${sizeOptions?`<label class="variant-label">المقاس<select data-size="${esc(p.id)}"><option value="">اختر المقاس</option>${sizeOptions}</select></label>`:''}
 ${colorOptions?`<label class="variant-label">اللون<select data-color="${esc(p.id)}"><option value="">اختر اللون</option>${colorOptions}</select></label>`:''}
 <button class="add-btn" data-add="${esc(p.id)}">أضف إلى السلة +</button></div></article>`;
}
function renderProducts(){const q=$('searchInput').value.trim().toLowerCase(),cat=$('categoryFilter').value,sort=$('sortSelect').value,size=$('sizeFilter').value,color=$('colorFilter').value;let list=products.filter(p=>(!cat||p.category===cat)&&smartMatch(p,q)&&(!size||(p.sizes||[]).includes(size))&&(!color||(p.colors||[]).includes(color))&&(!onlyWishlist||wishlist.map(String).includes(String(p.id))));if(sort==='price-low')list.sort((a,b)=>a.price-b.price);if(sort==='price-high')list.sort((a,b)=>b.price-a.price);$('productGrid').innerHTML=list.length?list.map(productCard).join(''):'<div class="empty-state">لا توجد منتجات مطابقة حالياً.</div>';bindCards($('productGrid'))}
function bindCards(root){
 root.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const card=b.closest('.product-card'),id=b.dataset.add,size=card.querySelector('[data-size]')?.value||'',color=card.querySelector('[data-color]')?.value||'';const p=products.find(x=>String(x.id)===String(id));if(p?.sizes?.length&&!size)return toast('اختر المقاس أولاً');if(p?.colors?.length&&!color)return toast('اختر اللون أولاً');addToCart(id,{size,color})});
 root.querySelectorAll('[data-wish]').forEach(b=>b.onclick=()=>toggleWish(b.dataset.wish));
 root.querySelectorAll('[data-gallery]').forEach(b=>b.onclick=()=>{const card=b.closest('.product-card'),img=card?.querySelector('.product-photo img');if(img)img.src=b.dataset.src});
}
function toggleWish(id){wishlist=wishlist.map(String).includes(String(id))?wishlist.filter(x=>String(x)!==String(id)):[...wishlist,id];localStorage.setItem('classy_wishlist',JSON.stringify(wishlist));renderProducts();toast('تم تحديث قائمة المفضلة')}
function renderRecommendations(){const ranked=[...products].sort((a,b)=>{const aScore=(a.old_price>a.price?2:0)+(a.stock>0?1:0),bScore=(b.old_price>b.price?2:0)+(b.stock>0?1:0);return bScore-aScore}).slice(0,4);$('recommendGrid').innerHTML=ranked.map(productCard).join('');bindCards($('recommendGrid'))}
function renderBanner(){const b=banners[bannerIndex]||{};$('heroTitle').innerHTML=esc(b.title||'أناقة تتحدث بلغة مختلفة').replace(' ','<br>');$('heroSubtitle').textContent=b.subtitle||'';$('heroImage').style.backgroundImage=`linear-gradient(90deg,#0a0908 0%,transparent 40%),url("${b.image_url||'assets/hero.jpg'}")`;$('heroDots').innerHTML=banners.map((_,i)=>`<button class="${i===bannerIndex?'active':''}" data-dot="${i}" aria-label="الشريحة ${i+1}"></button>`).join('');$('heroDots').querySelectorAll('[data-dot]').forEach(x=>x.onclick=()=>{bannerIndex=+x.dataset.dot;renderBanner();restartBanner()})}
function renderReels(){$('reelGrid').innerHTML=reels.length?reels.map(r=>`<article class="reel-card">${r.video_url?`<video src="${esc(r.video_url)}" poster="${esc(r.cover_url||'')}" controls playsinline preload="none"></video>`:`<img loading="lazy" src="${esc(r.cover_url||'')}" alt="">`}<div class="reel-overlay"><b>${esc(r.title||'CLASSY Reel')}</b><a href="${esc(r.link_url||'#products')}">تسوق القطعة ←</a></div></article>`).join(''):'<div class="empty-state">قريباً — محتوى CLASSY المرئي</div>'}
function renderLooks(){$('lookGrid').innerHTML=looks.length?looks.map(l=>`<article class="look-card"><div class="look-photo"><img loading="lazy" src="${esc(l.image_url||'')}" alt="${esc(l.title)}"></div><div class="look-products"><span class="eyebrow">SHOP THE LOOK</span><h3>${esc(l.title)}</h3>${(l.look_items||[]).map(i=>i.products?`<div class="look-item"><span>${esc(i.products.name)} · ${money(i.products.price)}</span><button data-add="${esc(i.products.id)}">أضف +</button></div>`:'').join('')}<button class="add-btn" data-look="${esc(l.id)}">أضف الإطلالة للسلة</button></div></article>`).join(''):'<div class="empty-state">سيتم عرض الإطلالات المختارة هنا.</div>';$('lookGrid').querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addToCart(b.dataset.add));$('lookGrid').querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{const l=looks.find(x=>String(x.id)===b.dataset.look);(l?.look_items||[]).forEach(i=>i.products&&addToCart(i.products.id));toast('تمت إضافة قطع الإطلالة')})}
function renderAll(){renderCategories();renderProducts();renderRecommendations();renderBanner();renderReels();renderLooks();renderCart();$('year').textContent=new Date().getFullYear();if(banners.length>1)restartBanner()}
function restartBanner(){clearInterval(bannerTimer);if(banners.length>1){const duration=Math.max(3,Math.min(20,Number(banners[bannerIndex]?.slide_duration)||6))*1000;bannerTimer=setInterval(()=>{bannerIndex=(bannerIndex+1)%banners.length;renderBanner();restartBanner()},duration)}}
function addToCart(id,variant={}){const p=products.find(x=>String(x.id)===String(id));if(!p)return;const key=`${id}|${variant.size||''}|${variant.color||''}`;const item=cart.find(x=>x.key===key);if(item)item.qty++;else cart.push({key,id:p.id,name:p.name,price:p.price,image_url:p.image_url,qty:1,size:variant.size||'',color:variant.color||''});saveCart();toast('تمت إضافة المنتج إلى السلة')}
function saveCart(){localStorage.setItem('classy_cart',JSON.stringify(cart));renderCart()}
function renderCart(){$('cartCount').textContent=cart.reduce((s,x)=>s+x.qty,0);$('cartItems').innerHTML=cart.length?cart.map(x=>`<div class="cart-line"><span>${esc(x.name)}${x.size?' · '+esc(x.size):''}${x.color?' · '+esc(x.color):''} × ${x.qty}</span><b>${money(x.price*x.qty)}</b><button data-remove="${esc(x.key||x.id)}">حذف</button></div>`).join(''):'<p class="muted">السلة فارغة حالياً.</p>';$('cartTotal').textContent=money(cart.reduce((s,x)=>s+x.price*x.qty,0));$('cartItems').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{cart=cart.filter(x=>String(x.key||x.id)!==b.dataset.remove);saveCart()})}
async function trackEvent(eventType,details={}){if(!db)return;try{await db.from('analytics_events').insert({event_type:eventType,details})}catch(e){console.debug('analytics unavailable',e.message)}}
async function checkout(){
 if(!cart.length)return toast('السلة فارغة');
 const customer=prompt('اكتب اسمك لتأكيد الطلب:');if(customer===null)return;
 const phone=prompt('رقم الجوال للتواصل:');if(phone===null)return;
 if(!customer.trim()||!phone.trim())return toast('يرجى إدخال الاسم ورقم الجوال');
 const address=prompt('المدينة والعنوان (اختياري):');if(address===null)return;
 const msg=`مرحباً CLASSY، أود تأكيد الطلب:\n${cart.map(x=>`• ${x.name}${x.size?' · '+x.size:''}${x.color?' · '+x.color:''} × ${x.qty}`).join('\n')}\nالاسم: ${customer.trim()}\nالجوال: ${phone.trim()}\nالعنوان: ${address||''}`;
 let orderId=null;
 if(db){
   const items=cart.map(x=>({product_id:String(x.id).startsWith('d')?null:x.id,quantity:Math.max(1,Math.min(50,Number(x.qty)||1)),size:x.size||null,color:x.color||null}));
   const {data,error}=await db.rpc('create_classy_order',{p_customer_name:customer.trim(),p_customer_phone:phone.trim(),p_shipping_address:address||'',p_items:items});
   if(error){console.error(error);return toast('تعذر تسجيل الطلب. بقيت السلة محفوظة؛ حاول مجدداً أو تواصل معنا.')}
   orderId=data;
 } else if(!cfg.WHATSAPP_NUMBER) {
   return toast('أكمل إعداد المتجر أو رقم واتساب أولاً؛ السلة محفوظة.');
 }
 const wa=cfg.WHATSAPP_NUMBER?`https://wa.me/${cfg.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg+(orderId?`\nرقم الطلب: ${orderId}`:''))}`:null;
 if(wa)window.open(wa,'_blank','noopener');
 trackEvent('checkout_completed',{order_id:orderId});
 cart=[];saveCart();openCart(false);
 toast(orderId?'تم تسجيل طلبك بنجاح':'تم تجهيز رسالة الطلب');
}
function openCart(v){$('cartDrawer').classList.toggle('active',v);$('drawerBackdrop').classList.toggle('active',v)}
$('menuToggle').onclick=()=>$('mainNav').classList.toggle('open');$('searchToggle').onclick=()=>$('searchRow').classList.toggle('active');$('searchClear').onclick=()=>{$('searchInput').value='';renderProducts()};$('searchInput').oninput=()=>{renderProducts();trackEvent('search')};['categoryFilter','sortSelect','sizeFilter','colorFilter'].forEach(id=>$(id).onchange=renderProducts);$('wishlistFilter').onclick=()=>{onlyWishlist=!onlyWishlist;$('wishlistFilter').textContent=onlyWishlist?'عرض كل المنتجات':'♡ المفضلة فقط';renderProducts()};$('wishlistBtn').onclick=()=>{onlyWishlist=true;$('wishlistFilter').textContent='عرض كل المنتجات';$('wishlistFilter').scrollIntoView({behavior:'smooth'});renderProducts()};$('recommendBtn').onclick=()=>{$('recommendations').scrollIntoView({behavior:'smooth'});trackEvent('recommendations_view')};$('cartOpen').onclick=()=>openCart(true);$('cartClose').onclick=()=>openCart(false);$('drawerBackdrop').onclick=()=>openCart(false);$('bannerPrev').onclick=()=>{bannerIndex=(bannerIndex-1+banners.length)%banners.length;renderBanner();restartBanner()};$('bannerNext').onclick=()=>{bannerIndex=(bannerIndex+1)%banners.length;renderBanner();restartBanner()};$('checkoutBtn').onclick=checkout;
loadData();
})();
