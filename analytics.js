'use strict';
// Only allow listed aggregate parameters; never forward form values or candidate identities.
(() => {
 const id='G-D56CPFN528';
 const counties=new Set(['臺北市','新北市','桃園市','臺中市','臺南市','高雄市','基隆市','新竹市','嘉義市','新竹縣','苗栗縣','彰化縣','南投縣','雲林縣','嘉義縣','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣']);
 const offices=new Set(['all','mayor','council','village','township_mayor','township_rep','indigenous_district_head','indigenous_district_rep']);
 const chapterIds={'coordinates':'01','ballot':'02','directory':'03','perspectives':'04','judicial-records':'05','method':'06','hot-topics':'07'};
 const enums={county:counties,office:offices,chapter:new Set(Object.values(chapterIds)),tab:new Set(['bio','policy','judicial','controversy']),outcome:new Set(['matched','needs_village','invalid','unavailable','error']),action:new Set(['add','remove']),theme:new Set(['journal','pixel','fantasy']),filter_type:new Set(['scope','constituency','party','judicial','eligibility','town','village','crime_type','crime_eligibility','reset']),control:new Set(['skip','replay','play_pause','sound_toggle']),entry_point:new Set(['chapter_dock','hero','navigation','map','preset','selector','address_results']),topic:new Set(['transport','care','city','jobs','finance']),widget_action:new Set(['open','close'])};
 const schema={chapter_view:['chapter'],chapter_navigate:['chapter','entry_point'],county_select:['county','entry_point'],office_select:['office','entry_point'],filter_change:['filter_type'],directory_search:['has_query','result_count'],candidate_open:['county','office','tab'],candidate_tab_view:['county','office','tab'],compare_selection:['action','item_count','office'],compare_open:['item_count','office'],household_lookup:['outcome','county'],household_candidates_open:['office'],party_info_open:[],topic_open:[],policy_topic_select:['topic'],hot_widget_toggle:['widget_action'],intro_control:['control'],theme_select:['theme'],data_download:[],source_click:['source_domain']};
 const seenChapters=new Set();let searchTimer;
 const baseUrl=()=>location.origin+location.pathname;
 const safeReferrer=()=>{try{const u=new URL(document.referrer);return u.origin+u.pathname;}catch{return '';}};
 function sanitize(name,input={}){
  if(!Object.hasOwn(schema,name))return null;
  const result={};
  for(const key of schema[name]){
   const value=input[key];
   if(enums[key]?.has(value))result[key]=value;
   else if(key==='has_query'&&typeof value==='boolean')result[key]=value;
   else if(key==='result_count'&&Number.isInteger(value)&&value>=0&&value<=20000)result[key]=value;
   else if(key==='item_count'&&Number.isInteger(value)&&value>=0&&value<=3)result[key]=value;
   else if(key==='source_domain'&&typeof value==='string'&&/^[a-z0-9.-]{1,100}$/i.test(value))result[key]=value.toLowerCase();
  }
  return result;
 }
 function emit(name,params){
  if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)||typeof window.gtag!=='function')return;
  window.gtag('event',name,{...params,send_to:id,page_location:baseUrl(),page_referrer:safeReferrer()});
 }
 function track(name,input){
  try{
   const params=sanitize(name,input);if(!params)return;
   if(name==='chapter_view'){
    if(!params.chapter||document.querySelector('#opening-intro')?.open||seenChapters.has(params.chapter))return;
    seenChapters.add(params.chapter);
   }
   if(name==='directory_search'){clearTimeout(searchTimer);searchTimer=setTimeout(()=>emit(name,params),600);return;}
   emit(name,params);
  }catch{/* Analytics must never interrupt election lookup. */}
 }
 window.electionAnalytics=Object.freeze({track,eventNames:Object.freeze(Object.keys(schema))});
 function chapterFor(hash){return chapterIds[String(hash||'').replace(/^#/,'')];}
 document.addEventListener('click',e=>{
  const target=e.target;if(!target?.closest)return;
  const a=target.closest('a[href]');
  if(a){
   const chapter=chapterFor(a.getAttribute('href'));
   if(chapter)track('chapter_navigate',{chapter,entry_point:a.closest('.chapter-dock')?'chapter_dock':a.closest('.chapter-shortcuts')?'hero':'navigation'});
   else if(a.closest('.profile-body,.source-entry,.source-box,.policy-list')){
    try{const u=new URL(a.href,location.href);if(u.protocol==='https:'&&u.origin!==location.origin)track('source_click',{source_domain:u.hostname});}catch{}
   }
  }
  const county=target.closest('[data-county]');if(county)track('county_select',{county:county.dataset.county,entry_point:'map'});
  const b=target.closest('button');if(!b)return;
  if(b.dataset.preset)track('county_select',{county:b.dataset.preset.split('|')[0],entry_point:'preset'});
  if(b.dataset.officeJump||b.dataset.directoryOffice)track('office_select',{office:b.dataset.officeJump||b.dataset.directoryOffice,entry_point:'navigation'});
  if(b.dataset.addressOffice)track('household_candidates_open',{office:b.dataset.addressOffice});
  if(b.dataset.themeChoice)track('theme_select',{theme:b.dataset.themeChoice});
  if(b.dataset.partyInfo)track('party_info_open');
  if(b.dataset.topic)track('topic_open');
  if(b.dataset.issue)track('policy_topic_select',{topic:b.dataset.issue});
  if(b.dataset.crimeCategory)track('filter_change',{filter_type:'crime_type'});
  if(b.dataset.crimeEligibility)track('filter_change',{filter_type:'crime_eligibility'});
  if(b.id==='reset-filters'||b.hasAttribute('data-crime-reset'))track('filter_change',{filter_type:'reset'});
  if(b.id==='hot-widget-toggle')track('hot_widget_toggle',{widget_action:document.querySelector('#hot-widget-panel').hidden?'open':'close'});
  if(b.id==='hot-widget-close')track('hot_widget_toggle',{widget_action:'close'});
  if(b.id==='download-data')track('data_download');
  const intro={'skip-intro':'skip','replay-intro':'replay','pause-intro':'play_pause','sound-intro':'sound_toggle'};
  if(intro[b.id])track('intro_control',{control:intro[b.id]});
 },true);
 document.addEventListener('change',e=>{
  const el=e.target;if(!el)return;
  if(['county','directory-county','crime-county'].includes(el.id))track('county_select',{county:el.value,entry_point:'selector'});
  if(el.id==='office')track('office_select',{office:el.value,entry_point:'selector'});
  const filters={'scope':'scope','constituency':'constituency','party':'party','judicial-filter':'judicial','eligibility-filter':'eligibility','town':'town','directory-town':'town','village':'village','directory-village':'village'};
  if(filters[el.id])track('filter_change',{filter_type:filters[el.id]});
  if(el.id==='party-intro-select'&&el.value)track('party_info_open');
 },true);
 document.addEventListener('DOMContentLoaded',()=>{
  document.querySelector('#opening-intro')?.addEventListener('close',()=>{
   const a=document.querySelector('.chapter-dock a[aria-current="location"]');
   const chapter=chapterFor(a?.getAttribute('href'));if(chapter)track('chapter_view',{chapter});
  });
 });
})();
