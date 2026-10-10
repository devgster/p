'use strict';
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = v => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('ko-KR') : '미확인';
const date = v => v != null && Number.isFinite(new Date(v).getTime()) ? new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '미확인';
const identity = r => `${r.platform}:${r.account_id || r.username || r.key}`;
const labels = {subscribers:'구독자',followers:'팔로워',total_views:'누적 조회수',engaged_views_90d:'유효 조회수 · 90일 쇼츠',watch_hours_365d:'시청 시간 · 365일 VOD'};
let records = [], history = [], platform = 'all', historyError = '';
const visible = () => records.filter(r => platform === 'all' || r.platform === platform);
const fields = r => [r.platform === 'youtube' ? 'subscribers' : 'followers','total_views',...(r.platform === 'youtube' ? [r.analytics_scope?.filter === 'creatorContentType==videoOnDemand' ? 'watch_hours_365d' : 'engaged_views_90d'] : [])];
function stat(r,k){
 const c = r.comparison?.[k], d = c?.delta;
 const change = r[k] == null ? '미확인' : c ? `${d > 0 ? '+' : ''}${number(d)} · ${c.percent == null ? '증감률 산출 불가' : (c.percent > 0 ? '+' : '') + c.percent.toFixed(2) + '%'}` : '첫 기록 · 비교 기준 없음';
 return `<div class="stat"><small>${labels[k]}</small><b>${number(r[k])}${k === 'watch_hours_365d' && r[k] != null ? ' h' : ''}</b><small class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${change}</small>${c ? `<small>${date(c.previous_at)} 대비</small>` : ''}</div>`;
}
function render(){
 $('summary').innerHTML = [['youtube','subscribers','YouTube 구독자'],['youtube','total_views','YouTube 누적 조회수'],['instagram','followers','Instagram 팔로워'],['instagram','total_views','Instagram 게시물 조회수']].map(([p,k,title])=>{
  const rows = records.filter(r=>r.platform===p), known = rows.filter(r=>typeof r[k]==='number');
  return `<article><small>${title}</small><strong>${known.length ? number(known.reduce((a,r)=>a+r[k],0)) : '미확인'}</strong><small>${known.length}/${rows.length}개 계정 확인${known.length < rows.length ? ' · 확인된 값만 합산' : ''}</small></article>`;
 }).join('');
 const cardMarkup = r => `<article class="card"><span class="badge">${r.platform === 'youtube' ? '▶ YOUTUBE · 유튜브' : '◎ INSTAGRAM · 인스타그램'}</span><h3>${esc(r.label || r.title || r.username)}</h3><div class="stats">${fields(r).map(k=>stat(r,k)).join('')}</div>${r.error || r.engaged_error || r.watch_error ? '<p class="warn">일부 지표 미확인 · 계정 연결 또는 원본 응답 확인 필요</p>' : ''}</article>`;
 $('cards').innerHTML = ['youtube','instagram'].map(p=>{
  const rows=visible().filter(r=>r.platform===p);if(!rows.length)return '';
  const youtube=p==='youtube';
  return `<section class="platform-group ${p}" aria-label="${youtube?'유튜브':'인스타그램'} 채널 목록"><div class="platform-heading"><span class="platform-icon" aria-hidden="true">${youtube?'▶':'◎'}</span><div><h3>${youtube?'유튜브':'인스타그램'} <span>${youtube?'YouTube':'Instagram'}</span></h3><p>${youtube?'구독자 · 채널 누적 조회수 · 시청 성과':'팔로워 · 게시물 누적 조회수'}</p></div><b class="platform-count">${rows.length}개 계정</b></div><div class="cards">${rows.map(cardMarkup).join('')}</div></section>`;
 }).join('');
 const old = $('channel').value;
 $('channel').innerHTML = visible().map(r=>`<option value="${esc(identity(r))}">${esc(r.label || r.title || r.username)} · ${r.platform === 'youtube' ? 'YT' : 'IG'}</option>`).join('');
 if(visible().some(r=>identity(r)===old)) $('channel').value=old;
 metrics();
}
function metrics(){
 const r = records.find(r=>identity(r)===$('channel').value), old=$('metric').value;
 $('metric').innerHTML = r ? fields(r).map(k=>`<option value="${k}">${labels[k]}</option>`).join('') : '';
 if(r && fields(r).includes(old)) $('metric').value=old;
 chart();
}
function chart(){
 const r=records.find(r=>identity(r)===$('channel').value), key=$('metric').value;
 if(!r) {$('chart').innerHTML='<p class="empty">표시할 계정이 없습니다.</p>';return;}
 const cutoff=Date.now()-Number($('days').value)*86400000;
 const compatible=p=>key==='total_views' ? p.views_scope===r.views_scope : ['engaged_views_90d','watch_hours_365d'].includes(key) ? p.analytics_scope?.metric===r.analytics_scope?.metric && p.analytics_scope?.filter===r.analytics_scope?.filter : true;
 const points=new Map();
 [...history,r].filter(p=>identity(p)===identity(r) && Date.parse(p.observed_at)>=cutoff && compatible(p)).forEach(p=>points.set(Date.parse(p.observed_at),p[key]));
 const all=[...points].sort((a,b)=>a[0]-b[0]), valid=all.filter(p=>typeof p[1]==='number'&&Number.isFinite(p[1]));
 $('chart-table').innerHTML=`<table><thead><tr><th>수집 시각 (KST)</th><th>${labels[key]}</th></tr></thead><tbody>${all.map(([t,v])=>`<tr><td>${date(t)}</td><td>${number(v)}</td></tr>`).join('')}</tbody></table>`;
 if(!valid.length){$('chart').innerHTML='<p class="empty">이 지표의 수집 기록이 아직 없습니다.</p>';return;}
 const values=valid.map(p=>p[1]), min=Math.min(...values),max=Math.max(...values), pad=Math.max((max-min)*.15,max*.01,1),low=Math.max(0,min-pad),high=max+pad;
 const width=Math.max(320,$('chart').clientWidth),right=width-18;
 const start=all[0][0],end=all[all.length-1][0], x=t=>65+(end===start ? .5 :(t-start)/(end-start))*(right-65), y=v=>210-(v-low)/(high-low)*180;
 let segments=[],current=[];
 for(const [t,v] of all){if(typeof v==='number'&&Number.isFinite(v))current.push(`${x(t)},${y(v)}`);else if(current.length){segments.push(current);current=[];}}
 if(current.length)segments.push(current);
 $('chart').innerHTML=`<svg viewBox="0 0 ${width} 260" role="img" aria-label="${esc(r.label)} ${labels[key]} 추이"><title>${esc(r.label)} ${labels[key]} · ${valid.length}개 수집 기록</title>${[0,.5,1].map(f=>{const yy=30+180*f;return `<line x1="65" y1="${yy}" x2="${right}" y2="${yy}" stroke="var(--line)"/><text x="57" y="${yy+4}" text-anchor="end">${number(Math.round(high-(high-low)*f))}</text>`;}).join('')}${segments.map(s=>`<polyline points="${s.join(' ')}" fill="none" stroke="var(--ink)" stroke-width="3"/>`).join('')}${valid.map(([t,v])=>`<circle cx="${x(t)}" cy="${y(v)}" r="4" fill="var(--ink)"><title>${date(t)} · ${number(v)}</title></circle>`).join('')}<text x="65" y="245">${date(start)}</text><text x="${right}" y="245" text-anchor="end">${date(end)}</text></svg><p class="muted">${valid.length}개 실제 수집 기록${valid.length===1 ? ' · 기록이 쌓이면 추이가 표시됩니다.' : ' · 세로축은 변화가 보이도록 자동 조정됩니다.'}${historyError ? ' · 과거 기록 조회 실패, 현재 값만 표시' : ''}</p>`;
}
async function load(fresh=false){
 $('refresh').disabled=true;$('status').textContent='발행된 리포트를 불러오고 있습니다…';
 try{
  const response=await fetch('metrics.json?t='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('metrics');
  const data=await response.json();if(!Array.isArray(data.records))throw Error('records');
  records=data.records;
  try{const h=await fetch('history.json?t='+Date.now(),{cache:'no-store'});if(!h.ok)throw Error('history');const body=await h.json();if(!Array.isArray(body.records))throw Error('history');history=body.records;historyError=body.unreadable_files ? '일부 기록 읽기 실패' : '';}catch{history=[];historyError='과거 기록 조회 실패';}
  render();$('status').textContent=`마지막 수집 ${date(data.completed_at)} KST · ${records.length}개 계정 · 공통 대시보드 원장${historyError ? ' · '+historyError : ''}`;
 }catch{$('status').textContent='지표를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 눌러 주세요. 기존 표시가 있다면 이전 조회값입니다.';}
 finally{$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',()=>load(true));
$('channel').addEventListener('change',metrics);$('metric').addEventListener('change',chart);$('days').addEventListener('change',chart);
$('filters').addEventListener('click',e=>{if(!e.target.dataset.platform)return;platform=e.target.dataset.platform;document.querySelectorAll('[data-platform]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.platform===platform)));render();});
load();

window.addEventListener('resize',()=>{if(records.length)chart();});
