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
 function rowTime(row){
  const stamps=[...row.values()].map(r=>new Date(r.observed_at).getTime()).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!stamps.length)return '미확인';
  const clock=t=>new Date(t+9*3600000).toISOString().slice(11,19);
  const first=clock(stamps[0]),last=clock(stamps[stamps.length-1]);
  return first===last?first:`${first}–${last}`;
 }
 function collectionDelta(point,field,history){
  if(!point||!finite(point[field]))return null;
  const at=new Date(point.observed_at).getTime();
  const prev=history.filter(r=>id(r)===id(point)&&new Date(r.observed_at).getTime()<at)
   .sort((a,b)=>new Date(b.observed_at)-new Date(a.observed_at))[0];
  if(!prev||!finite(prev[field]))return null;
  if(field==='total_views'&&prev.views_scope!==point.views_scope)return null;
  if(field==='shorts_engaged_views_90d'&&(prev.participation_scope?.metric!==point.participation_scope?.metric||prev.participation_scope?.filter!==point.participation_scope?.filter))return null;
  return point[field]-prev[field];
 }
 const activeRecords=records=>records.filter(r=>r.production_status!=='paused');
 return {id,day,finite,daily,rowTime,collectionDelta,activeRecords};
})();
if(typeof module!=='undefined')module.exports=HistoryModel;
if(typeof document!=='undefined'){
 const $=id=>document.getElementById(id), {id,day,finite,daily,rowTime,collectionDelta,activeRecords}=HistoryModel;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=v=>finite(v)?v.toLocaleString('ko-KR'):'—';
 const short=v=>finite(v)?v.toLocaleString('ko-KR',{notation:'compact',maximumFractionDigits:1}):'—';
 const time=t=>new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false,month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
 const colors=['#df4545','#397ee6','#9a66e0','#cc761b','#cf51a1','#497e9c','#a18120','#7c73d4','#e76d54','#638ec7','#ad62b3','#888888','#2f9e77','#c0392b'];
 const METRICS={audience:'구독자·팔로워',views:'조회수',engaged:'쇼츠 참여 조회수 · 90일'};
 let records=[],observations=[],allDays=[],selected=new Set(),completed='',metric='audience';
 const mobile=()=>window.matchMedia('(max-width:700px)').matches;
 const plat=r=>r.platform==='youtube'?'YouTube':'Instagram';
 const label=r=>r.label||r.title||r.username;
 const name=r=>`${r.platform==='youtube'?'YT':'IG'} · ${label(r)}${r.production_status==='paused'?' (제작 중단)':''}`;
 const key=(r,m)=>m==='audience'?(r.platform==='youtube'?'subscribers':'followers'):m==='views'?'total_views':'shorts_engaged_views_90d';
 const color=r=>colors[records.indexOf(r)%colors.length];
 const paused=r=>r.production_status==='paused';
 const series=(r,m)=>allDays.map(([d,row])=>[d,row.get(id(r))?.[key(r,m)]]).filter(([,v])=>finite(v));
 function change(r,m,span){
  const s=series(r,m); if(!s.length)return null;
  const [lastDay,last]=s[s.length-1], cut=day(new Date(lastDay+'T12:00:00+09:00').getTime()-span*86400000);
  const base=[...s].reverse().find(([d])=>d<=cut);
  return base?{value:last,delta:last-base[1],since:base[0]}:{value:last,delta:null,since:null};
 }
 function delta(c){
  if(!c||c.delta===null)return '<span class="change unknown">비교 기록 없음</span>';
  if(c.delta===0)return '<span class="change flat">변동 없음</span>';
  const pct=c.value-c.delta>0?` · ${(c.delta/(c.value-c.delta)*100).toFixed(c.delta/(c.value-c.delta)>=0.1?0:1)}%`:'';
  return `<span class="change ${c.delta>0?'up':'down'}">${c.delta>0?'▲':'▼'} ${Math.abs(c.delta).toLocaleString('ko-KR')}${pct}</span>`;
 }
 function spark(r,m){
  const s=series(r,m).slice(-30); if(s.length<2)return '';
  const vs=s.map(([,v])=>v), lo=Math.min(...vs), hi=Math.max(...vs), w=88, h=26;
  const pts=vs.map((v,i)=>`${(i/(vs.length-1)*w).toFixed(1)},${(hi===lo?h/2:h-2-(v-lo)/(hi-lo)*(h-4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color(r)}" stroke-width="2"/></svg>`;
 }
 function metricRow(r,m,span){
  const c=change(r,m,span), v=c?c.value:null;
  return `<div class="mrow"><div class="mname">${m==='audience'?(r.platform==='youtube'?'구독자':'팔로워'):m==='views'?'조회수':'참여 90일'}</div><div class="mval">${fmt(v)}</div><div class="mdelta">${delta(c)}</div>${m==='audience'?spark(r,m):'<span></span>'}</div>`;
 }
 function cards(){
  const span=Number($('span').value), groups=new Map();
  for(const r of records){const k=r.key||id(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  const card=rs=>{const yt=rs.find(r=>r.platform==='youtube'), title=label(yt||rs[0]);
   return `<article class="ccard"><h3>${esc(title)}</h3>${rs.map(r=>`<div class="plat"><div class="plat-head"><span class="pill ${r.platform}">${plat(r)}</span>${r.username?`<span class="handle">@${esc(r.username)}</span>`:''}</div>${['audience','views',...(r.platform==='youtube'?['engaged']:[])].filter(m=>m==='audience'||series(r,m).length).map(m=>metricRow(r,m,span)).join('')}${r.error||r.engaged_error?'<p class="warn">일부 지표 미확인</p>':''}</div>`).join('')}</article>`;};
  const all=[...groups.values()], live=all.filter(rs=>!rs.some(paused)), held=all.filter(rs=>rs.some(paused));
  $('channel-cards').innerHTML=live.map(card).join('')||'<p class="empty">표시할 채널이 없습니다.</p>';
  $('paused-box').hidden=!held.length; $('paused-count').textContent=`${held.length}개`; $('paused-cards').innerHTML=held.map(card).join('');
 }
 function days(){const n=Number($('days').value);return n?allDays.filter(([d])=>d>=day(new Date(completed).getTime()-(n-1)*86400000)):allDays;}
 function chart(){
  const target='trend-chart', ds=days(), entries=records.filter(r=>selected.has(id(r))&&(metric!=='engaged'||r.platform==='youtube'));
  const vals=entries.flatMap(r=>ds.map(([,m])=>m.get(id(r))?.[key(r,metric)])).filter(finite);
  $('trend-note').textContent=metric==='views'?'YouTube는 Analytics 전체 기간, Instagram은 게시물 누적 합 · 플랫폼별 집계 범위가 다릅니다. 점선 = Instagram':metric==='engaged'?'YouTube 쇼츠 전용 · 수익 창출 심사용 유효 조회수가 아닙니다.':'점선 = Instagram · 점을 누르면 수집 시각과 값이 보입니다.';
  if(!vals.length){$(target).innerHTML='<p class="empty">선택한 범위에 확인된 기록이 없습니다.</p>';return;}
  const log=$('scale').value==='log', tf=v=>log?Math.log10(1+v):v, small=mobile();
  const max=Math.max(...vals,1)*1.08, height=small?240:300, width=Math.max(300,$(target).clientWidth), left=small?44:62,right=width-(small?10:20),top=14,bottom=height-36;
  const x=i=>left+(ds.length===1?.5:i/(ds.length-1))*(right-left),y=v=>bottom-tf(v)/tf(max)*(bottom-top);
  let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${METRICS[metric]} 계정별 비교"><title>날짜별 마지막 관측값 비교</title>`;
  for(let j=0;j<=4;j++){const f=j/4, v=log?Math.pow(10,tf(max)*f)-1:max*f, yy=bottom-f*(bottom-top);svg+=`<line x1="${left}" y1="${yy}" x2="${right}" y2="${yy}" stroke="var(--line)"/><text x="${left-6}" y="${yy+4}" text-anchor="end">${short(Math.round(v))}</text>`;}
  for(const r of entries){let seg=[];const segs=[],dots=[];ds.forEach(([d,m],j)=>{const p=m.get(id(r)),v=p?.[key(r,metric)];if(!finite(v)){if(seg.length)segs.push(seg);seg=[];return;}seg.push(`${x(j)},${y(v)}`);dots.push(`<circle cx="${x(j)}" cy="${y(v)}" r="${small?2.5:3}" fill="${color(r)}"><title>${esc(name(r))} · ${esc(time(p.observed_at))} · ${fmt(v)}</title></circle>`);});if(seg.length)segs.push(seg);svg+=`<g>${segs.map(s=>`<polyline points="${s.join(' ')}" fill="none" stroke="${color(r)}" stroke-width="2.5"${r.platform==='instagram'?' stroke-dasharray="6 3"':''}/>`).join('')}${dots.join('')}</g>`;}
  const ticks=[...new Set([0,Math.floor((ds.length-1)/2),ds.length-1])];for(const j of ticks)svg+=`<text x="${x(j)}" y="${height-12}" text-anchor="${j===0?'start':j===ds.length-1?'end':'middle'}">${ds[j][0].slice(5).replace('-','.')}</text>`;
  $(target).innerHTML=svg+'</svg>';
 }
 function legend(){$('legend').innerHTML=records.filter(r=>metric!=='engaged'||r.platform==='youtube').map(r=>`<button data-id="${esc(id(r))}" aria-pressed="${selected.has(id(r))}"><span class="swatch${r.platform==='instagram'?' ig':''}" style="--c:${color(r)}"></span>${esc(name(r))}</button>`).join('');}
 function accountOptions(){
  const sel=$('table-account'), prev=sel.value, live=activeRecords(records);
  sel.innerHTML=`<option value="*">전체 계정 (넓은 표)</option>`+live.map(r=>`<option value="${esc(id(r))}">${esc(name(r))}</option>`).join('');
  sel.value=prev&&[...sel.options].some(o=>o.value===prev)?prev:(mobile()?(live.length?id(live[0]):'*'):'*');
 }
 function table(){
  const ds=[...days()].reverse(), pick=$('table-account').value, live=activeRecords(records);
  const cell=(p,r,k)=>{const v=p?.[key(r,k)], dlt=collectionDelta(p,key(r,k),observations);return `<td>${fmt(v)}<small class="${dlt>0?'up':dlt<0?'down':'flat'}">${dlt===null?'비교 기록 없음':dlt>0?'+'+fmt(dlt):dlt<0?'−'+fmt(-dlt):'±0'}</small></td>`;};
  if(pick==='*'){
   $('table-note').textContent=`${ds.length}일 · ${live.length}개 운영 계정 · 각 값 아래 직전 수집 대비 증감 · 날짜 아래 수집 시각(KST) · 좌우로 넘겨 보세요.`;
   $('history-table').className='wide';
   $('history-table').innerHTML=`<thead><tr><th rowspan="2" scope="col">날짜</th>${live.map(r=>`<th colspan="3" scope="colgroup"><span class="swatch" style="--c:${color(r)}"></span> ${esc(name(r))}</th>`).join('')}</tr><tr>${live.map(r=>`<th scope="col">${r.platform==='youtube'?'구독자':'팔로워'}</th><th scope="col">조회수</th><th scope="col">${r.platform==='youtube'?'참여 90일':'—'}</th>`).join('')}</tr></thead><tbody>${ds.map(([d,m])=>`<tr><th scope="row">${d}<small>${esc(rowTime(m))}</small></th>${live.map(r=>{const p=m.get(id(r));return ['audience','views','engaged'].map(k=>cell(p,r,k)).join('');}).join('')}</tr>`).join('')}</tbody>`;
   return;
  }
  const r=live.find(x=>id(x)===pick);
  if(!r){$('history-table').innerHTML='';$('table-note').textContent='운영 중인 계정이 없습니다.';return;}
  const ms=['audience','views',...(r.platform==='youtube'?['engaged']:[])].filter(m=>m==='audience'||series(r,m).length);
  $('table-note').textContent=`${name(r)} · ${ds.length}일 · 각 값 아래는 직전 수집 대비 증감입니다. 비교 기록이 없거나 집계 범위가 다르면 표시하지 않습니다.`;
  $('history-table').className='single';
  $('history-table').innerHTML=`<thead><tr><th scope="col">날짜</th>${ms.map(k=>`<th scope="col">${k==='audience'?(r.platform==='youtube'?'구독자':'팔로워'):k==='views'?'조회수':'참여 90일'}</th>`).join('')}</tr></thead><tbody>${ds.map(([d,m],i)=>`<tr><th scope="row">${d.slice(5).replace('-','.')}<small>${m.get(pick)?esc(time(m.get(pick).observed_at).split(' ').slice(-1)[0]):''}</small></th>${ms.map(k=>cell(m.get(pick),r,k)).join('')}</tr>`).join('')}</tbody>`;
 }
 function render(){cards();legend();chart();table();}
 async function load(){
  $('refresh').disabled=true;
  try{const [a,b]=await Promise.all(['metrics.json','history.json'].map(async file=>{const res=await fetch(file+'?t='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('fetch');return res.json();}));if(!Array.isArray(a.records)||!Array.isArray(b.records))throw Error('shape');records=a.records;observations=[...b.records,...records];completed=a.completed_at;allDays=daily(records,b.records);selected=new Set(records.filter(r=>!paused(r)).map(id));accountOptions();render();
   const late=Date.now()-new Date(completed).getTime()>14*3600000;
   $('status').innerHTML=`기준 <b>${esc(new Date(completed).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false,year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}))}</b> KST · ${records.length}개 계정 · ${allDays.length}일 기록${b.unreadable_files?' · 일부 원장 읽기 실패':''}${late?' · <span class="warn">최신 갱신 지연</span>':''}`;
  }catch{$('status').textContent='수집 이력을 불러오지 못했습니다. 다시 시도해 주세요.';}finally{$('refresh').disabled=false;}
 }
 document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-metric]');if(!b)return;metric=b.dataset.metric;document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-selected',String(x===b)));legend();chart();});
 $('legend').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(!b)return;const v=b.dataset.id;selected.has(v)?selected.delete(v):selected.add(v);legend();chart();});
 $('select-all').onclick=()=>{selected=new Set(records.map(id));legend();chart();};
 $('select-active').onclick=()=>{selected=new Set(records.filter(r=>!paused(r)).map(id));legend();chart();};
 $('refresh').onclick=load;$('days').onchange=()=>{chart();table();};$('scale').onchange=chart;$('span').onchange=cards;$('table-account').onchange=table;
 $('csv').onclick=()=>{const rows=[['날짜(KST)',...activeRecords(records).flatMap(r=>['구독자/팔로워','조회수','쇼츠 참여(90일)','수집시각(KST)'].map(k=>name(r)+' '+k))],...days().map(([d,m])=>[d,...activeRecords(records).flatMap(r=>{const p=m.get(id(r));return [...['audience','views','engaged'].map(k=>finite(p?.[key(r,k)])?p[key(r,k)]:'미확인'),p?new Date(p.observed_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'미확인'];})])];const safe=v=>{const s=String(v);return '"'+(/^[=+@-]/.test(s)?"'":'')+s.replace(/"/g,'""')+'"';};const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='channel-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(records.length)chart();},150);});load();
}
