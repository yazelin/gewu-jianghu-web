// 格物江湖錄 離線 SW — 兩層快取,依「壽命」分家(仿台語/客語字典 repo 的 shell/data/audio 分層):
//   殼(HTML/JS/data,約 0.4MB)每次部署 bump;資產(assets/,約 33MB)只有同名檔換內容才 bump。
//   舊做法把 33MB 和殼放同一個 CACHE,每次部署 activate 整包刪掉重抓——不只浪費頻寬,更會反覆
//   製造「重寫 33MB」的窗口,而寫入失敗(配額/SW 被回收)是靜默的,尾端最大的音檔最容易掉。
const SHELL_CACHE="gewu-shell-v98";   // ← 每次部署 bump 這行(觸發新 SW + 自動重整)
// ponytail: 新增/改名的資產 URL 變了就自動抓;只有「同名檔換內容」才要手動 bump 這行
// (本 repo 慣例是檔名帶 _vNN,如 title_keyart_v14.webp,平常不用動)。
// 上限=靠人記得 bump;要根治就資產改雜湊檔名 + build step,見 NOTES.md。
const ASSET_CACHE="gewu-assets-v1";
const KEEP=[SHELL_CACHE,ASSET_CACHE];
// 快取比對一律忽略 query 與 Vary:資產以 URL 為鍵,存進去的位元組就是位元組。
// GitHub Pages 對每個檔都回 Vary: Accept-Encoding,而 <audio> 送的是 Accept-Encoding: identity,
// 跟暖快取當初的 gzip/br 不同 → 預設的 Vary 比對會 miss → 斷網時大音檔全部 Format error。
const MATCH={ignoreSearch:true,ignoreVary:true};
const isAsset=p=>p.includes("/assets/");           // data/ 跟著殼走(才 0.4MB,且改版必須更新)
const cacheable=r=>!!r&&r.ok&&r.status!==206;      // Cache.put 對 206 直接 throw,必須擋掉
// 寫入一律 await + 回報成敗:配額不足/SW 被回收時要看得見,不能靜默吞掉(音樂消失的真因)
async function store(name,req,res){try{await (await caches.open(name)).put(req,res);return true;}catch{return false;}}
const CORE=["./", "index.html", "engine.js", "manifest.json", "data/game.json", "design.html", "assets/audio/oriental_calm.ogg", "assets/audio/oriented_suspense.ogg", "assets/audio/chapter1_workshop.ogg", "assets/audio/chapter1_crisis.ogg", "assets/audio/sfx/correct.mp3", "assets/audio/sfx/paper.mp3", "assets/audio/sfx/step_a.mp3", "assets/audio/sfx/step_b.mp3", "assets/audio/sfx/creak.mp3", "assets/audio/sfx/gong.mp3", "assets/audio/sfx/door.mp3", "assets/audio/sfx/wood.mp3", "assets/img/bell_tower_concept.webp", "assets/img/chapter10_nameless_institute.webp", "assets/img/chapter11_common_measure.webp", "assets/img/chapter11_four_keys.webp", "assets/img/chapter11_heaven_earth_balance.webp", "assets/img/chapter11_heaven_earth_shared.webp", "assets/img/chapter11_masterless_road.webp", "assets/img/chapter1_workshop.webp", "assets/img/chapter2_riverboat.webp", "assets/img/chapter3_hundred_step_ridge.webp", "assets/img/chapter4_ember_forge.webp", "assets/img/chapter5_thunder_fire_alliance.webp", "assets/img/chapter6_xuanqiong_observatory.webp", "assets/img/chapter7_broken_mirror_city.webp", "assets/img/chapter8_hundred_crafts_prison.webp", "assets/img/chapter9_archive_sealed.webp", "assets/img/chapter9_nameless_ashes.webp", "assets/img/chapter9_people_witness.webp", "assets/img/chapter9_return_mountain.webp", "assets/img/chapter9_tianli_bureau.webp", "assets/img/gu_xuance.webp", "assets/img/huo_li.webp", "assets/img/jiang_zhuoyue.webp", "assets/img/liu_zhaowei.webp", "assets/img/missing_master_chamber_v14.webp", "assets/img/ning_guanlan.webp", "assets/img/pei_wugou.webp", "assets/img/qi_wangshu.webp", "assets/img/sabotaged_axle_v14.webp", "assets/img/shen_yan_user_cut.webp", "assets/img/su_tan.webp", "assets/img/tianheng_confrontation_v14.webp", "assets/img/title_keyart_v16.webp", "assets/img/title_lockup_v1.webp", "assets/seal.svg", "assets/img/xie_jingxian.webp", "assets/img/credits_cast_main.webp", "assets/img/credits_cast_crew.webp", "assets/img/achievement_emblem_atlas.webp", "assets/img/sage_mozi.webp", "assets/img/sage_archimedes.webp", "assets/img/sage_ibn.webp", "assets/img/sage_galileo.webp", "assets/img/sage_huygens.webp", "assets/img/sage_hooke.webp", "assets/img/sage_newton.webp", "assets/img/sage_faraday.webp", "assets/img/sage_maxwell.webp", "assets/cells/bell_case_evidence_atlas_0.webp", "assets/cells/bell_case_evidence_atlas_1.webp", "assets/cells/bell_case_evidence_atlas_2.webp", "assets/cells/bell_case_evidence_atlas_3.webp", "assets/cells/bell_case_evidence_atlas_4.webp", "assets/cells/bell_case_evidence_atlas_5.webp", "assets/cells/chapter10_evidence_atlas_0.webp", "assets/cells/chapter10_evidence_atlas_1.webp", "assets/cells/chapter10_evidence_atlas_2.webp", "assets/cells/chapter10_evidence_atlas_3.webp", "assets/cells/chapter10_evidence_atlas_4.webp", "assets/cells/chapter10_evidence_atlas_5.webp", "assets/cells/chapter11_evidence_atlas_0.webp", "assets/cells/chapter11_evidence_atlas_1.webp", "assets/cells/chapter11_evidence_atlas_2.webp", "assets/cells/chapter11_evidence_atlas_3.webp", "assets/cells/chapter11_evidence_atlas_4.webp", "assets/cells/chapter11_evidence_atlas_5.webp", "assets/cells/chapter1_evidence_atlas_0.webp", "assets/cells/chapter1_evidence_atlas_1.webp", "assets/cells/chapter1_evidence_atlas_2.webp", "assets/cells/chapter1_evidence_atlas_3.webp", "assets/cells/chapter1_evidence_atlas_4.webp", "assets/cells/chapter1_evidence_atlas_5.webp", "assets/cells/chapter2_evidence_atlas_0.webp", "assets/cells/chapter2_evidence_atlas_1.webp", "assets/cells/chapter2_evidence_atlas_2.webp", "assets/cells/chapter2_evidence_atlas_3.webp", "assets/cells/chapter2_evidence_atlas_4.webp", "assets/cells/chapter2_evidence_atlas_5.webp", "assets/cells/chapter3_evidence_atlas_0.webp", "assets/cells/chapter3_evidence_atlas_1.webp", "assets/cells/chapter3_evidence_atlas_2.webp", "assets/cells/chapter3_evidence_atlas_3.webp", "assets/cells/chapter3_evidence_atlas_4.webp", "assets/cells/chapter3_evidence_atlas_5.webp", "assets/cells/chapter4_evidence_atlas_0.webp", "assets/cells/chapter4_evidence_atlas_1.webp", "assets/cells/chapter4_evidence_atlas_2.webp", "assets/cells/chapter4_evidence_atlas_3.webp", "assets/cells/chapter4_evidence_atlas_4.webp", "assets/cells/chapter4_evidence_atlas_5.webp", "assets/cells/chapter5_evidence_atlas_0.webp", "assets/cells/chapter5_evidence_atlas_1.webp", "assets/cells/chapter5_evidence_atlas_2.webp", "assets/cells/chapter5_evidence_atlas_3.webp", "assets/cells/chapter5_evidence_atlas_4.webp", "assets/cells/chapter5_evidence_atlas_5.webp", "assets/cells/chapter6_evidence_atlas_0.webp", "assets/cells/chapter6_evidence_atlas_1.webp", "assets/cells/chapter6_evidence_atlas_2.webp", "assets/cells/chapter6_evidence_atlas_3.webp", "assets/cells/chapter6_evidence_atlas_4.webp", "assets/cells/chapter6_evidence_atlas_5.webp", "assets/cells/chapter7_evidence_atlas_0.webp", "assets/cells/chapter7_evidence_atlas_1.webp", "assets/cells/chapter7_evidence_atlas_2.webp", "assets/cells/chapter7_evidence_atlas_3.webp", "assets/cells/chapter7_evidence_atlas_4.webp", "assets/cells/chapter7_evidence_atlas_5.webp", "assets/cells/chapter8_evidence_atlas_0.webp", "assets/cells/chapter8_evidence_atlas_1.webp", "assets/cells/chapter8_evidence_atlas_2.webp", "assets/cells/chapter8_evidence_atlas_3.webp", "assets/cells/chapter8_evidence_atlas_4.webp", "assets/cells/chapter8_evidence_atlas_5.webp", "assets/cells/chapter9_evidence_atlas_0.webp", "assets/cells/chapter9_evidence_atlas_1.webp", "assets/cells/chapter9_evidence_atlas_2.webp", "assets/cells/chapter9_evidence_atlas_3.webp", "assets/cells/chapter9_evidence_atlas_4.webp", "assets/cells/chapter9_evidence_atlas_5.webp", "assets/fonts/notosanstc.woff2", "assets/icons/apple-touch-icon-v2.png", "assets/icons/icon-192-v2.png", "assets/icons/icon-512-v2.png", "assets/icons/maskable-512-v2.png", "assets/audio/asianoriental_battle.ogg", "assets/audio/chapter10_battle.ogg", "assets/audio/chapter10_nameless_institute.ogg", "assets/audio/chapter11_battle.ogg", "assets/audio/chapter11_heaven_earth.ogg", "assets/audio/chapter2_river.ogg", "assets/audio/chapter3_battle.ogg", "assets/audio/chapter3_ridge.ogg", "assets/audio/chapter4_battle.ogg", "assets/audio/chapter4_forge.ogg", "assets/audio/chapter5_battle.ogg", "assets/audio/chapter5_thunder_alliance.ogg", "assets/audio/chapter6_battle.ogg", "assets/audio/chapter6_observatory.ogg", "assets/audio/chapter7_mirror_city.ogg", "assets/audio/chapter8_battle.ogg", "assets/audio/chapter8_crafts_prison.ogg", "assets/audio/chapter9_ending.ogg", "assets/audio/chapter9_tianli_bureau.ogg"];
// 只預快取「殼」(可開機/顯示題名的最小集),重資產由頁面載入後自暖並顯示進度
const SHELL=["./","index.html","engine.js","manifest.json","data/game.json","design.html","assets/fonts/notosanstc.woff2","assets/img/title_keyart_v16.webp","assets/img/title_lockup_v1.webp","assets/seal.svg","assets/icons/icon-192-v2.png","assets/icons/icon-512-v2.png","assets/icons/apple-touch-icon-v2.png","assets/icons/maskable-512-v2.png"];
self.addEventListener("install",e=>{e.waitUntil((async()=>{
  await Promise.allSettled(SHELL.map(async u=>{
    const asset=isAsset(new URL(u,self.registration.scope).pathname);
    const c=await caches.open(asset?ASSET_CACHE:SHELL_CACHE);
    if(asset&&await c.match(u,MATCH))return;                                    // 資產已在長命快取 → 不重抓(省下每次部署的 33MB)
    const r=await fetch(new Request(u,{cache:asset?"default":"reload"})); // 殼一律繞 HTTP 快取拿最新
    if(cacheable(r))await c.put(u,r);
  }));
  await self.skipWaiting();
})());});
// 回報「真的在快取裡」的清單——頁面靠這個驗證,不能自己宣告完成(音樂消失時徽章卻說已完成的真因)
async function missingFromCache(){
  const shell=await caches.open(SHELL_CACHE),asset=await caches.open(ASSET_CACHE);
  const hit=await Promise.all(CORE.map(u=>(isAsset(new URL(u,self.registration.scope).pathname)?asset:shell).match(u,MATCH).then(r=>!!r)));
  return CORE.filter((u,i)=>!hit[i]);
}
self.addEventListener("message",e=>{
  const d=e.data||{};const port=e.ports&&e.ports[0];
  const send=m=>{if(port)port.postMessage(m);else if(e.source)e.source.postMessage(m);};
  if(d.type==="offline-list")send({type:"offline-list",list:CORE,ver:SHELL_CACHE});
  else if(d.type==="offline-status")e.waitUntil((async()=>{
    const missing=await missingFromCache();
    send({type:"offline-status",done:CORE.length-missing.length,total:CORE.length,missing,
          audioMissing:missing.filter(u=>u.includes("/audio/")).length,ver:SHELL_CACHE});
  })());
});
// ponytail: 一次性把舊單層快取(gewu-vNN)的 assets/ 接手過來,免得「修好分層」這一版反而
// 讓既有使用者再抓一次 33MB。舊快取名絕跡後(約兩三次部署)整個 adopt 可以刪掉。
async function adopt(keys){
  const dst=await caches.open(ASSET_CACHE);
  for(const k of keys.filter(k=>/^gewu-v\d+$/.test(k))){
    const src=await caches.open(k);
    for(const req of await src.keys()){
      if(!isAsset(new URL(req.url).pathname))continue;
      if(await dst.match(req,MATCH))continue;
      const r=await src.match(req);
      if(r)await store(ASSET_CACHE,req,r);
    }
  }
}
// 資產快取永不 bump,所以改名換版的舊圖(如 title_keyart_v14)會一直躺在使用者機器上。
// 每次 activate 清掉不在 CORE 裡的條目——這是「改檔名帶 _vNN」那套慣例缺的另一半。
async function prune(){
  const c=await caches.open(ASSET_CACHE);
  const want=new Set(CORE.map(u=>new URL(u,self.registration.scope).href));
  for(const req of await c.keys()){
    const clean=new URL(req.url);clean.search="";clean.hash="";
    if(!want.has(clean.href))await c.delete(req);
  }
}
self.addEventListener("activate",e=>{e.waitUntil((async()=>{
  const keys=await caches.keys();
  await adopt(keys);
  await Promise.all(keys.filter(k=>!KEEP.includes(k)).map(k=>caches.delete(k)));
  await prune();
  await self.clients.claim();
})());});
// 音檔用 Range 請求拿回來的是 206,Cache.put 存不進去 → 另抓一次完整檔補存。
// 這樣「聽過的曲子」自己會留在離線包裡,不必等背景暖快取跑到最後那 14MB。
// 從快取回應 Range 請求時,必須自己合成 206。Chrome 的媒體管線對超過一定大小的音檔
// 一律用 Range 抓,拿到「200 但沒有 Content-Range」會直接判 Format error——斷網時
// 小檔(如 144KB 的題名曲)照播、大檔全部播不出來的真因。做法同台語/客語字典 repo。
async function rangedResponse(req,res){
  const range=req.headers&&req.headers.get&&req.headers.get("range");
  if(!range)return res;
  const m=/^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  if(!m)return res;
  const buf=await res.arrayBuffer(),len=buf.byteLength;
  let start=m[1]?Number(m[1]):null,end=m[2]?Number(m[2]):null;
  if(start===null&&end!==null){start=Math.max(0,len-end);end=len-1;}
  else{start??=0;end=end===null?len-1:Math.min(end,len-1);}
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||start>end||start>=len)
    return new Response(null,{status:416,headers:{"content-range":`bytes */${len}`}});
  const h=new Headers(res.headers);
  h.set("accept-ranges","bytes");
  h.set("content-range",`bytes ${start}-${end}/${len}`);
  h.set("content-length",String(end-start+1));
  return new Response(buf.slice(start,end+1),{status:206,headers:h});
}
async function backfill(name,href){
  if(await (await caches.open(name)).match(href,MATCH))return;
  try{const full=await fetch(href,{cache:"no-cache"});if(cacheable(full))await store(name,href,full);}catch{}
}
self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  const u=new URL(req.url);
  if(u.origin!==self.location.origin)return;                        // 跨網域(BMC 等)交回瀏覽器
  const asset=isAsset(u.pathname),nav=req.mode==="navigate";
  const name=asset?ASSET_CACHE:SHELL_CACHE;
  const forced=req.cache==="reload"||req.cache==="no-cache";        // 硬重整=主動要最新
  let finish;e.waitUntil(new Promise(r=>finish=r));                 // 同步佔住 SW 壽命,背景寫快取才不會被回收掉
  e.respondWith((async()=>{
    const c=await caches.open(name);
    const hit=forced?null:await c.match(req,MATCH);   // ignoreSearch:斷網開 design.html?utm=… 才不會開成遊戲
    if(hit&&asset){finish();return rangedResponse(req,hit);}        // 資產不變 → 純快取優先;Range 請求要合成 206
    if(hit){(async()=>{try{const r=await fetch(req);if(cacheable(r)&&!u.search)await store(name,req,r.clone());}catch{}})().then(finish);return hit;}
    try{
      const r=await fetch(req);
      if(cacheable(r)&&!u.search){await store(name,req,r.clone());finish();}
      else if(r.status===206&&asset)backfill(name,u.href).then(finish);   // 不擋播放,背景補存
      else finish();
      return r;
    }catch{
      finish();
      const cached=await c.match(req,MATCH);
      if(cached)return asset?rangedResponse(req,cached):cached;
      return (nav?await c.match("index.html"):Response.error());
    }
  })());
});
