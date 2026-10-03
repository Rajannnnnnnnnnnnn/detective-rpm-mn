(() => {
  const scene=document.getElementById('scene'), board=document.getElementById('board'), wrap=document.getElementById('boardWrap');
  const items=[...document.querySelectorAll('.item')], threads=document.getElementById('threads');
  const clueMap=Object.fromEntries(items.map(el=>[el.dataset.id,el]));
  const localLayoutKey='mystery-board-layout-github-state-v1';
  const defaultLayout={}; let layout={}; let selected=null, zCounter=200;
  let viewport={scale:1,x:0,y:0,initialized:false};
  let remoteVisibility={};
  const STATE_URL='state.json';
  const STATE_POLL_MS=5000;

  items.forEach((el,i)=>{
    el.querySelectorAll('img').forEach(img=>{img.draggable=false;img.addEventListener('dragstart',e=>e.preventDefault())});
    defaultLayout[el.dataset.id]={left:parseFloat(el.style.left),top:parseFloat(el.style.top),rot:parseFloat(getComputedStyle(el).getPropertyValue('--rot'))||0,z:i+10};
  });
  try{layout={...defaultLayout,...JSON.parse(localStorage.getItem(localLayoutKey)||'{}')}}catch(e){layout={...defaultLayout}}
  Object.keys(defaultLayout).forEach(id=>layout[id]={...defaultLayout[id],...(layout[id]||{})});
  applyLayout();

  function applyLayout(){items.forEach(el=>{const s=layout[el.dataset.id];el.style.left=s.left+'px';el.style.top=s.top+'px';el.style.setProperty('--rot',s.rot+'deg');el.style.zIndex=s.z});drawThreads()}
  function saveLayout(){localStorage.setItem(localLayoutKey,JSON.stringify(layout))}
  function fit(){const s=Math.min(innerWidth/2200,innerHeight/1400)*.97;if(!viewport.initialized){viewport.scale=s;viewport.x=(innerWidth-2200*s)/2;viewport.y=(innerHeight-1400*s)/2;viewport.initialized=true}updateWrap()}
  function updateWrap(){wrap.style.transform=`translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`}
  addEventListener('resize',fit);fit();

  let panning=false,pan={};
  scene.addEventListener('pointerdown',e=>{if(e.target.closest('.item')||e.target.closest('#adminButton')||e.target.closest('#helpCard'))return;panning=true;scene.classList.add('panning');pan={x:e.clientX,y:e.clientY,ox:viewport.x,oy:viewport.y}});
  addEventListener('pointermove',e=>{if(!panning)return;viewport.x=pan.ox+e.clientX-pan.x;viewport.y=pan.oy+e.clientY-pan.y;updateWrap()});
  addEventListener('pointerup',()=>{panning=false;scene.classList.remove('panning')});
  scene.addEventListener('wheel',e=>{if(e.target.closest('.item')&&e.altKey)return;e.preventDefault();const old=viewport.scale,n=Math.max(.5,Math.min(1.75,old*(e.deltaY<0?1.06:.94))),bx=(e.clientX-viewport.x)/old,by=(e.clientY-viewport.y)/old;viewport.scale=n;viewport.x=e.clientX-bx*n;viewport.y=e.clientY-by*n;updateWrap()},{passive:false});

  items.forEach(el=>{
    let dragging=false,start={};
    el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();dragging=true;try{el.setPointerCapture(e.pointerId)}catch(_){}const s=layout[el.dataset.id];start={x:e.clientX,y:e.clientY,left:s.left,top:s.top};s.z=++zCounter;el.style.zIndex=s.z;select(el);el.classList.add('dragging')});
    el.addEventListener('pointermove',e=>{if(!dragging)return;const s=layout[el.dataset.id];s.left=start.left+(e.clientX-start.x)/viewport.scale;s.top=start.top+(e.clientY-start.y)/viewport.scale;el.style.left=s.left+'px';el.style.top=s.top+'px';drawThreads()});
    const end=()=>{if(!dragging)return;dragging=false;el.classList.remove('dragging');saveLayout()};
    el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);
    el.addEventListener('wheel',e=>{if(!e.altKey)return;e.preventDefault();const s=layout[el.dataset.id];s.rot+=e.deltaY>0?4:-4;el.style.setProperty('--rot',s.rot+'deg');saveLayout();drawThreads()},{passive:false});
  });
  function select(el){if(selected)selected.classList.remove('selected');selected=el;el.classList.add('selected')}
  addEventListener('keydown',e=>{if(selected&&['q','Q','e','E'].includes(e.key)){const s=layout[selected.dataset.id];s.rot+=e.key.toLowerCase()==='q'?-5:5;selected.style.setProperty('--rot',s.rot+'deg');saveLayout();drawThreads()}if(e.key==='Escape')closeAdmin()});
  function center(el){return{x:parseFloat(el.style.left)+el.offsetWidth/2,y:parseFloat(el.style.top)+el.offsetHeight/2}}
  function drawThreads(){threads.innerHTML='';(window.BOARD_DATA.connections||[]).forEach(([a,b])=>{const A=clueMap[a],B=clueMap[b];if(!A||!B||A.classList.contains('clue-hidden')||B.classList.contains('clue-hidden'))return;const p=center(A),q=center(B),line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',p.x);line.setAttribute('y1',p.y);line.setAttribute('x2',q.x);line.setAttribute('y2',q.y);line.setAttribute('stroke','#a2141a');line.setAttribute('stroke-width','3.5');line.setAttribute('opacity','.9');line.setAttribute('stroke-linecap','round');threads.appendChild(line)})}

  function asVisible(v){return v===true||v===1||v==='1'||v==='true'||v==='yes'||v==='да'}
  function applyVisibility(vis){
    remoteVisibility=vis||{};
    items.forEach(el=>{const show=asVisible(remoteVisibility[el.dataset.id]);el.classList.toggle('clue-hidden',!show)});
    document.querySelectorAll('[data-clue]').forEach(cb=>cb.checked=asVisible(remoteVisibility[cb.dataset.clue]));
    drawThreads();
  }
  // Absolutely empty until state.json says otherwise.
  applyVisibility({});

  const syncBadge=document.getElementById('syncBadge'),adminSync=document.getElementById('adminSyncState');
  let lastStateText='';
  async function fetchState(){
    try{
      const url=STATE_URL+'?v='+Date.now();
      const res=await fetch(url,{cache:'no-store'});
      if(!res.ok)throw new Error('HTTP '+res.status);
      const text=await res.text();
      const data=JSON.parse(text);
      if(text!==lastStateText){lastStateText=text;applyVisibility(data)}
      syncBadge.textContent='● state.json активен';syncBadge.classList.remove('offline');
      if(adminSync)adminSync.textContent='Сайт проверяет state.json каждые 5 секунд. После Commit на GitHub изменения появятся у игроков автоматически.';
    }catch(err){
      syncBadge.textContent=location.protocol==='file:'?'Открой через GitHub Pages':'state.json недоступен';syncBadge.classList.add('offline');
      if(adminSync)adminSync.textContent='Не удалось загрузить state.json. Для синхронизации сайт должен быть открыт через GitHub Pages, а не напрямую как file://.';
    }
  }
  fetchState();setInterval(fetchState,STATE_POLL_MS);

  // Admin button = local state.json generator. It does NOT write to GitHub by itself.
  const overlay=document.getElementById('adminOverlay'),loginBlock=document.getElementById('loginBlock'),panelBlock=document.getElementById('panelBlock');
  document.getElementById('adminButton').onclick=()=>{overlay.classList.remove('hidden');document.getElementById('pass').focus()};
  document.getElementById('closeAdmin').onclick=closeAdmin;overlay.querySelector('.backdrop').onclick=closeAdmin;
  function closeAdmin(){overlay.classList.add('hidden')}
  document.getElementById('loginBtn').onclick=login;document.getElementById('pass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
  function login(){if(document.getElementById('pass').value==='1234'){loginBlock.classList.add('hidden');panelBlock.classList.remove('hidden');document.getElementById('loginErr').textContent='';if(adminSync)adminSync.textContent='Панель создаёт state.json. Чтобы применить всем, замените state.json в GitHub и сделайте Commit.'}else document.getElementById('loginErr').textContent='Неверный пароль'}

  function currentGeneratedState(){
    const out={};document.querySelectorAll('[data-clue]').forEach(cb=>out[cb.dataset.clue]=cb.checked?1:0);return out;
  }
  document.querySelectorAll('[data-clue]').forEach(cb=>cb.addEventListener('change',()=>{
    // local preview immediately; remote file may overwrite on next poll
    const next=currentGeneratedState();applyVisibility(next);
  }));
  const quick=document.querySelector('.quick');
  if(quick)quick.addEventListener('click',e=>{const q=e.target.dataset.quick;if(!q)return;document.querySelectorAll('[data-clue]').forEach(cb=>{if(q==='none')cb.checked=false;else if(q==='all')cb.checked=true;else{const item=clueMap[cb.dataset.clue];const max=q==='day1'?1:2;cb.checked=item?parseInt(item.dataset.stage)<=max:false}});applyVisibility(currentGeneratedState())});

  function stateJsonText(){return JSON.stringify(currentGeneratedState(),null,2)}
  const copyBtn=document.getElementById('copyState');
  if(copyBtn)copyBtn.onclick=async()=>{try{await navigator.clipboard.writeText(stateJsonText());copyBtn.textContent='Скопировано ✓';setTimeout(()=>copyBtn.textContent='Скопировать state.json',1500)}catch(_){alert(stateJsonText())}};
  const downloadBtn=document.getElementById('downloadState');
  if(downloadBtn)downloadBtn.onclick=()=>{const blob=new Blob([stateJsonText()],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='state.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
})();
