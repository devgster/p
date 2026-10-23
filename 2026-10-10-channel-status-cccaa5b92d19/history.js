'use strict';
const HistoryModel = (() => {
 const id = r => `${r.platform}:${r.account_id || r.username || r.key}`;
 const day = t => new Date(new Date(t).getTime()+9*3600000).toISOString().slice(0,10);
 const finite = v => typeof v==='number' && Number.isFinite(v) && v>=0;
 function daily(records, history){
  const current=new Map(records.map(r=>[id(r),r])), rows=new Map();
  for(const r of [...history,...records]){
   const c=current.get(id(r)), t=new Date(r.observed_at).getTime();
   if(!c || !Number.isFinite(t))continue;
   const d=day(t); if(!rows.has(d))rows.set(d,new Map());
   const row=rows.get(d), prev=row.get(id(r));
   if(prev && new Date(prev.observed_at).getTime()>t)continue;
   const p={...r};
   if(r.views_scope!==c.views_scope)p.total_views=null;
   if(r.participation_scope?.metric!==c.participation_scope?.metric || r.participation_scope?.filter!==c.participation_scope?.filter)p.shorts_engaged_views_90d=null;
   row.set(id(r),p);
  }
  return [...rows].sort((a,b)=>a[0].localeCompare(b[0]));
 }
 return {id,day,finite,daily};
})();
if(typeof module!=='undefined')module.exports=HistoryModel;
if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id), {id,day,finite,daily}=HistoryModel;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>finite(v)?v.toLocaleString('ko-KR'):'—';
 const time=t=>new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});
 const colors=['#df4545','#397ee6','#9a66e0','#cc761b','#cf51a1','#497e9c','#a18120','#7c73d4','#e76d54','#638ec7','#ad62b3','#888888'];
 let records=[],allDays=[],selected=new Set(),completed='';
 const name=r=>`${r.platform==='youtube'?'YT':'IG'} · ${r.label||r.title||r.username}`;
 const key=(r,metric)=>metric==='audience'?(r.platform==='youtube'?'subscribers':'followers'):metric==='views'?'total_views':'shorts_engaged_views_90d';
 function days(){const n=Number($('days').value);return n?allDays.filter(([d])=>d>=day(new Date(completed).getTime()-(n-1)*86400000)):allDays;}
 function chart(metric,target){
  const ds=days(), entries=records.map((r,i)=>({r,i})).filter(({r})=>selected.has(id(r))&&(metric!=='engaged'||r.platform==='youtube'));
  const vals=entries.flatMap(({r})=>ds.map(([,m])=>m.get(id(r))?.[key(r,metric)])).filter(finite);
  if(!vals.length){$(target).innerHTML='<p class="empty">선택한 범위에 확인된 기록이 없습니다.</p>';return;}
  const log=$('scale').value==='log', transform=v=>log?Math.log10(1+v):v;
  const max=Math.max(...vals,1)*1.08, height=290, width=Math.max(330,$(target).clientWidth), left=67,right=width-20,top=20,bottom=240;
  const x=i=>left+(ds.length===1?.5:i/(ds.length-1))*(right-left),y=v=>bottom-transform(v)/transform(max)*(bottom-top);
  let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metric==='audience'?'구독자 팔로워':metric==='views'?'조회수':'쇼츠 참여 조회수'} 계정별 비교"><title>날짜별 마지막 관측값 비교</title>`;
  for(let j=0;j<=4;j++){const f=j/4, v=log?Math.pow(10,transform(max)*f)-1:max*f, yy=bottom-f*(bottom-top);svg+=`<line x1="${left}" y1="${yy}" x2="${right}" y2="${yy}" stroke="var(--line)"/><text x="${left-8}" y="${yy+4}" text-anchor="end">${Math.round(v).toLocaleString('ko-KR',{notation:'compact'})}</text>`;}
  for(const {r,i} of entries){let segment=[];const segments=[], dots=[];ds.forEach(([d,m],j)=>{const p=m.get(id(r)),v=p?.[key(r,metric)];if(!finite(v)){if(segment.length)segments.push(segment);segment=[];return;}segment.push(`${x(j)},${y(v)}`);dots.push(`<circle cx="${x(j)}" cy="${y(v)}" r="3" fill="${colors[i%colors.length]}"><title>${esc(name(r))} · ${esc(time(p.observed_at))} · ${fmt(v)}</title></circle>`);});if(segment.length)segments.push(segment);svg+=`<g data-series="${esc(id(r))}">${segments.map(s=>`<polyline points="${s.join(' ')}" fill="none" stroke="${colors[i%colors.length]}" stroke-width="2.5"${r.platform==='instagram'?' stroke-dasharray="6 3"':''}/>`).join('')}${dots.join('')}</g>`;}
  const ticks=[...new Set([0,Math.floor((ds.length-1)/2),ds.length-1])];for(const j of ticks)svg+=`<text x="${x(j)}" y="268" text-anchor="${j===0?'start':j===ds.length-1?'end':'middle'}">${ds[j][0]}</text>`;
  $(target).innerHTML=svg+'</svg>';
 }
 function table(){
  const ds=days();$('table-note').textContent=`${ds.length}일 · 전체 ${records.length}개 계정 · 각 셀의 시각은 해당 날짜 실제 수집 시각(KST) · 좌우로 스크롤하세요.`;
  $('history-table').innerHTML=`<caption>날짜별 구독자·팔로워 / 조회수 / 쇼츠 참여 조회수</caption><thead><tr><th rowspan="2" scope="col">날짜 (KST)</th>${records.map((r,i)=>`<th colspan="3" scope="colgroup"><span class="swatch" style="background:${colors[i%colors.length]}"></span> ${esc(name(r))}</th>`).join('')}</tr><tr>${records.map(r=>`<th scope="col">${r.platform==='youtube'?'구독자':'팔로워'}</th><th scope="col">조회수</th><th scope="col">${r.platform==='youtube'?'쇼츠 참여 · 90일':'쇼츠 참여 · 해당 없음'}</th>`).join('')}</tr></thead><tbody>${[...ds].reverse().map(([d,m])=>`<tr><th scope="row">${d}</th>${records.map(r=>{const p=m.get(id(r));return ['audience','views','engaged'].map(k=>`<td>${fmt(p?.[key(r,k)])}${p&&k==='audience'?`<small>${new Date(p.observed_at).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})}</small>`:''}</td>`).join('');}).join('')}</tr>`).join('')}</tbody>`;
 }
 function render(){chart('audience','audience-chart');chart('views','views-chart');chart('engaged','engaged-chart');table();}
 function legend(){ $('legend').innerHTML=records.map((r,i)=>`<button data-id="${esc(id(r))}" aria-pressed="${selected.has(id(r))}"><span class="swatch" style="background:${colors[i%colors.length]}"></span>${esc(name(r))}</button>`).join('');}
 async function load(){
  $('refresh').disabled=true;
  try{const [a,b]=await Promise.all(['metrics.json','history.json'].map(async file=>{const res=await fetch(file+'?t='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('fetch');return res.json();}));if(!Array.isArray(a.records)||!Array.isArray(b.records))throw Error('shape');records=a.records;completed=a.completed_at;allDays=daily(records,b.records);selected=new Set(records.map(id));legend();render();$('status').textContent=`마지막 수집 ${time(completed)} KST · ${records.length}개 계정 · ${allDays.length}일 기록${b.unreadable_files?' · 일부 원장 읽기 실패':''}${Date.now()-new Date(completed).getTime()>14*3600000?' · 최신 갱신 지연':''}`;
  }catch{$('status').textContent='수집 이력을 불러오지 못했습니다. 다시 시도해 주세요. 남아 있는 표시는 이전 조회값입니다.';}finally{$('refresh').disabled=false;}
 }
 $('legend').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(!b)return;const v=b.dataset.id;selected.has(v)?selected.delete(v):selected.add(v);legend();render();});
 $('select-all').onclick=()=>{selected=new Set(records.map(id));legend();render();};
 $('refresh').onclick=load;$('days').onchange=render;$('scale').onchange=render;
 $('csv').onclick=()=>{const rows=[['날짜(KST)',...records.flatMap(r=>['구독자/팔로워','조회수','쇼츠 참여(90일)','수집시각(KST)'].map(k=>name(r)+' '+k))],...days().map(([d,m])=>[d,...records.flatMap(r=>{const p=m.get(id(r));return [...['audience','views','engaged'].map(k=>finite(p?.[key(r,k)])?p[key(r,k)]:'미확인'),p?time(p.observed_at):'미확인'];})])];const safe=v=>{const s=String(v);return '"'+(/^[=+@-]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"';};const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='channel-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 window.addEventListener('resize',()=>{if(records.length)render();});load();
}
