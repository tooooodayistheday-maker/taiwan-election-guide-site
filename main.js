'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function trackSiteEvent(name,params={}){try{if(typeof window!=='undefined')window.electionAnalytics?.track(name,params);}catch{}}
const normal=s=>String(s||'').replace(/台/g,'臺').toLocaleLowerCase();
const local={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
const state={county:'基隆市',town:'',village:'',office:'mayor',scope:'county',constituency:'',party:'',judicial:'',eligibility:'',search:'',page:1,selected:[],theme:'fantasy',issue:'transport',hotCategory:'全部',streetTopic:null,streetStep:0,current:null,profileTab:'bio',visited:new Set(local.get('vote-visited',[]))};
const officeInfo={mayor:{label:'縣市長',icon:'♜',description:'統籌地方施政、提出預算與政策，帶領政府執行建設與公共服務。'},council:{label:'縣市議員',icon:'⚖',description:'審議自治法規與預算、質詢政府。正式選區可能涵蓋多個鄉鎮區，原住民選區另有身分條件。'},village:{label:'村里長',icon:'⌂',description:'協助村里公共事務、反映居民需求；大型工程與補助仍需權責機關及預算配合。'},township_mayor:{label:'鄉鎮市長',icon:'♜',description:'綜理鄉鎮市政、執行自治事務與地方建設，並接受代表會監督。'},township_rep:{label:'鄉鎮市民代表',icon:'⚖',description:'審議鄉鎮市自治法規與預算、監督公所，代表地方居民提出公共事務意見。'},indigenous_district_head:{label:'山地原住民區長',icon:'♜',description:'綜理直轄市山地原住民區自治事務；與一般由市長任用的區長不同。'},indigenous_district_rep:{label:'山地原住民區民代表',icon:'⚖',description:'審議山地原住民區自治法規與預算，監督區公所，代表居民參與地方自治。'}};
const issues=[{id:'transport',label:'交通與通勤',title:'每天往返，如何更好？',questions:['這項主張由誰決定，還需要哪些機關合作？','路線、工期與成效指標交代了嗎？','補助對象、金額與財源清楚嗎？']},{id:'care',label:'社福與照護',title:'照顧的承諾，如何落實？',questions:['誰符合資格，誰可能未被涵蓋？','服務人力與量能足夠嗎？','年度成本與受益人數能否核對？']},{id:'city',label:'城市與生活',title:'建設如何走進生活？',questions:['用地、權責與工程條件清楚嗎？','居民如何參與，環境影響是什麼？','有可查核的時程與成果指標嗎？']},{id:'jobs',label:'產業與就業',title:'投資如何轉成工作？',questions:['產業發展的基礎條件齊備嗎？','在地就業、薪資與效益有依據嗎？','需要中央或民間哪些配合？']},{id:'finance',label:'預算與可行性',title:'承諾的錢，從哪裡來？',questions:['是一筆支出，還是長期固定成本？','財源、法源與審議如何安排？','有沒有交代代價與優先順序？']}];
let data,mapData,topicData,candidates=[],searchIndex=null,loadingTicket=0,toastTimer;
const countyCache=new Map(),candidateCache=new Map();
const judicialLabels={confirmed_conviction:'刑事有罪定讞・已核實',reported_conviction:'有刑事紀錄報導・原始裁判待補',non_final:'有尚未定讞案件資料',searched_no_verified_conviction:'已研究・未查得已核實定讞',not_checked:'尚未完成個別司法查核'};
function hydrate(c){return{education:[],experience:[],biographySources:[],policies:[],historicalPolicies:[],judicialEvents:[],controversies:[],sourceUrls:[],sourceRefs:[],profileStatus:'本版已收錄官方名冊，完整學經歷仍待補查。',controversyStatus:'未完成個別爭議查核，空白不代表沒有爭議。',criminalRecord:{label:'尚未完成個別司法查核',detail:'尚未完成本人身分與裁判資料的個別核對，不能解讀為沒有犯罪前科。'},...c};}
function link(url,title){return /^https:\/\//.test(url||'')?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title||'原始資料')} ↗</a>`:'';}
function links(items=[]){return `<div class="source-links">${items.filter(Boolean).map(s=>typeof s==='string'?link(s,'原始資料'):link(s.url||s.sourceUrl,s.title||s.sourceTitle)).join('')}</div>`;}
function pending(s){return `<div class="pending-box"><p>${esc(s)}</p></div>`;}
function toast(s){$('#toast').textContent=s;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function optionList(el,items,value,placeholder){el.innerHTML=(placeholder!=null?`<option value="">${placeholder}</option>`:'')+items.map(x=>{const v=typeof x==='string'?x:x.value,l=typeof x==='string'?x:x.label;return `<option value="${esc(v)}" ${value===v?'selected':''}>${esc(l)}</option>`;}).join('');}
function countyMeta(){return data.counties.find(c=>c.name===state.county);}
async function fetchJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(`Unable to load ${path}`);return r.json();}
async function loadCounty(name){if(countyCache.has(name))return countyCache.get(name);const meta=data.counties.find(c=>c.name===name);if(!meta)throw new Error('Unknown county');const rows=(await fetchJson(meta.file)).map(hydrate);countyCache.set(name,rows);rows.forEach(c=>candidateCache.set(c.id,c));return rows;}
async function loadSearch(){if(!searchIndex)searchIndex=await fetchJson('search.json');return searchIndex;}
function updateURL(){try{const url=new URL(location.href);for(const [k,v] of Object.entries({theme:state.theme,county:state.county,town:state.town,village:state.village,office:state.office})){v?url.searchParams.set(k,v):url.searchParams.delete(k);}history.replaceState(null,'',url.href);}catch{}}
function setTheme(theme){if(!['journal','pixel','fantasy'].includes(theme))theme='fantasy';state.theme=theme;document.documentElement.dataset.theme=theme;document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===theme)));local.set('vote-theme-fantasy-release',theme);if(mapData)renderMap();updateURL();}
function renderMap(){
 if(!mapData)return;
 const paths=[],markers=[],labels=[];
 for(const c of mapData.counties){
  const [px,py]=c.point,[lx,ly]=c.label,selected=state.county===c.county;
  const name=esc(c.county),active=selected?'active':'';
  paths.push(`<g class="map-county ${active}" data-county="${name}" data-region="${c.region}" role="button" tabindex="0" aria-label="選擇${name}" aria-pressed="${selected}"><title>${name}・${data.counties.find(x=>x.name===c.county)?.records||0}筆登記資料</title><path class="county-path" d="${state.theme==='pixel'?c.pixelPath:c.path}" fill-rule="evenodd"/></g>`);
  markers.push(`<g class="map-county-marker ${active}"><path class="map-leader" d="M${px},${py}L${lx},${ly}"/><circle class="map-point" cx="${px}" cy="${py}" r="2.5"/></g>`);
  labels.push(`<g class="map-county-label ${active}" data-county="${name}" aria-hidden="true"><rect class="map-label-bg" x="${lx-35}" y="${ly-15}" width="70" height="30"/><text class="map-label" x="${lx}" y="${ly}">${name}</text></g>`);
 }
 // SVG uses document paint order: every county shape and leader stays below every label.
 $('#map-container').innerHTML=`<svg viewBox="${mapData.viewBox}" aria-label="可互動選擇22縣市的台灣行政區導覽圖"><g aria-hidden="true"><rect class="inset-box" x="30" y="75" width="112" height="108"/><rect class="inset-box" x="30" y="215" width="112" height="108"/><rect class="inset-box" x="30" y="365" width="112" height="108"/><text class="map-sea-label" x="370" y="590">PACIFIC OCEAN</text><path d="M490 420q13-9 26 0t26 0M485 435q13-9 26 0t26 0M475 450q13-9 26 0t26 0" fill="none" stroke="currentColor" stroke-width="1" opacity=".2"/></g><g class="map-shapes">${paths.join('')}</g><g class="map-markers" aria-hidden="true" pointer-events="none">${markers.join('')}</g><g class="map-labels">${labels.join('')}</g></svg>`;
}
function updateCoordinates(){const meta=countyMeta();$('#county-theme-title').textContent=meta.theme.headline;$('#county-theme-name').textContent=state.county+' / 本站編輯主題';optionList($('#county'),data.counties.map(c=>c.name),state.county,null);optionList($('#town'),meta.towns,state.town,'全縣市');const villages=[...new Set(candidates.filter(c=>c.officeKey==='village'&&(!state.town||c.district===state.town)).map(c=>c.village).filter(Boolean))];if(state.village&&!villages.includes(state.village))state.village='';optionList($('#village'),villages,state.village,'全部村里');$('#village').disabled=!state.town;$('#coordinate-text').textContent='座標：'+[state.county,state.town,state.village].filter(Boolean).join(' › ');$('#coordinate-code').textContent='TAIWAN / '+state.county;updateURL();}
function coordinateMatch(c){if(!state.town)return true;if(c.officeKey==='mayor')return true;if(c.officeKey==='council')return c.districtAreas?.length?c.districtAreas.includes(state.town):true;if(c.district!==state.town)return false;return !state.village||!c.village||c.village===state.village;}
function baseRecords(){return state.scope==='national'?(searchIndex||[]):candidates.filter(coordinateMatch);}
function updateFilters(){optionList($('#directory-county'),data.counties.map(c=>c.name),state.scope==='national'?'':state.county,'全台灣（不限縣市）');const list=baseRecords();const keys=Object.keys(officeInfo).filter(k=>list.some(c=>c.officeKey===k));if(state.office!=='all'&&!keys.includes(state.office))state.office='all';optionList($('#office'),[{value:'all',label:'全部職務'},...keys.map(k=>({value:k,label:officeInfo[k].label}))],state.office,null);const byOffice=list.filter(c=>state.office==='all'||c.officeKey===state.office);const many=state.scope==='national'&&(state.office==='all'||state.office==='village');const cons=many?[]:[...new Set(byOffice.map(c=>c.constituency))];$('#constituency').disabled=many;if(state.constituency&&!cons.includes(state.constituency))state.constituency='';optionList($('#constituency'),cons,state.constituency,'全部選區');const parties=[...new Set(byOffice.map(c=>c.party))];if(state.party&&!parties.includes(state.party))state.party='';optionList($('#party'),parties,state.party,'全部政黨');$('#scope').value=state.scope;$('#judicial-filter').value=state.judicial;$('#eligibility-filter').value=state.eligibility;}
function filtered(){const q=normal(state.search.trim());return baseRecords().filter(c=>(state.office==='all'||c.officeKey===state.office)&&(!state.constituency||c.constituency===state.constituency)&&(!state.party||c.party===state.party)&&(!state.judicial||(c.judicialStatus||'not_checked')===state.judicial)&&(!state.eligibility||(state.eligibility==='not_ineligible'?c.eligibleToRun!==false:state.eligibility==='eligible'?c.eligibleToRun===true:state.eligibility==='ineligible'?c.eligibleToRun===false:c.eligibleToRun==null))&&(!q||normal([c.name,c.county,c.district,c.village,c.party,c.constituency].join(' ')).includes(q)));}
function statusText(c){return c.eligibleToRun===false?'資格不符・歷史登記':c.eligibleToRun===true?'資格審定通過':'已登記・審定未核實';}
const partyCodes=new Map([["民主進步黨","dpp"],["中國國民黨","kmt"],["台灣民眾黨","tpp"],["時代力量","npp"],["親民黨","pfp"],["台灣基進","tsp"],["台灣綠黨","green"],["社會民主黨","sdp"],["小民參政歐巴桑聯盟","obs"],["勞動黨","labor"]].map(([name,code])=>[normal(name),code]));
function partyCode(party){return normal(party)==='無政黨推薦'?'independent':partyCodes.get(normal(party))||'other';}
function partyPill(party){return `<span class="party-pill" data-party-code="${partyCode(party)}" title="推薦政黨：${esc(party)}">${esc(party)}</span>`;}
function card(c){const status=c.judicialStatus||'not_checked';return `<article class="candidate-card ${state.selected.includes(c.id)?'selected':''} ${status==='confirmed_conviction'?'has-conviction':''}" data-card="${c.id}" data-party-code="${partyCode(c.party)}"><div class="party-stripe" aria-hidden="true"></div>${status==='confirmed_conviction'?`<div class="conviction-banner"><span aria-hidden="true">⚑</span><button data-profile="${c.id}" data-tab="judicial" aria-label="查看${esc(c.name)}已核實刑事判決">刑事有罪定讞・已核實 ↗</button></div>`:status==='reported_conviction'?`<div class="reported-banner"><button data-profile="${c.id}" data-tab="judicial">刑事紀錄報導・原始裁判待補 ↗</button></div>`:''}<div class="candidate-main"><div class="candidate-top"><span class="avatar" aria-hidden="true">${esc(c.name[0])}</span><span class="candidate-status ${c.eligibleToRun===false?'ineligible':''}">${statusText(c)}</span></div><h3>${esc(c.name)}</h3><p class="candidate-position">${esc(c.office)} · ${esc(c.county)}<br>${esc(c.village?c.district+' '+c.village:c.constituency)}</p>${partyPill(c.party)}<p class="candidate-summary">${esc(c.intro||'官方登記資料已收錄；學經歷與本屆政見仍待逐人補查。')}</p><div class="candidate-chips"><span class="chip">${c.hasBio?'經歷附來源':'經歷待補'}</span><span class="chip">${c.hasPolicy?'政策有資料':'本屆政見待補'}</span>${status==='non_final'?'<span class="chip ongoing">案件尚未定讞</span>':status==='not_checked'?'<span class="chip pending">司法尚待查核</span>':''}${c.nameVerificationStatus?.includes('待')?'<span class="chip ongoing">姓名特殊字待核對</span>':''}</div></div><div class="candidate-bottom"><button data-profile="${c.id}">打開圖鑑 ↗</button><button data-compare="${c.id}" ${c.eligibleToRun===false?'disabled':''} aria-pressed="${state.selected.includes(c.id)}">${state.selected.includes(c.id)?'✓ 已加入':'＋ 加入比較'}</button></div></article>`;}
function selectedOfficeLabel(){if(state.office==='all')return '全部職務';const labels=[...new Set(baseRecords().filter(c=>c.officeKey===state.office).map(c=>c.office).filter(Boolean))];return labels.length===1?labels[0]:officeInfo[state.office]?.label||'全部職務';}
function directoryOfficeLabel(key,rows){
 if(key==='all')return '全部職務';
 if(key==='council')return officeInfo.council.label;
 const labels=[...new Set(rows.filter(c=>c.officeKey===key).map(c=>c.office).filter(Boolean))];
 return labels.length===1?labels[0]:officeInfo[key].label;
}
function renderDirectoryOfficeShortcuts(){
 const group=$('#directory-office-shortcuts');if(!group)return;
 const rows=baseRecords(),keys=['all',...Object.keys(officeInfo).filter(k=>rows.some(c=>c.officeKey===k))];
 const html=keys.map(key=>`<button type="button" data-directory-office="${key}" aria-pressed="${state.office===key}">${esc(directoryOfficeLabel(key,rows))}<span>${(key==='all'?rows.length:rows.filter(c=>c.officeKey===key).length).toLocaleString()} 筆</span></button>`).join('');
 if(group.innerHTML===html)return;
 const focused=document.activeElement?.dataset?.directoryOffice;
 group.innerHTML=html;
 if(focused)group.querySelector(`[data-directory-office="${focused}"]`)?.focus({preventScroll:true});
}
function selectDirectoryOffice(key){
 if(key!=='all'&&(!officeInfo[key]||!baseRecords().some(c=>c.officeKey===key)))return false;
 state.office=key;state.constituency='';state.page=1;updateFilters();renderDirectory();return true;
}
function renderDirectorySelection(){const title=`${state.scope==='national'?'全台灣':state.county}｜${selectedOfficeLabel()}`;if($('#directory-selection-title').textContent!==title)$('#directory-selection-title').textContent=title;}
function renderDirectory(){renderDirectorySelection();renderDirectoryOfficeShortcuts();const list=filtered(),pageSize=12,pages=Math.ceil(list.length/pageSize);state.page=Math.max(1,Math.min(state.page,pages||1));$('#results-count').textContent=`${state.scope==='national'?'全台灣':state.county+(state.town?'・'+state.town:'')} · ${list.length.toLocaleString()} 筆登記資料`;$('#candidate-grid').innerHTML=list.length?list.slice((state.page-1)*pageSize,state.page*pageSize).map(card).join(''):'<div class="empty-results">這個篩選組合尚無資料。<br>試著調整職務、司法狀態或選區條件。<br>零筆結果不代表沒有犯罪紀錄或事件。</div>';const nums=[1,...Array.from({length:5},(_,i)=>state.page+i-2),pages].filter((n,i,a)=>n>=1&&n<=pages&&a.indexOf(n)===i).sort((a,b)=>a-b);$('#pagination').innerHTML=pages>1?`<button data-page="${state.page-1}" ${state.page===1?'disabled':''}>←</button>${nums.map((n,i)=>(i&&n-nums[i-1]>1?'<span>…</span>':'')+`<button data-page="${n}" class="${n===state.page?'active':''}" ${n===state.page?'aria-current="page"':''}>${n}</button>`).join('')}<button data-page="${state.page+1}" ${state.page===pages?'disabled':''}>→</button><span>第 ${state.page} / ${pages} 頁</span>`:'';const mapping=candidates.some(c=>c.officeKey==='council'&&!c.districtAreas?.length);$('#directory-notice').innerHTML=`${state.scope==='national'?'全台搜尋不限制目前地圖座標。 ':''}登記紀錄與最終候選人名單不同；資格不符者保留歷史並停用比較。${state.town&&state.scope==='county'?` ${state.county} ${state.town}的縣市長屬全縣市選票；議員依正式選區範圍比對；部分選區還分村里，須核對內頁公告，此導覽不代替投票資格判定。${mapping?'部分以村里劃分的議員選區尚未能對應行政區，先保留全縣市議員並請另選正式選區。':''}`:''} ${state.judicial?'司法篩選反映本版已查核資料，尚未查核者不會自動被視為沒有紀錄。':''}${link('https://web.cec.gov.tw/central/article/65213','審定依據')}`;updateURL();renderIssue();}
function renderRegion(){const m=countyMeta(),localRows=candidates.filter(coordinateMatch),bio=localRows.filter(c=>c.hasBio).length;$('#region-info').innerHTML=`<p class="eyebrow">REGION FILE / 地區卷宗</p><h3>${esc(state.county+(state.town?'・'+state.town:''))}</h3><p>${state.town?'以下包含此地的地方職務，以及全縣市首長與適用議員選區。':'官方登記名冊已收錄，詳細資料仍依各欄查核進度補齊。'}</p><div class="region-counts"><div><b>${localRows.length.toLocaleString()}</b><span>適用登記紀錄</span></div><div><b>${bio}</b><span>經歷已有來源</span></div><div><b>${m.confirmedConvictions}</b><span>全縣市定讞已核實</span></div></div><div class="region-progress"><span>✓ 官方名冊</span><span>◈ 背景逐人補查</span><span>◷ 最終公報待更新</span></div>`;renderStreet();}
function localTopics(){return topicData.topics.filter(t=>t.county===state.county&&(!t.districts?.length||!state.town||t.districts.includes(state.town)));}
function renderStreet(){const list=localTopics();if(!list.length){$('#street-panel').innerHTML=`<div class="street-heading"><h3>✧ 街角話題</h3><span>${esc(state.county)}</span></div><div class="street-bubble"><span class="speaker">卷宗嚮導・本站整理</span><p>這個座標的公開討論還在補查。可以先去全台話題廣場，或從候選人的政見與公共紀錄開始。</p></div><a class="text-link" href="#hot-topics">前往全台話題廣場 ↗</a><p class="street-disclaimer">沒有收錄話題，不代表當地沒有爭議。</p>`;return;}if(!list.some(t=>t.id===state.streetTopic)){state.streetTopic=list[0].id;state.streetStep=0;}const t=list.find(t=>t.id===state.streetTopic),i=Math.min(state.streetStep,t.steps.length-1),step=t.steps[i];$('#street-panel').innerHTML=`<div class="street-heading"><h3>✧ 街角話題</h3><span>關聯：${t.districts?.length?esc(t.districts.join('、')):'全'+esc(state.county)}</span></div><div class="street-topic-buttons">${list.map(x=>`<button data-street-topic="${x.id}" class="${x.id===t.id?'active':''}">${esc(x.shortTitle)}</button>`).join('')}</div><div class="street-bubble" aria-live="polite"><span class="speaker">卷宗嚮導・${esc(step.speaker)}</span><p>${esc(step.text)}</p>${links(step.sourceUrls)}</div><div class="street-foot"><button class="text-button" data-topic="${t.id}">完整脈絡 ↗</button><span>${i+1} / ${t.steps.length}</span><button class="text-button" id="street-next">${i<t.steps.length-1?'接著看 →':'重新閱讀 ↺'}</button></div><p class="street-disclaimer">對話由本站依來源整理，不是真實社群留言；全市話題不代表此區特有事件。</p>`;}
function renderBallots(){const rows=candidates.filter(coordinateMatch),keys=Object.keys(officeInfo).filter(k=>rows.some(c=>c.officeKey===k));$('#ballot-title').textContent=`${state.county}${state.town?'・'+state.town:''}，要選什麼？`;$('#ballot-grid').innerHTML=keys.map(k=>`<article class="ballot-card"><span class="ballot-icon" aria-hidden="true">${officeInfo[k].icon}</span><h3>${officeInfo[k].label}</h3><p>${officeInfo[k].description}</p><button data-office-jump="${k}">查看 ${rows.filter(c=>c.officeKey===k).length} 筆登記 <span>→</span></button></article>`).join('');$('#ballot-note').textContent='以上為所選地區相關類別，不代表每位選民都領取全部選票。實際資格、村里及原住民選區依戶籍、身分與正式公告確認；一般區長由市長依法任用。';}
async function setCounty(name,town='',village=''){if(!data.counties.some(c=>c.name===name))return;const ticket=++loadingTicket;state.county=name;state.town=town;state.village=village;state.scope='county';syncJudicialCounty();++policyRenderTicket;$('#issue-panel').innerHTML='<p role="status">正在同步縣市與政策資料…</p>';state.constituency='';state.party='';state.search='';state.page=1;state.streetTopic=null;state.streetStep=0;$('#search').value='';$('#candidate-grid').innerHTML='<div class="loading">正在移動座標、讀取地方卷宗…</div>';renderMap();try{const rows=await loadCounty(name);if(ticket!==loadingTicket)return;candidates=rows;if(!countyMeta().towns.includes(state.town))state.town='';updateCoordinates();updateFilters();renderRegion();renderBallots();renderDirectory();}catch{if(ticket!==loadingTicket)return;$('#candidate-grid').innerHTML='<div class="empty-results">地方卷宗未能讀取，請重新整理後再試。</div>';toast('資料讀取未成功，請重新整理。');}}
function onCoordinateChange(){state.constituency='';state.party='';state.page=1;state.streetStep=0;updateCoordinates();updateFilters();renderRegion();renderBallots();renderDirectory();}
async function getCandidate(id){if(candidateCache.has(id))return candidateCache.get(id);const entry=(await loadSearch()).find(c=>c.id===id);if(!entry)return null;await loadCounty(entry.county);return candidateCache.get(id);}
function campaignSloganFacts(c){
 const slogans=c.campaignSlogans||[];
 if(!slogans.length)return c.officeKey==='mayor'?pending('本版尚未核實本人的2026競選口號。'):'';
 return `<article class="fact candidate-slogans"><h3>本人／團隊公布的競選口號</h3>${slogans.map(s=>`<blockquote>${esc(s.text)}</blockquote><p>${esc(s.kind)} · 來源日期：${esc(s.date||'未標示')} · 查核：${esc(s.checkedAt)}</p>${link(s.url,s.sourceTitle)}`).join('')}</article>`;
}
function biography(c){return `<div class="profile-meta"><div><span>職務／正式選區</span>${esc(c.office)} · ${esc(c.constituency)}</div><div><span>推薦之政黨（非黨籍證明）</span>${partyPill(c.party)}</div><div><span>登記日期</span>${esc(c.registrationDate)}</div><div><span>資格狀態</span>${esc(c.eligibilityStatus)}</div></div>${c.eligibleToRun===false?pending(c.eligibilityReason||'官方審定不符參選資格，保留歷史登記。'):''}${c.nameVerificationStatus?.includes('待')?pending(c.nameVerificationStatus+'；□代表尚未核實的官方特殊字，未自行猜字。'):''}${campaignSloganFacts(c)}<h3>學歷與過往經歷</h3>${c.education.length?`<p>學歷：${esc(c.education.join('；'))}</p>`:''}${c.experience.length?`<ul>${c.experience.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:pending('尚未取得足以核實的完整經歷，不代表沒有經歷。')}<p>${esc(c.profileStatus)}</p>${links(c.biographySources)}${c.historicalPolicies.length?`<article class="fact"><h4>舊頁政策主題（未確認為本屆政見）</h4><p>${esc(c.historicalPolicies.join('、'))}</p><p>${esc(c.historicalPolicyNote)}</p>${links(c.biographySources)}</article>`:''}${c.districtAreaDescription?`<article class="fact"><h4>正式議員選區範圍</h4><p>${esc(c.districtAreaDescription)}</p>${c.isIndigenousConstituency?'<p>本選區有原住民身分條件，不能僅由居住行政區判斷投票資格。</p>':''}${links(c.districtScopeSource?[{url:c.districtScopeSource.url,title:`選區公告 PDF 第 ${c.districtScopeSource.pdfPage} 頁`}]:[])}</article>`:''}<article class="fact"><h4>官方登記與審定依據</h4><p>「無政黨推薦」不推定為無黨籍；抽籤號次未加入，資格與正式名單需依後續公告核對。</p>${links(c.sourceRefs.map(s=>({url:s.url,title:s.pdfPage?`官方名冊 PDF 第 ${s.pdfPage} 頁`:s.title||'資格審定依據'})))}</article>`;}
function policyFacts(c){return c.policies.length?c.policies.map(p=>`<article class="fact"><span class="fact-label">${esc(p.category)} · ${esc(p.date||'來源未註日期')}</span><h4>${esc(p.title)}</h4><p>${esc(p.summary)}</p>${links([{url:p.url,title:p.sourceTitle}])}</article>`).join('')+`<div class="analysis-note">本站判讀提示：${esc(c.policyAnalysis||'需再核對權限、財源、時程與成效指標。')}</div>`:pending('本版尚未取得可核實的2026本屆政見，待正式公報或具日期的公開資料補查；不等於沒有政見。')+links(c.sourceUrls.slice(0,1));}
function judicial(c){return `${c.judicialStatus==='confirmed_conviction'?'<div class="judicial-alert">⚑ 已核實刑事有罪定讞紀錄；請一併閱讀案情、日期與來源。</div>':''}<h3>${esc(c.criminalRecord.label)}</h3><p>${esc(c.criminalRecord.detail)}</p>${links(c.criminalRecord.sources||[c.criminalRecord.url||c.criminalRecord.sourceUrl].filter(Boolean))}<div class="analysis-note">司法欄與政治爭議分開；未查得不等於無前科。同一人可能有不同案件，本欄狀態不代表其他案件均已定讞。</div>${c.judicialEvents.map(e=>`<article class="fact"><span class="fact-label">${esc(e.type)}</span><h4>${esc(e.title)}</h4><p>已核實進度日期：${esc(e.latestKnownDate||e.date||'未註日期')}</p><p>${esc(e.summary)}</p>${e.response||e.candidateResponse?`<p><b>當事人回應：</b>${esc(e.response||e.candidateResponse)}</p>`:''}${e.limitation?`<p>${esc(e.limitation)}</p>`:''}${links(e.sources)}</article>`).join('')}<article class="fact">${link('https://judgment.judicial.gov.tw/FJUD/default.aspx','司法院查詢入口（非本人紀錄證明）')}</article>`;}
function controversies(c){return `<p>${esc(c.controversyStatus)}</p>${c.controversies.length?c.controversies.map(e=>`<article class="fact"><span class="fact-label">${esc(e.classification)} · ${esc(e.date||'未註日期')}</span><h4>${esc(e.title)}</h4><p><b>事件事實與指控：</b>${esc(e.fact)}</p><p><b>相關方回應：</b>${esc(e.response)}</p><p><b>已知進度：</b>${esc(e.progress)}</p>${links(e.urls)}</article>`).join(''):pending('本欄尚無可呈現的個別查核事件，不代表沒有爭議。')}`;}
function readingProgress(){$('#reading-progress').textContent=`✧ 已探索 ${state.visited.size} 位候選人的資料（此裝置）`;local.set('vote-visited',[...state.visited]);}
async function profile(id,tab='bio'){try{const previousId=state.current,wasOpen=$('#profile-dialog').open;const c=await getCandidate(id);if(!c)return toast('未找到這筆登記資料。');state.current=id;state.profileTab=tab;const tabs=[['bio','經歷與身分'],['policy','政見與可行性'],['judicial','司法紀錄'],['controversy','爭議與回應']];$('#profile-content').innerHTML=`<div class="dialog-header"><div><p class="eyebrow">CANDIDATE ENCYCLOPEDIA / 候選人圖鑑</p><h2>${esc(c.name)}</h2><p>${esc(c.county)} · ${esc(c.office)} · ${statusText(c)}</p></div><button class="close-dialog" data-close="profile-dialog" aria-label="關閉圖鑑">×</button></div><div class="profile-tabs" role="tablist" aria-label="圖鑑分類">${tabs.map(([k,l])=>`<button role="tab" aria-selected="${k===tab}" data-profile-tab="${k}" class="${k===tab?'active':''}">${l}</button>`).join('')}</div><div class="profile-body" role="tabpanel">${tab==='bio'?biography(c):tab==='policy'?policyFacts(c):tab==='judicial'?judicial(c):controversies(c)}<article class="fact"><button class="text-button" id="copy-profile-link">複製這位候選人的連結 ↗</button></article></div>`;state.visited.add(id);readingProgress();if(!$('#profile-dialog').open)$('#profile-dialog').showModal();trackSiteEvent(wasOpen&&previousId===id?'candidate_tab_view':'candidate_open',{county:c.county,office:c.officeKey,tab});}catch{toast('圖鑑讀取未成功，請再試一次。');}}
async function toggleCompare(id){const c=await getCandidate(id);if(!c||c.eligibleToRun===false)return;const removing=state.selected.includes(id);if(state.selected.includes(id))state.selected=state.selected.filter(x=>x!==id);else{if(state.selected.length>=3)return toast('最多並排比較3人，請先移除一位。');const first=candidateCache.get(state.selected[0]);if(first&&(first.county!==c.county||first.officeKey!==c.officeKey||first.constituency!==c.constituency))return toast('請選同一縣市、同職務、同正式選區的候選人。');state.selected.push(id);}renderTray();renderDirectory();trackSiteEvent('compare_selection',{action:removing?'remove':'add',item_count:state.selected.length,office:c.officeKey});}
function renderTray(){$('#compare-tray').hidden=!state.selected.length;$('#compare-title').textContent=`已選取 ${state.selected.length} / 3 人`;$('#compare-names').textContent=state.selected.map(id=>candidateCache.get(id).name).join('、');$('#open-compare').disabled=state.selected.length<2;}
function compare(){const people=state.selected.map(id=>candidateCache.get(id));if(people.length<2)return;const rows=[['推薦政黨',c=>partyPill(c.party)],['資格審定',c=>esc(c.eligibilityStatus)],['經歷與來源',c=>c.experience.length?`<p>${esc(c.experience.slice(0,4).join('；'))}</p>${links(c.biographySources)}`:'完整經歷待補查'],['本屆政策',c=>c.policies.length?c.policies.map(p=>`<p><b>${esc(p.title)}</b><br>${esc(p.category)}<br>${link(p.url,p.sourceTitle)}</p>`).join(''):'本屆政見尚待來源'],['可行性判讀',c=>esc(c.policyAnalysis||'取得政見後，再核對權限、財源、時程與指標。')],['司法紀錄',c=>`<p><b>${esc(c.criminalRecord.label)}</b></p><p>${esc(c.criminalRecord.detail)}</p>${c.judicialEvents.map(e=>`<p>${esc(e.title)}：${esc(e.type)}${links(e.sources)}</p>`).join('')}`],['爭議與回應',c=>c.controversies.length?c.controversies.map(e=>`<p><b>${esc(e.title)}</b><br>${esc(e.fact)}<br>回應：${esc(e.response)}<br>進度：${esc(e.progress)}${links(e.urls)}</p>`).join(''):'未完成個別查核，空白不代表沒有爭議。']];$('#compare-content').innerHTML=`<div class="dialog-header"><div><p class="eyebrow">SIDE BY SIDE / 並排閱讀卷宗</p><h2>${esc(people[0].office)}候選人比較</h2><p>${esc(people[0].constituency)}</p></div><button class="close-dialog" data-close="compare-dialog" aria-label="關閉比較">×</button></div><p class="comparison-note">資料多寡不代表候選人優劣。本表不計算總分。手機可橫向滑動閱讀。</p><div class="comparison-wrap"><table class="comparison-table"><thead><tr><th scope="col">檢視角度</th>${people.map(c=>`<th scope="col">${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([l,f])=>`<tr><th scope="row">${l}</th>${people.map(c=>`<td>${f(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;$('#compare-dialog').showModal();trackSiteEvent('compare_open',{item_count:people.length,office:people[0].officeKey});}
function renderHotWidget(){const topics=[...topicData.topics].sort((a,b)=>b.date.localeCompare(a.date));$('#hot-widget-count').textContent=topics.length;$('#hot-widget-topics').innerHTML=topics.map(t=>`<button class="hot-widget-topic" data-topic="${esc(t.id)}"><span>${esc(t.category)} · ${esc(t.date)}</span><strong>${esc(t.title)}</strong><small>${esc(t.summary)}</small><b>打開話題卷宗 →</b></button>`).join('');}
function setHotWidget(open){$('#hot-widget-panel').hidden=!open;$('#hot-widget-toggle').setAttribute('aria-expanded',String(open));$('#hot-widget-label').textContent=open?'收合熱門話題':'選舉熱門話題';(open?$('#hot-widget-close'):$('#hot-widget-toggle')).focus();}
function renderHotTopics(){$('#hot-total').textContent='（'+topicData.topics.length+'則）';$('#hot-count').textContent=topicData.topics.filter(t=>state.hotCategory==='全部'||t.category===state.hotCategory).length+' 則話題・左右滑動閱讀';const cats=['全部',...new Set(topicData.topics.map(t=>t.category))];$('#hot-filters').innerHTML=cats.map(c=>`<button data-hot-filter="${c}" class="${c===state.hotCategory?'active':''}" aria-pressed="${c===state.hotCategory}">${c}</button>`).join('');$('#hot-grid').innerHTML=topicData.topics.filter(t=>state.hotCategory==='全部'||t.category===state.hotCategory).map(t=>`<article class="hot-card"><span class="topic-symbol" aria-hidden="true">${t.symbol}</span><div class="hot-meta">${esc(t.category)} · ${esc(t.date)}</div><h3>${esc(t.title)}</h3><p>${esc(t.summary)}</p><div class="hot-tags">${t.relatedNames.map(n=>`<span>${esc(n)}</span>`).join('')}<span>${esc(t.county||'全台選務')}</span></div><button data-topic="${t.id}">打開話題卷宗 →</button></article>`).join('');}
function openTopic(id){const t=topicData.topics.find(x=>x.id===id);if(!t)return;$('#topic-content').innerHTML=`<div class="dialog-header"><div><p class="eyebrow">TOWN SQUARE / 話題卷宗</p><h2>${esc(t.title)}</h2><p>${esc(t.category)} · ${esc(t.date)} · 關聯：${esc(t.county||'全台')}</p></div><button class="close-dialog" data-close="topic-dialog" aria-label="關閉話題">×</button></div><div class="profile-body"><p>${esc(t.summary)}</p><div class="analysis-note">近期議題編選，不是聲量排名。以下脈絡由本站依來源整理，不是真實留言逐字紀錄。</div>${t.steps.map(s=>`<article class="fact"><h4>${esc(s.speaker)}</h4><p>${esc(s.text)}</p>${links(s.sourceUrls)}</article>`).join('')}<article class="fact"><h4>留給你的判讀問題</h4><p>${esc(t.question)}</p></article><div class="topic-actions">${t.relatedNames.map(n=>`<button data-topic-person="${esc(n)}" data-topic-county="${esc(t.county)}">查看 ${esc(n)} 的圖鑑 →</button>`).join('')}</div></div>`;$('#topic-dialog').showModal();}
let policyRenderTicket=0,policyFilterKey='';
function policyPerson(c,issue){
 const ps=(c.policies||[]).filter(p=>issue.id==='finance'||p.topics?.includes(issue.id));
 return `<article class="policy-item" data-policy-person="${esc(c.id)}"><div><h4>${esc(c.name)}</h4><p class="policy-person-meta">${esc(c.county)} · ${esc(c.office)}<br>${esc(c.constituency||'')}</p><span class="chip">${ps.length?'有相關資料':'資料待補'}</span></div><div>${ps.length?ps.slice(0,3).map(p=>`<p><b>${esc(p.title)}</b><br><span class="chip">${esc(p.category)}</span><br>${esc(p.summary)}</p>${link(p.url,`${p.sourceTitle} · ${p.date||'未註日期'}`)}`).join(''):'<p>本版尚未整理到可核實的本屆相關主張，不等於沒有提出。</p>'}<div class="analysis-note">本站判讀提示：${esc(c.policyAnalysis||'資料不足，先保留判斷；再按相同欄位補查原始政見。')}</div><button class="text-button" data-profile="${esc(c.id)}" data-tab="policy">完整政策資料 ↗</button></div></article>`;
}
async function renderIssue(){
 if(!data)return;
 const ticket=++policyRenderTicket,issue=issues.find(i=>i.id===state.issue)||issues[0];
 const key=JSON.stringify([state.scope,state.county,state.town,state.village,state.office,state.constituency,state.party,state.judicial,state.eligibility,state.search]);
 if(key!==policyFilterKey){policyFilterKey=key;state.issuePage=1;}
 const people=filtered(),size=12,pages=Math.ceil(people.length/size);
 state.issuePage=Math.max(1,Math.min(state.issuePage||1,pages||1));
 const page=state.issuePage,visible=people.slice((page-1)*size,page*size);
 const place=state.scope==='national'?'全台灣':[state.county,state.town,state.village].filter(Boolean).join('・');
 $('#policy-county-label').textContent=`${place}｜${selectedOfficeLabel()} · ${people.length.toLocaleString()} 筆，與上方圖鑑篩選同步。${state.constituency?' '+state.constituency+'。':''}`;
 $('#issue-tabs').innerHTML=issues.map(i=>`<button role="tab" id="issue-${i.id}" aria-selected="${i.id===state.issue}" aria-controls="issue-panel" data-issue="${i.id}" class="${i.id===state.issue?'active':''}">${i.label}</button>`).join('');
 $('#issue-panel').setAttribute('aria-labelledby',`issue-${issue.id}`);
 const intro=`<div class="issue-intro"><p class="eyebrow">你可以這樣追問</p><h3>${issue.title}</h3><ul>${issue.questions.map(q=>`<li>${q}</li>`).join('')}</ul>${officeInfo[state.office]?`<p>${esc(officeInfo[state.office].description)}</p>`:''}<p>政策主張、任內施政與本站判讀提示分開呈現。</p></div>`;
 const missingCounties=[...new Set(visible.filter(c=>!candidateCache.has(c.id)).map(c=>c.county))];
 if(missingCounties.length){
  $('#issue-panel').innerHTML=intro+'<div class="policy-list"><p role="status">正在同步所選候選人的政策資料…</p></div>';
  try{await Promise.all(missingCounties.map(loadCounty));}
  catch{if(ticket===policyRenderTicket)$('#issue-panel').innerHTML=intro+'<div class="policy-list"><p role="status">政策資料未能讀取，這不是沒有政見。</p><button type="button" class="text-button" data-issue-retry>重新載入政策 ↺</button></div>';return;}
 }
 if(ticket!==policyRenderTicket)return;
 const rows=visible.map(c=>candidateCache.get(c.id)||c);
 const count=people.length?`第 ${(page-1)*size+1}–${Math.min(page*size,people.length)} 筆／共 ${people.length.toLocaleString()} 筆`:'目前篩選結果為 0 筆';
 const paging=pages>1?`<nav class="pagination policy-pagination" aria-label="政策名單分頁"><button type="button" data-issue-page="${page-1}" aria-label="上一頁政策名單" ${page===1?'disabled':''}>← 上一頁</button><span>第 ${page}／${pages} 頁</span><button type="button" data-issue-page="${page+1}" aria-label="下一頁政策名單" ${page===pages?'disabled':''}>下一頁 →</button></nav>`:'';
 $('#issue-panel').innerHTML=intro+`<div class="policy-list"><p class="policy-scope-summary">${count} · 名單依官方登記順序，不以資料多寡排名。</p>${rows.length?rows.map(c=>policyPerson(c,issue)).join(''):'<div class="empty-results">這組圖鑑篩選目前沒有候選人。請調整上方縣市、職務或其他條件。</div>'}${paging}</div>`;
}
$('#perspectives').addEventListener('click',e=>{
 const b=e.target.closest('[data-issue-page], [data-issue-retry]');if(!b)return;
 if(b.dataset.issuePage)state.issuePage=Number(b.dataset.issuePage);renderIssue();
});
async function setScope(scope){state.scope=scope;syncJudicialCounty();state.constituency='';state.party='';state.page=1;if(scope==='national'){toast('正在展開全台索引…');await loadSearch();}updateFilters();renderDirectory();}
function resetFilters(){state.office='all';state.constituency='';state.party='';state.judicial='';state.eligibility='';state.search='';state.page=1;$('#search').value='';updateFilters();renderDirectory();}
function setupOpeningFilm(){
 if(typeof HTMLDialogElement==='undefined'){const cover=$('#opening-intro');if(cover){cover.hidden=true;cover.removeAttribute?.('open');}$('#intro-film')?.pause?.();return Promise.resolve();}
 const intro=$('#opening-intro'),video=$('#intro-film'),skip=$('#skip-intro'),pause=$('#pause-intro'),sound=$('#sound-intro');
 if(!intro||!video)return Promise.resolve();
 // Promote the first-paint cover to a native modal without leaving the page exposed.
 if(intro.open)intro.removeAttribute('open');
 let finish;const finished=new Promise(resolve=>finish=resolve);
 const updatePlayback=()=>{pause.textContent=video.paused?'播放動畫':'暫停動畫';};
 const close=()=>{if(intro.open)intro.close();};
 intro.addEventListener('close',()=>{video.pause();finish();});
 video.addEventListener('ended',close);video.addEventListener('error',close);
 video.addEventListener('play',updatePlayback);video.addEventListener('pause',updatePlayback);
 pause.addEventListener('click',()=>{if(video.paused)video.play().catch(updatePlayback);else video.pause();});
 sound.addEventListener('click',()=>{video.muted=!video.muted;sound.textContent=video.muted?'開啟聲音':'關閉聲音';sound.setAttribute('aria-pressed',String(!video.muted));});
 function open(manual=false){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches&&!manual){video.pause();finish();return;}
  if(intro.open)return;
  intro.dataset.manual=String(manual);video.currentTime=0;video.muted=true;sound.textContent='開啟聲音';sound.setAttribute('aria-pressed','false');
  intro.showModal();skip.focus({preventScroll:true});video.play().catch(updatePlayback);
 }
 $('#replay-intro').addEventListener('click',()=>open(true));
 if(video.error){video.pause();finish();return finished;}open();return finished;
}
async function init(){try{[data,mapData,topicData]=await Promise.all([fetchJson('data.json'),fetchJson('map.json'),fetchJson('topics.json')]);const params=new URL(location.href).searchParams;state.county=data.counties.some(c=>c.name===params.get('county'))?params.get('county'):'基隆市';state.office=officeInfo[params.get('office')]||params.get('office')==='all'?params.get('office'):'mayor';state.town=params.get('town')||'';state.village=params.get('village')||'';$('#total-records').textContent=data.total.toLocaleString();$('#checked-date').textContent=data.checkedAt.replaceAll('-','.');$('#coverage-report').innerHTML=`<strong>全台名冊：</strong>22縣市、9類、${data.total.toLocaleString()}筆登記；${data.counts.disqualified}筆資格不符歷史另行標記。<br><strong>資料深度：</strong>${data.counts.biographies}人有經歷來源、${data.counts.policies}人有政策或施政資料；${data.counts.confirmedConvictions}人有已核實刑事定讞紀錄。這些數量只代表本版已核實範圍，不代表其餘人沒有紀錄。<br><strong>首長資料：</strong>${data.coverage.byOffice.mayor.biographies}/${data.coverage.byOffice.mayor.total}位有部分經歷來源，${data.coverage.byOffice.mayor.policies}/${data.coverage.byOffice.mayor.total}位有政策來源。<br><strong>歷史資料：</strong>${data.coverage.historicalCatalog?.people||0}位補有111年度（2022）官方名錄學經歷；已逐條標年，不代表目前現職或2026政見。<br><strong>本批補查：</strong>${data.latestResearchBatch.checkedAt}，${data.latestResearchBatch.candidates}位新增或補充資料。<br><strong>待補：</strong>多數個別司法、政見與爭議仍待查核；${data.counts.nameGlyphPending}筆姓名特殊字待原件確認。本版尚未完成全體參選人的完整背景調查。`;$('#source-list').innerHTML=data.sources.map((s,i)=>`<a class="source-entry" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span>${String(i+1).padStart(2,'0')}</span><div>${esc(s.title)}<small>${esc(s.publisher)}</small></div><span>↗</span></a>`).join('');if(Date.now()>new Date(data.editorialDeadline).getTime())$('#period-label').textContent='資料整理已截止・保留閱讀';setTheme(params.get('theme')||local.get('vote-theme-fantasy-release','fantasy'));const large=local.get('vote-large-type',false);document.documentElement.classList.toggle('large-type',large);$('#font-control').setAttribute('aria-pressed',String(large));renderHotTopics();renderHotWidget();readingProgress();await setCounty(state.county,state.town,state.village);const id=params.get('candidate');if(id){await openingFinished;await profile(id);}}catch(e){$('#candidate-grid').innerHTML='<div class="empty-results">資料未能載入，請重新整理，或直接閱讀<a href="https://web.cec.gov.tw/central/article/64709">官方名冊 ↗</a>。</div>';$('#results-count').textContent='資料載入失敗';}}
document.addEventListener('click',async e=>{if(e.target.closest('[href="#hot-topics"]')){$('#hot-disclosure').open=true;if(!$('#hot-widget-panel').hidden)setHotWidget(false);}const county=e.target.closest('[data-county]');if(county){await setCounty(county.dataset.county);$('#coordinates').scrollIntoView({behavior:'smooth'});return;}const b=e.target.closest('button');if(!b)return;try{if(b.id==='hot-widget-toggle'){setHotWidget($('#hot-widget-panel').hidden);return;}if(b.id==='hot-widget-close'){setHotWidget(false);return;}if(b.dataset.themeChoice)setTheme(b.dataset.themeChoice);if(b.dataset.preset){const [county,town]=b.dataset.preset.split('|');await setCounty(county,town);$('#coordinates').scrollIntoView({behavior:'smooth'});}if(b.dataset.officeJump){state.office=b.dataset.officeJump;state.scope='county';syncJudicialCounty();state.constituency='';state.page=1;updateFilters();renderDirectory();$('#directory').scrollIntoView({behavior:'smooth'});}if(b.dataset.profile)await profile(b.dataset.profile,b.dataset.tab||'bio');if(b.dataset.profileTab)await profile(state.current,b.dataset.profileTab);if(b.dataset.compare)await toggleCompare(b.dataset.compare);if(b.dataset.close)document.getElementById(b.dataset.close).close();if(b.dataset.page){state.page=Number(b.dataset.page);renderDirectory();$('#results-count').scrollIntoView({behavior:'smooth'});}if(b.dataset.issue){state.issue=b.dataset.issue;renderIssue();}if(b.dataset.hotFilter){state.hotCategory=b.dataset.hotFilter;renderHotTopics();}if(b.dataset.topic)openTopic(b.dataset.topic);if(b.dataset.streetTopic){state.streetTopic=b.dataset.streetTopic;state.streetStep=0;renderStreet();}if(b.id==='street-next'){const t=topicData.topics.find(t=>t.id===state.streetTopic);state.streetStep=(state.streetStep+1)%t.steps.length;renderStreet();}if(b.dataset.topicPerson){$('#topic-dialog').close();await setCounty(b.dataset.topicCounty);state.office='mayor';state.search=b.dataset.topicPerson;$('#search').value=state.search;updateFilters();renderDirectory();$('#directory').scrollIntoView({behavior:'smooth'});}if(b.id==='hot-prev'||b.id==='hot-next'){const grid=$('#hot-grid');grid.scrollBy({left:(b.id==='hot-next'?1:-1)*grid.clientWidth*.9,behavior:'smooth'});}if(b.id==='font-control'){const active=document.documentElement.classList.toggle('large-type');b.setAttribute('aria-pressed',String(active));local.set('vote-large-type',active);toast(active?'已切換為更大字級。':'已回到標準大字閱讀。');}if(b.id==='map-national'){resetFilters();await setScope('national');$('#directory').scrollIntoView({behavior:'smooth'});}if(b.id==='reset-filters')resetFilters();if(b.id==='clear-compare'){state.selected=[];renderTray();renderDirectory();}if(b.id==='open-compare')compare();if(b.id==='show-national-convictions'){state.office='all';state.judicial='confirmed_conviction';state.eligibility='';state.search='';$('#search').value='';await setScope('national');}if(b.id==='download-data'){const blob=new Blob([JSON.stringify({metadata:data,county:state.county,candidates,topics:localTopics()},null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`taiwan-election-${state.county}-${data.checkedAt}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}if(b.id==='copy-profile-link'){const url=new URL(location.href),c=candidateCache.get(state.current);url.searchParams.set('candidate',state.current);url.searchParams.set('county',c.county);url.hash='';try{await navigator.clipboard.writeText(url.href);toast('圖鑑連結已複製。');}catch{toast('瀏覽器未允許剪貼簿，請手動複製頁面網址。');}}}catch{toast('資料讀取未成功，請再試一次。');}});
$('#county').addEventListener('change',e=>setCounty(e.target.value));$('#town').addEventListener('change',e=>{state.town=e.target.value;state.village='';onCoordinateChange();});$('#village').addEventListener('change',e=>{state.village=e.target.value;onCoordinateChange();});$('#scope').addEventListener('change',e=>setScope(e.target.value));$('#directory-county').addEventListener('change',e=>e.target.value?setCounty(e.target.value):setScope('national'));$('#search').addEventListener('input',e=>{state.search=e.target.value;state.page=1;renderDirectory();trackSiteEvent('directory_search',{has_query:!!state.search.trim(),result_count:filtered().length});});for(const [id,key] of [['office','office'],['constituency','constituency'],['party','party'],['judicial-filter','judicial'],['eligibility-filter','eligibility']])$('#'+id).addEventListener('change',e=>{state[key]=e.target.value;state.page=1;if(key==='office'){state.constituency='';updateFilters();}renderDirectory();});for(const id of ['profile-dialog','compare-dialog','topic-dialog'])$('#'+id).addEventListener('click',e=>{if(e.target!==e.currentTarget)return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();});
document.addEventListener('keydown',async e=>{if(e.key==='Escape'&&e.target.closest('.hot-widget')&&!$('#hot-widget-panel').hidden){e.preventDefault();setHotWidget(false);return;}const c=e.target.closest('[data-county]');if(c&&['Enter',' '].includes(e.key)){e.preventDefault();await setCounty(c.dataset.county);trackSiteEvent('county_select',{county:c.dataset.county,entry_point:'map'});return;}const b=e.target.closest('[role="tab"]');if(!b||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const isIssue=!!b.dataset.issue,list=isIssue?issues.map(i=>i.id):['bio','policy','judicial','controversy'];let i=list.indexOf(isIssue?b.dataset.issue:b.dataset.profileTab);i=e.key==='Home'?0:e.key==='End'?list.length-1:(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length;e.preventDefault();if(isIssue){state.issue=list[i];renderIssue();trackSiteEvent('policy_topic_select',{topic:state.issue});$(`[data-issue="${list[i]}"]`).focus();}else{await profile(state.current,list[i]);$(`[data-profile-tab="${list[i]}"]`).focus();}});
$('#directory-office-shortcuts')?.addEventListener('click',e=>{const button=e.target.closest('[data-directory-office]');if(button)selectDirectoryOffice(button.dataset.directoryOffice);});
const openingFinished=setupOpeningFilm();
init();

function setupChapterNavigation(){
 const dock=document.querySelector('.chapter-dock');if(!dock||typeof requestAnimationFrame!=='function')return;
 const list=dock.querySelector('.chapter-links'),links=[...dock.querySelectorAll('a[href^="#"]')];
 const sections=links.map(a=>document.getElementById(a.hash.slice(1)));
 let current='',queued=false;
 function mark(id){
  if(current===id)return;current=id;const chapter={coordinates:'01',ballot:'02',directory:'03',perspectives:'04','judicial-records':'05',method:'06','hot-topics':'07'}[id];if(chapter)trackSiteEvent('chapter_view',{chapter});
  for(const a of links){if(a.hash==='#'+id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');}
  if(matchMedia('(max-width:1279px)').matches){const a=links.find(a=>a.hash==='#'+id);if(a)list.scrollTo({left:a.offsetLeft-(list.clientWidth-a.offsetWidth)/2,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}
 }
 function update(){
  queued=false;const header=document.querySelector('.site-header'),line=Math.max((header?.getBoundingClientRect().height||0)+24,innerHeight*.28);
  let selected=sections[0];for(const section of sections){if(section.getBoundingClientRect().top<=line)selected=section;else break;}
  if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)selected=sections.at(-1);
  mark(selected.id);
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
 for(const a of links)a.addEventListener('click',()=>{const section=document.getElementById(a.hash.slice(1)),heading=section.querySelector('h2');mark(section.id);const hotPanel=document.getElementById('hot-widget-panel');if(hotPanel&&!hotPanel.hidden)setHotWidget(false);if(heading){heading.setAttribute('tabindex','-1');requestAnimationFrame(()=>heading.focus({preventScroll:true}));}});
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',()=>{current='';schedule();});addEventListener('load',schedule);
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(schedule).observe(document.querySelector('main'));
 update();
}
setupChapterNavigation();

const judicialView={category:'all',eligibility:'all',county:''};
let judicialIndex=null;
function judicialSelection(index,view){
 return index.people.filter(c=>(view.category==='all'||c.categoryIds.includes(view.category))&&(!view.county||c.county===view.county)&&(view.eligibility==='all'||view.eligibility==='eligible'&&c.eligibleToRun===true||view.eligibility==='history'&&c.eligibleToRun===false));
}
function renderJudicialRecordCard(c){
 const visibleCases=c.cases.filter(e=>judicialView.category==='all'||e.categoryIds.includes(judicialView.category));
 return `<article class="judicial-record-card" data-party-code="${partyCode(c.party)}" data-judicial-card="${esc(c.id)}"><div class="party-stripe" aria-hidden="true"></div><div class="judicial-record-content"><p class="judicial-final-label">刑事有罪確定・已核實</p><h3>${esc(c.name)}</h3><p class="judicial-person-meta">${esc(c.county)} · ${esc(c.office)} · ${esc(c.constituency||'')}</p>${partyPill(c.party)}<p class="judicial-eligibility ${c.eligibleToRun===false?'is-history':''}">${c.eligibleToRun===false?'資格審定不合格・歷史登記':c.eligibleToRun===true?'本屆資格審定通過':'本屆資格仍待核對'}</p><ul class="judicial-case-list">${visibleCases.map(e=>`<li><h4>${esc(e.offense)}</h4><p class="judicial-evidence-kind">${esc(e.basis)} · ${esc(e.latestKnownDate)}</p><p class="judicial-case-number">${esc(e.courtCase||'官方公告未提供法院案號')}</p><details><summary>判決摘要與來源限制</summary><p>${esc(e.summary)}</p>${e.limitation?`<p class="judicial-source-limit">${esc(e.limitation)}</p>`:''}${e.response?`<p><b>當事人回應：</b>${esc(e.response)}</p>`:''}</details>${links(e.sources)}</li>`).join('')}</ul><button class="text-button" data-profile="${esc(c.id)}" data-tab="judicial">查看完整司法資料 ↗</button></div></article>`;
}
function syncJudicialCounty(){
 judicialView.county=state.scope==='national'?'':state.county;
 if($('#crime-county'))$('#crime-county').value=judicialView.county;
 renderJudicialRecords();
}
function renderJudicialRecords(){
 if(!judicialIndex)return;
 const index=judicialIndex,selected=judicialSelection(index,judicialView),label=judicialView.category==='all'?'全部犯罪類型':index.categories.find(c=>c.id===judicialView.category).label;
 const countyPeople=judicialSelection(index,{category:'all',eligibility:'all',county:judicialView.county});
 const eligible=countyPeople.filter(c=>c.eligibleToRun===true).length,history=countyPeople.filter(c=>c.eligibleToRun===false).length;
 $('#judicial-overview').innerHTML=[['已核實刑事有罪確定',countyPeople.length],['其中資格審定通過',eligible],['資格不符・歷史登記',history]].map(([label,count])=>`<div><strong>${count}</strong><span>${label}</span></div>`).join('');
 $('#crime-category-filters').innerHTML=[{id:'all',label:'全部類型'},...index.categories].map(c=>`<button data-crime-category="${c.id}" aria-pressed="${c.id===judicialView.category}">${esc(c.label)} <span>${c.id==='all'?countyPeople.length:countyPeople.filter(p=>p.categoryIds.includes(c.id)).length}</span></button>`).join('');
 $('#crime-eligibility-filters').innerHTML=[['all','全部登記',countyPeople.length],['eligible','資格審定通過',eligible],['history','資格不符歷史',history]].map(([id,label,count])=>`<button data-crime-eligibility="${id}" aria-pressed="${id===judicialView.eligibility}">${label} ${count}</button>`).join('');
 $('#judicial-results-count').textContent=`${judicialView.county||'全台'} · ${label} · ${selected.length} 位已核實登記者`;
 $('#judicial-record-grid').innerHTML=selected.length?selected.map(renderJudicialRecordCard).join(''):`<div class="judicial-empty"><h3>這個條件下，尚未收錄已核實資料。</h3><p>不代表${judicialView.county?esc(judicialView.county):'全台'}沒有相關紀錄，也不代表其他登記者沒有前科；本版仍在逐人補查。</p>${judicialView.eligibility!=='all'||judicialView.category!=='all'?'<button class="text-button" data-crime-reset>重設類型與資格篩選 →</button>':''}</div>`;
 const pending=index.pending.filter(c=>!judicialView.county||c.county===judicialView.county);
 $('#judicial-pending-list').innerHTML=pending.length?pending.map(c=>`<li><span><strong>${esc(c.name)}</strong> · ${esc(c.county)} · ${esc(c.office)}<small>${esc(c.procedureLabel||judicialLabels[c.judicialStatus])}</small></span><button class="text-button" data-profile="${esc(c.id)}" data-tab="judicial">閱讀程序狀態 ↗</button></li>`).join(''):'<li>目前縣市範圍尚未收錄這類程序資料。</li>';
 $('#judicial-pending-count').textContent=pending.length;
}
async function setupJudicialRecords(){
 const section=$('#judicial-records');if(!section)return;
 try{
  judicialIndex=await fetchJson('judicial.json');const index=judicialIndex;
  $('#judicial-coverage-note').textContent=`全台尚有 ${index.counts.notChecked.toLocaleString()} / ${index.counts.totalRegistrations.toLocaleString()} 位登記者未完成個別司法查核；沒有列出或沒有標記，不代表沒有犯罪紀錄。`;
  const counties=await (data?Promise.resolve(data.counties):fetchJson('data.json').then(d=>d.counties));
  optionList($('#crime-county'),counties.map(c=>c.name),state.scope==='national'?'':state.county,'全台灣（不限縣市）');
  section.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;let changed=false;if(b.dataset.crimeCategory){judicialView.category=b.dataset.crimeCategory;changed=true;}if(b.dataset.crimeEligibility){judicialView.eligibility=b.dataset.crimeEligibility;changed=true;}if(b.hasAttribute('data-crime-reset')){judicialView.category='all';judicialView.eligibility='all';changed=true;}if(changed)renderJudicialRecords();});
  $('#crime-county').addEventListener('change',async e=>{try{if(e.target.value)await setCounty(e.target.value);else await setScope('national');}catch{toast('資料讀取未成功，請再試一次。');}});
  syncJudicialCounty();
 }catch{ $('#judicial-record-grid').innerHTML='<div class="judicial-empty"><p>刑事紀錄資料未能載入，請重新整理。</p><button class="text-button" id="retry-judicial">重新讀取資料 ↻</button></div>';$('#retry-judicial')?.addEventListener('click',setupJudicialRecords,{once:true}); }
}
setupJudicialRecords();

// Source-backed party facts, card labels, and local-only household guidance.
let voterGuideData=null,partyGuideData=null,addressChoice=null,addressRequest=0;
const countyChangeBeforeGuide=setCounty,coordinateChangeBeforeGuide=onCoordinateChange;
setCounty=function(...args){addressRequest++;return countyChangeBeforeGuide(...args);};
onCoordinateChange=function(){addressRequest++;return coordinateChangeBeforeGuide();};
const voterNorm=s=>String(s||'').normalize('NFKC').replace(/台/g,'臺').replace(/[\s,，。]/g,'');
function parseHouseholdAddress(raw,lookup){
 const input=voterNorm(raw).replace(/^\d{3,6}/,'');
 const county=lookup.counties.find(c=>input.startsWith(voterNorm(c.name)));
 if(!county)return{error:'請先填入縣市全名，例如「臺北市」或「新竹縣」。'};
 const rest=input.slice(voterNorm(county.name).length),town=county.towns.find(t=>rest.startsWith(voterNorm(t)));
 if(!town)return{error:'請接著填入鄉鎮市區，例如「'+county.name+county.towns[0]+'」。'};
 const tail=rest.slice(voterNorm(town).length),villages=[...(county.villages[town]||[])].sort((a,b)=>b.length-a.length);
 const village=villages.find(v=>tail.startsWith(voterNorm(v)))||'';
 return{county:county.name,town,village};
}
function councilChoices(location,identity='unsure',lookup=voterGuideData){
 if(!lookup)return[];
 return lookup.council.filter(r=>{
  if(r.county!==location.county||!r.towns.includes(location.town))return false;
  if(r.indigenous){if(identity==='general')return false;if(identity==='plain'&&!String(r.indigenousType||r.scope).includes('平地'))return false;if(identity==='mountain'&&!String(r.indigenousType||r.scope).includes('山地'))return false;return true;}
  if(identity==='plain'||identity==='mountain')return false;
  if(r.kind==='village'&&location.village)return r.members.some(m=>m.town===location.town&&m.village===location.village);
  return r.kind==='town'||r.kind==='village';
 });
}
function candidateCardTags(c){
 const status=c.judicialStatus||'not_checked',tags=[];
 if(status==='confirmed_conviction')for(const tag of voterGuideData?.criminalTags[c.id]||[])tags.push(`<button class="chip conviction-type" data-profile="${esc(c.id)}" data-tab="judicial" title="已核實刑事有罪確定；點開查看裁判與來源">定讞｜${esc(tag.text)} ↗</button>`);
 else if(status==='non_final')tags.push('<span class="chip ongoing">案件尚未定讞</span>');
 else if(status==='reported_conviction')tags.push('<span class="chip ongoing">報導紀錄・原始裁判待補</span>');
 else if(status==='searched_no_verified_conviction')tags.push('<span class="chip" title="只代表目前查核範圍；不是無前科證明">查核範圍內未查得定讞</span>');
 else tags.push('<span class="chip pending">司法尚待查核</span>');
 for(const tag of voterGuideData?.personTags[c.id]||[])tags.push(`<span class="chip ${tag.kind==='experience'?'experience':'policy-topic'}" title="${esc(tag.detail||'已有公開來源，點開圖鑑閱讀原文與限制')}">${esc(tag.text)}</span>`);
 tags.push(`<span class="chip">${c.hasBio?'經歷附來源':'經歷待補'}</span>`);
 if(!voterGuideData?.personTags[c.id]?.some(t=>t.kind==='policy'))tags.push(`<span class="chip">${c.hasPolicy?'政策有資料':'本屆政見待補'}</span>`);
 if(c.nameVerificationStatus?.includes('待'))tags.push('<span class="chip ongoing">姓名特殊字待核對</span>');
 return tags.join('');
}
const plainCard=card;
card=function(c){return plainCard(c).replace(/<div class="candidate-chips">[\s\S]*?<\/div>/,`<div class="candidate-chips" aria-label="${esc(c.name)}的資料標籤">${candidateCardTags(c)}</div>`);};
partyPill=function(party){return `<button type="button" class="party-pill" data-party-code="${partyCode(party)}" data-party-info="${esc(party)}" title="推薦政黨：${esc(party)}；點開介紹" aria-label="認識${esc(party)}">${esc(party)} ↗</button>`;};
const plainCoordinateMatch=coordinateMatch;
coordinateMatch=function(c){
 if(c.officeKey==='council'&&state.town&&voterGuideData){const rule=voterGuideData.council.find(r=>r.county===c.county&&r.constituency===c.constituency);
  if(rule?.kind==='village')return state.village?rule.members.some(m=>m.town===state.town&&m.village===state.village):rule.towns.includes(state.town);
 }
 return plainCoordinateMatch(c);
};
function syncLocalFilters(){
 if(!data)return;
 optionList($('#directory-town'),countyMeta().towns,state.town,'全縣市');$('#directory-town').disabled=state.scope==='national';
 const vs=[...new Set(candidates.filter(c=>c.officeKey==='village'&&c.district===state.town).map(c=>c.village).filter(Boolean))];
 optionList($('#directory-village'),vs,state.village,'全部村里');$('#directory-village').disabled=state.scope==='national'||!state.town;
 if(addressChoice&&(addressChoice.county!==state.county||addressChoice.town!==state.town)){addressChoice=null;$('#address-results').innerHTML='';$('#address-status').textContent='座標已變更；可以重新輸入戶籍地。';$('#household-address').value='';optionList($('#address-village'),[],'','先輸入縣市與鄉鎮區');$('#address-village').disabled=true;}
 if(addressChoice){addressChoice.village=state.village;optionList($('#address-village'),vs,state.village,'請確認戶籍村里');$('#address-village').disabled=false;renderAddressResults();}
}
function renderConstituencyGuide(){
 const box=$('#constituency-guide');if(!box||!voterGuideData||!data)return;
 if(state.scope==='national'){box.innerHTML='<h4>先選縣市與鄉鎮區，找到你的議員選區。</h4><p>全台搜尋目前包含不同選區；切換到所在地後，會顯示正式選區範圍。</p>';return;}
 if(state.office!=='council'){box.innerHTML='';return;}
 if(!state.town){box.innerHTML='<h4>議員要看哪一區？</h4><p>先選「鄉鎮市區」，這裡會對照正式議員選區；行政區和選舉區不一定相同。</p>';return;}
 const location={county:state.county,town:state.town,village:state.village},identity=addressChoice&&addressChoice.county===state.county&&addressChoice.town===state.town?$('#voter-identity').value:'unsure',choices=councilChoices(location,identity),needsVillage=choices.some(r=>r.kind==='village')&&!state.village;
 box.innerHTML=`<h4>${esc(state.county+'・'+state.town+(state.village?'・'+state.village:''))}，議員看這裡</h4>${needsVillage?'<p><strong>這個行政區分屬不同議員選區，請再選戶籍村里。</strong></p>':''}<ul>${choices.map(r=>`<li><button class="text-button" data-guide-constituency="${esc(r.constituency)}">${esc(r.constituency)}${r.indigenous?'（'+esc(r.indigenousType||'原住民身分條件')+'）':''} →</button>${r.scope.length>55?`<details class="district-scope-details"><summary>展開完整選區範圍</summary><span class="district-scope-label">${esc(r.scope)}</span></details>`:`<span class="district-scope-label">範圍：${esc(r.scope)}</span>`}</li>`).join('')}</ul><p>${choices.length?'原住民選區另有身分條件；以上條件選區不是每位居民都可投。':'目前無法精確比對，請直接選正式選舉區並核對公告。'} ${link(voterGuideData.sourceUrl,'正式選區公告')}</p>`;
}
const plainUpdateFilters=updateFilters;
updateFilters=function(){plainUpdateFilters();syncLocalFilters();renderConstituencyGuide();
 if(state.office==='council'&&state.scope==='county'&&voterGuideData){const select=$('#constituency');const options=[...new Set(baseRecords().filter(c=>c.officeKey==='council').map(c=>c.constituency))].map(value=>{const r=voterGuideData.council.find(r=>r.county===state.county&&r.constituency===value);return{value,label:value+(r?'｜'+(r.kind==='village'?(r.towns.join('、')+'・依村里劃分'):r.scope):'')};});optionList(select,options,state.constituency,'全部相關選區');}
};
const plainRenderDirectory=renderDirectory;
renderDirectory=function(){plainRenderDirectory();renderConstituencyGuide();};
function partyDetails(p){
 if(!p)return'<p>政黨介紹暫時無法讀取，請重新整理。</p>';
 const facts=[['成立日期',p.founded],['備案日期',p.registered],['內政部政黨編號',p.registryNumber],['備案狀態',p.status],['負責人（查核日資料）',p.leader],['本版名冊推薦登記',p.registrations.toLocaleString()+' 筆']].filter(([,v])=>v);
 const note=p.registryLabel&&p.registryLabel!==p.registryName?p.registryLabel:'';
 const sources=[{url:p.sourceUrl,title:'內政部備案資料／名冊依據'},{url:p.website,title:'政黨官方網站'},{url:p.charterUrl,title:'政黨章程'}].filter(s=>/^https?:\/\//.test(s.url||'')).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join('');
 return `<h3>${esc(p.name)}</h3><p>${esc(p.description)}</p>${note?`<p class="party-notice">官方備案附註：${esc(note)}</p>`:''}<dl class="party-facts">${facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p>推薦筆數包含本版的資格不符歷史登記，不是黨員數、席次或支持度。查核日期：${esc(partyGuideData.checkedAt)}。</p><div class="party-guide-actions"><div class="source-links">${sources}</div><button class="text-button" data-party-candidates="${esc(p.name)}">閱讀此推薦欄位的全台登記者 →</button></div>`;
}
function renderPartyIntro(name){const p=partyGuideData?.parties.find(p=>p.name===name);$('#party-intro-card').innerHTML=p?partyDetails(p):'<p>選擇名稱，查看有來源的政黨基本資料、官方網站與章程。</p>';}
async function showPartyInfo(name){await voterFeaturesReady;const p=partyGuideData.parties.find(p=>p.name===name);$('#party-dialog-content').innerHTML=`<div class="dialog-header"><h2>政黨介紹</h2><button class="close-dialog" data-close="party-dialog" aria-label="關閉政黨介紹">×</button></div><div class="party-intro-card">${partyDetails(p)}</div>`;$('#party-dialog').showModal();}
async function lookupHousehold(){
 const request=++addressRequest;await voterFeaturesReady;if(request!==addressRequest)return;
 if(!voterGuideData){$('#address-status').textContent='選區對照資料未能載入，請重新整理；也可用下方選單。';trackSiteEvent('household_lookup',{outcome:'unavailable'});return;}
 const found=parseHouseholdAddress($('#household-address').value,voterGuideData);
 if(found.error){$('#address-status').textContent=found.error;trackSiteEvent('household_lookup',{outcome:'invalid'});return;}
 await countyChangeBeforeGuide(found.county,found.town,found.village);if(request!==addressRequest||state.county!==found.county||state.town!==found.town||state.village!==found.village)return;
 addressChoice=found;$('#household-address').value=[found.county,found.town,found.village].filter(Boolean).join('');
 const county=voterGuideData.counties.find(c=>c.name===found.county);optionList($('#address-village'),county.villages[found.town]||[],found.village,'請確認戶籍村里');$('#address-village').disabled=false;
 $('#address-status').textContent='已找到 '+found.county+'・'+found.town+(found.village?'・'+found.village:'；尚未辨識村里，請補選，才能找里長及細分選區。');
 renderAddressResults();trackSiteEvent('household_lookup',{outcome:found.village?'matched':'needs_village',county:found.county});
}
function addressBallot(title,detail,buttonText,attrs='',source=null,fullScope=''){return `<article class="address-ballot"><h4>${esc(title)}</h4><p>${esc(detail)}</p>${buttonText?`<button class="text-button" ${attrs}>${esc(buttonText)} →</button>`:''}${fullScope?`<details class="district-scope-details"><summary>展開完整選區範圍</summary><p>${esc(fullScope)}</p></details>`:''}${source?links([{url:source,title:'正式選區公告'}]):''}</article>`;}
function renderAddressResults(){
 if(!addressChoice||!voterGuideData)return;
 const loc=addressChoice,identity=$('#voter-identity').value,rows=candidates.filter(c=>c.eligibleToRun!==false),parts=[];
 const mayors=rows.filter(c=>c.officeKey==='mayor');if(mayors.length)parts.push(addressBallot('縣市長｜'+loc.county,'全縣市為同一個首長選區。','查看 '+mayors.length+' 筆登記','data-address-office="mayor"'));
 const council=councilChoices(loc,identity);
 if(identity==='unsure')parts.push(addressBallot('議員選票｜先確認身分條件','下列分列一般與原住民條件選區；請在上方選擇適用身分，再縮小名單。',''));
 for(const r of council){const needsVillage=r.kind==='village'&&!loc.village;const count=rows.filter(c=>c.officeKey==='council'&&c.constituency===r.constituency).length;
  parts.push(addressBallot(r.constituency+(r.indigenous?'｜'+(r.indigenousType||'原住民條件'):'｜一般選區'),needsVillage?'請先確認戶籍村里，再縮小到適用選區。':r.kind==='village'?'已依確認的戶籍村里比對；完整範圍可展開查看。':'選區範圍：'+r.scope,needsVillage?'':'查看 '+count+' 筆登記',`data-address-office="council" data-address-constituency="${esc(r.constituency)}"`,r.sourceUrl,r.kind==='village'?r.scope:''));}
 if(!council.length)parts.push(addressBallot('議員選區｜需要進一步確認','目前條件未能精確對照；請核對身分、村里與官方選區公告，不以零筆結果判定沒有選票。','', '',voterGuideData.sourceUrl));
 for(const key of ['township_mayor','indigenous_district_head']){const list=rows.filter(c=>c.officeKey===key&&c.district===loc.town);if(list.length)parts.push(addressBallot(officeInfo[key].label+'｜'+loc.town,'依戶籍鄉鎮市／自治區比對。','查看 '+list.length+' 筆登記',`data-address-office="${key}"`));}
 if(loc.village){const list=rows.filter(c=>c.officeKey==='village'&&c.district===loc.town&&c.village===loc.village);parts.push(addressBallot('村里長｜'+loc.village,'只查看此村里的登記資料。',list.length?'查看 '+list.length+' 筆登記':'', 'data-address-office="village"'));}
 else parts.push(addressBallot('村里長｜還差一個村里','請在上方補選戶籍村里；完整路名門牌不會自動拿去外部服務查詢。',''));
 for(const key of ['township_rep','indigenous_district_rep'])if(rows.some(c=>c.officeKey===key&&c.district===loc.town))parts.push(addressBallot(officeInfo[key].label+'｜代表選區待確認','已找到同鄉鎮區的登記資料；代表選區與村里的細部對照仍待補，請再核對正式選區。','查看此鄉鎮區的代表名冊',`data-address-office="${key}"`));
 $('#address-results').innerHTML=parts.join('');
}
async function jumpAddressOffice(key,constituency=''){
 if(!addressChoice)return;
 state.scope='county';state.office=key;state.constituency=constituency;state.eligibility='not_ineligible';state.judicial='';state.party='';state.search='';state.page=1;$('#search').value='';updateFilters();renderDirectory();$('#directory').scrollIntoView({behavior:'smooth'});
}
$('#directory-town').addEventListener('change',e=>{state.town=e.target.value;state.village='';onCoordinateChange();});
$('#directory-village').addEventListener('change',e=>{state.village=e.target.value;onCoordinateChange();});
$('#address-form').addEventListener('submit',e=>{e.preventDefault();lookupHousehold().catch(()=>{$('#address-status').textContent='查詢未成功，請用下方選單或重新整理。';trackSiteEvent('household_lookup',{outcome:'error'});});});
$('#address-village').addEventListener('change',e=>{if(!addressChoice)return;state.village=e.target.value;addressChoice.village=e.target.value;onCoordinateChange();$('#household-address').value=[state.county,state.town,state.village].filter(Boolean).join('');$('#address-status').textContent=state.village?'已確認 '+[state.county,state.town,state.village].join('・'):'尚未確認村里，請補選後再看里長與細分選區。';});
$('#voter-identity').addEventListener('change',()=>{renderAddressResults();renderConstituencyGuide();});
$('#party-intro-select').addEventListener('change',e=>renderPartyIntro(e.target.value));
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
 try{if(b.dataset.partyInfo)await showPartyInfo(b.dataset.partyInfo);
  if(b.dataset.partyCandidates){if($('#party-dialog').open)$('#party-dialog').close();state.office='all';state.judicial='';state.eligibility='';state.search='';$('#search').value='';await setScope('national');state.party=b.dataset.partyCandidates;updateFilters();renderDirectory();$('#directory').scrollIntoView({behavior:'smooth'});}
  if(b.dataset.guideConstituency){state.constituency=b.dataset.guideConstituency;state.page=1;updateFilters();renderDirectory();}
  if(b.dataset.addressOffice)await jumpAddressOffice(b.dataset.addressOffice,b.dataset.addressConstituency||'');
 }catch{toast('這筆資料未能讀取，請重新整理後再試。');}
});
$('#party-dialog').addEventListener('click',e=>{if(e.target!==e.currentTarget)return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();});
const voterFeaturesReady=Promise.all([fetchJson('voter-guide.json'),fetchJson('parties.json')]).then(([guide,parties])=>{
 voterGuideData=guide;partyGuideData=parties;optionList($('#party-intro-select'),parties.parties.map(p=>({value:p.name,label:p.name+'（'+p.registrations.toLocaleString()+' 筆登記）'})),'','選擇要認識的政黨／推薦欄位');
 if(data&&candidates.length&&candidates[0].county===state.county){updateFilters();renderDirectory();}return true;
}).catch(()=>{$('#party-intro-card').innerHTML='<p>政黨資料未能讀取，請重新整理。</p>';$('#address-status').textContent='選區對照資料未能載入，請用原本選單或重新整理。';return false;});
