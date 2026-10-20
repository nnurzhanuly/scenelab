(function(){
  'use strict';
  const M=globalThis.SceneLabModel,$=id=>document.getElementById(id),storageKey='scenelab-v1';
  let state=M.normalize(),shots=[],selected=-1,stage=null,playing=false,startTime=0,playIndex=-1,recording=null,animationTime=0;
  const thumbs=[];const modeNames={warm:'ЖЫЛЫ ЖАРЫҚ',cool:'СУЫҚ ЖАРЫҚ',noir:'НУАР'};
  function say(text){$('status').textContent=text;}
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify(M.project(state,shots)));}catch{}}
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function downloadData(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();}
  function syncUI(){
    $('idea').value=state.idea;
    ['azimuth','elevation','distance','focal','intensity','lightAngle'].forEach(key=>{
      $(key).value=state[key];const unit=key==='distance'?' м':key==='focal'?' mm':key==='intensity'?' ×':'°';
      $(key+'-out').textContent=(key==='distance'?state[key].toFixed(1):key==='intensity'?state[key].toFixed(2):Math.round(state[key]))+unit;
    });
    const actor=state.actors[state.actor];$('actor').value=state.actor;$('action').value=actor.action;$('actor-color').value=actor.color;
    ['x','z'].forEach(axis=>{$('actor-'+axis).value=actor[axis];$('actor-'+axis+'-out').textContent=actor[axis].toFixed(1)+' м';});
    document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===state.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
    document.querySelectorAll('[data-camera]').forEach(b=>{const p=M.CAMERAS[b.dataset.camera];b.classList.toggle('active',Object.keys(p).every(k=>Math.abs(p[k]-state[k])<.05));});
    $('view-mode').textContent=modeNames[state.mode];$('camera-caption').textContent=Math.round(state.focal)+' mm · '+(selected<0?'LIVE VIEW':'КАДР '+(selected+1));
    $('shot-label').textContent=selected<0?'LIVE VIEW':String(selected+1).padStart(2,'0');
  }
  function apply(edit=true){state=M.normalize(state);if(edit)selected=-1;stage.apply(state);syncUI();updateSelected();if(edit)persist();}
  function updateSelected(){document.querySelectorAll('.shot').forEach((card,i)=>card.classList.toggle('active',i===selected));}
  function thumbnail(){stage.render();const c=document.createElement('canvas');c.width=320;c.height=200;const ctx=c.getContext('2d');ctx.fillStyle='#171c19';ctx.fillRect(0,0,c.width,c.height);if(state.mode==='noir')ctx.filter='grayscale(1)';const source=stage.renderer.domElement,scale=Math.min(c.width/source.width,c.height/source.height),w=source.width*scale,h=source.height*scale;ctx.drawImage(source,(c.width-w)/2,(c.height-h)/2,w,h);return c.toDataURL('image/jpeg',.78);}
  function regenerateThumbnails(){
    const previous=state;shots.forEach((shot,i)=>{state=M.normalize(shot.settings);stage.apply(state);stage.update(0);thumbs[i]=thumbnail();});
    thumbs.length=shots.length;state=previous;stage.apply(state);stage.update(animationTime);stage.render();
  }
  function selectShot(i,fromPlayback=false){if(!shots[i])return;selected=i;state=M.normalize(shots[i].settings);stage.apply(state);if(!fromPlayback)stage.update(0);syncUI();updateSelected();if(!fromPlayback){persist();say('Кадр баптауы ашылды. Өзгертілген көріністі «Кадр қосу» арқылы жеке сақтаңыз.');}}
  function renderShots(){
    const holder=$('shots');holder.replaceChildren();
    shots.forEach((shot,i)=>{
      const card=document.createElement('article');card.className='shot';
      const preview=document.createElement('button');preview.type='button';preview.className='shot-preview';preview.setAttribute('aria-label',shot.title+' кадрын ашу');
      if(thumbs[i]){const img=document.createElement('img');img.src=thumbs[i];img.alt=shot.title;preview.appendChild(img);}else{const span=document.createElement('span');span.className='empty-frame';span.textContent=String(i+1).padStart(2,'0');preview.appendChild(span);}
      preview.addEventListener('click',()=>{if(!playing)selectShot(i);});card.appendChild(preview);
      const fields=document.createElement('div');fields.className='shot-fields';const title=document.createElement('input');title.type='text';title.maxLength=80;title.value=shot.title;title.setAttribute('aria-label',`${i+1}-кадр атауы`);title.addEventListener('input',()=>{shot.title=title.value;preview.setAttribute('aria-label',shot.title+' кадрын ашу');persist();});fields.appendChild(title);
      const bottom=document.createElement('div');bottom.className='shot-bottom';const label=document.createElement('label');label.textContent='Ұзақтығы ';
      const duration=document.createElement('select');duration.setAttribute('aria-label',`${i+1}-кадр ұзақтығы`);for(let j=2;j<=8;j++){const o=document.createElement('option');o.value=j;o.textContent=j+' с';duration.appendChild(o);}duration.value=shot.duration;duration.addEventListener('change',()=>{shot.duration=Number(duration.value);updateTimeline();persist();});label.appendChild(duration);bottom.appendChild(label);
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`${i+1}-кадрды өшіру`);remove.addEventListener('click',()=>{if(playing)return;shots.splice(i,1);thumbs.splice(i,1);selected=-1;renderShots();syncUI();persist();});bottom.appendChild(remove);fields.appendChild(bottom);card.appendChild(fields);holder.appendChild(card);
    });
    if(!shots.length){const p=document.createElement('p');p.className='timeline-empty';p.textContent='Алғашқы көріністі баптап, «Кадр қосу» батырмасын басыңыз.';holder.appendChild(p);}
    updateSelected();updateTimeline();
  }
  function updateTimeline(){$('timeline-info').textContent=shots.length+' кадр · '+shots.reduce((sum,s)=>sum+s.duration,0)+' секунд';$('add-shot').disabled=playing||!!recording?.finalizing||shots.length>=8;}
  function newPlan(){shots=M.makePlan(state.idea,state);selected=-1;regenerateThumbnails();renderShots();persist();say('Үш кадрдан тұратын үлгі дайын. Әр кадрдың атауын, ұзақтығын және көрінісін өңдей аласыз.');}
  function setBusy(busy){const locked=busy||!!recording?.finalizing;document.querySelectorAll('.editor-controls').forEach(f=>f.disabled=locked);['add-shot','reset','save-project','load-project','export-board','capture'].forEach(id=>$(id).disabled=locked);document.querySelectorAll('.shot button,.shot input,.shot select').forEach(el=>el.disabled=locked);$('play').disabled=!!recording?.finalizing;$('play').textContent=playing?'■ Тоқтату':recording?.finalizing?'Бейне дайындалуда…':'▶ Анимацияны ойнату';$('record').disabled=locked||!recordMime;updateTimeline();}
  function drawRecording(){if(!recording)return;const c=recording.canvas,ctx=recording.ctx,source=stage.renderer.domElement;ctx.filter='none';ctx.fillStyle='#111';ctx.fillRect(0,0,c.width,c.height);if(state.mode==='noir')ctx.filter='grayscale(1)';const scale=Math.min(c.width/source.width,c.height/source.height);const w=source.width*scale,h=source.height*scale;ctx.drawImage(source,(c.width-w)/2,(c.height-h)/2,w,h);}
  function stopPlayback(message='Анимациялық эскиз аяқталды.'){playing=false;document.body.classList.remove('recording');if(recording){recording.finalizing=true;if(recording.recorder.state!=='inactive')recording.recorder.stop();}setBusy(false);$('play-time').textContent='00:00';persist();say(message);}
  function startPlayback(shouldRecord=false){
    if(recording?.finalizing){say('Алдыңғы бейне дайындалып жатыр. Аяқталған соң қайта бастауға болады.');return;}if(playing){stopPlayback('Ойнату тоқтатылды.');return;}if(!shots.length){say('Алдымен жоспарға кемінде бір кадр қосыңыз.');return;}
    playing=true;startTime=performance.now();playIndex=0;selectShot(0,true);stage.update(0);stage.render();
    if(shouldRecord){
      try{
        const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=800;const ctx=canvas.getContext('2d');
        const stream=canvas.captureStream(24),recorder=new MediaRecorder(stream,{mimeType:recordMime,videoBitsPerSecond:4_000_000});const chunks=[];
        const job={canvas,ctx,stream,recorder,failed:false,finalizing:false};recording=job;drawRecording();
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(recording===job)recording=null;setBusy(playing);if(job.failed){say('WebM жазу орындалмады. PNG кадрларын сақтауға болады.');return;}const blob=new Blob(chunks,{type:recordMime});if(blob.size){downloadBlob(blob,'SceneLab_animation.webm');say('WebM бейнесі дайын. Браузер жүктеуді ұсынды.');}else say('Бейне бос шықты. PNG кадрлар жоспарын қолданыңыз.');};
        recorder.onerror=()=>{job.failed=true;if(recording===job)stopPlayback('Бұл браузерде бейне жазу орындалмады. PNG кадрларын сақтауға болады.');};
        recorder.start(250);document.body.classList.add('recording');
      }catch{if(recording){recording.failed=true;recording.stream.getTracks().forEach(t=>t.stop());}recording=null;stopPlayback('WebM жазу қолжетімсіз. PNG кадрларын сақтауға болады.');return;}
    }
    setBusy(true);say(shouldRecord?'Кадрлар бейнеге жазылып жатыр. Осы бетті ашық ұстаңыз.':'Кадрлар жоспары ретімен ойнатылып жатыр.');
  }
  let recordMime='';
  function textLines(ctx,text,width,maxLines=2){const words=String(text).split(/\s+/);const lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){lines.push(line);line=word;if(lines.length===maxLines){lines[maxLines-1]+='…';return lines;}}else line=next;}if(line)lines.push(line);return lines.slice(0,maxLines);}
  async function exportBoard(){
    if(!shots.length){say('Жоспарға кемінде бір кадр қосыңыз.');return;}regenerateThumbnails();renderShots();
    const c=document.createElement('canvas'),cols=Math.min(3,shots.length),cell=440,gap=30,rows=Math.ceil(shots.length/cols);c.width=cols*cell+(cols+1)*gap;c.height=190+rows*350+35;const ctx=c.getContext('2d');ctx.fillStyle='#f4f1e8';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#2b3029';ctx.font='bold 36px Arial';ctx.fillText('SceneLab / Кадрлар жоспары',30,60);ctx.fillStyle='#776e63';ctx.font='18px Arial';textLines(ctx,state.idea,c.width-60,2).forEach((line,i)=>ctx.fillText(line,30,103+i*27));
    for(let i=0;i<shots.length;i++){const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=thumbs[i];});const x=gap+(i%cols)*(cell+gap),y=170+Math.floor(i/cols)*350;ctx.drawImage(img,x,y,cell,275);ctx.fillStyle='#2b3029';ctx.font='bold 17px Arial';textLines(ctx,shots[i].title,cell,1).forEach(line=>ctx.fillText(line,x,y+303));ctx.fillStyle='#7b7268';ctx.font='14px Arial';ctx.fillText(shots[i].duration+' с · '+modeNames[shots[i].settings.mode]+' · '+Math.round(shots[i].settings.focal)+' mm',x,y+327);}
    downloadData(c.toDataURL('image/png'),'SceneLab_storyboard.png');say('Кадрлар жоспары PNG суреті ретінде дайын.');
  }
  try{
    stage=globalThis.SceneLabWorld.createStage($('stage'));
    try{const raw=localStorage.getItem(storageKey);if(raw){const saved=M.parseProject(raw);state=saved.state;shots=saved.shots;}}catch{}
    if(!shots.length)shots=M.makePlan(state.idea,state);
    apply(false);regenerateThumbnails();renderShots();$('loading').hidden=true;
    if(globalThis.MediaRecorder&&typeof HTMLCanvasElement.prototype.captureStream==='function')recordMime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
    $('record').disabled=!recordMime;if(!recordMime)$('record').title='Бұл браузер WebM жазуды қолдамайды. PNG экспортын қолданыңыз.';
    if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){$('motion').checked=false;stage.setMotion(false);}
    ['azimuth','elevation','distance','focal','intensity','lightAngle'].forEach(key=>$(key).addEventListener('input',()=>{state[key]=Number($(key).value);apply();}));
    $('idea').addEventListener('input',()=>{state.idea=$('idea').value;persist();});
    document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{state={...state,...M.CAMERAS[b.dataset.camera]};apply();}));
    document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;apply();}));
    $('actor').addEventListener('change',()=>{state.actor=Number($('actor').value);syncUI();persist();});
    $('action').addEventListener('change',()=>{state.actors[state.actor].action=$('action').value;apply();});
    ['x','z'].forEach(axis=>$('actor-'+axis).addEventListener('input',()=>{state.actors[state.actor][axis]=Number($('actor-'+axis).value);apply();}));
    $('actor-color').addEventListener('input',()=>{state.actors[state.actor].color=$('actor-color').value;apply();});
    $('grid').addEventListener('change',()=>{$('grid-guide').hidden=!$('grid').checked;});$('motion').addEventListener('change',()=>stage.setMotion($('motion').checked));
    $('generate-plan').addEventListener('click',newPlan);
    $('add-shot').addEventListener('click',()=>{if(playing||shots.length>=8)return;shots.push({title:'Кадр '+String(shots.length+1).padStart(2,'0'),duration:4,settings:M.normalize(state)});thumbs.push(thumbnail());selected=shots.length-1;renderShots();syncUI();persist();say('Көрініс кадрлар жоспарына қосылды.');});
    $('capture').addEventListener('click',()=>{downloadData(stage.capture(),'SceneLab_frame.png');say('Қазіргі кадр PNG суреті ретінде дайын.');});
    $('play').addEventListener('click',()=>startPlayback(false));$('record').addEventListener('click',()=>startPlayback(true));
    $('export-board').addEventListener('click',()=>exportBoard().catch(()=>say('PNG жоспарын жасау орындалмады. Қайта байқап көріңіз.')));
    $('save-project').addEventListener('click',()=>{downloadBlob(new Blob([JSON.stringify(M.project(state,shots),null,2)],{type:'application/json'}),'SceneLab_project.json');say('Жоба JSON файлына сақталды. Оны «Жобаны ашу» арқылы жүктей аласыз.');});
    $('load-project').addEventListener('click',()=>$('project-file').click());
    $('project-file').addEventListener('change',async()=>{const file=$('project-file').files[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('JSON файлы 2 MB-тан аспауы керек.');const loaded=M.parseProject(await file.text());state=loaded.state;shots=loaded.shots;selected=-1;apply(false);regenerateThumbnails();renderShots();persist();say('Жоба ашылды. Кадрлар мен баптаулар қалпына келтірілді.');}catch(e){say(e.message||'Файлды ашу мүмкін болмады.');}finally{$('project-file').value='';}});
    $('reset').addEventListener('click',()=>{state=M.normalize();selected=-1;apply(false);newPlan();say('Бастапқы көрініс қалпына келтірілді.');});
    let pointer=null;
    stage.renderer.domElement.addEventListener('pointerdown',e=>{if(playing||e.button>0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};stage.renderer.domElement.setPointerCapture(e.pointerId);});
    stage.renderer.domElement.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId||playing)return;state.azimuth+=(e.clientX-pointer.x)*.22;state.elevation+=(e.clientY-pointer.y)*.16;pointer.x=e.clientX;pointer.y=e.clientY;apply();});
    const release=e=>{if(pointer?.id===e.pointerId)pointer=null;};['pointerup','pointercancel','lostpointercapture'].forEach(type=>stage.renderer.domElement.addEventListener(type,release));
    stage.renderer.domElement.addEventListener('wheel',e=>{if(playing)return;e.preventDefault();state.distance+=Math.sign(e.deltaY)*.35;apply();},{passive:false});
    new ResizeObserver(()=>stage.resize()).observe($('viewbox'));
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)stopPlayback('Басқа бетке ауысқанда ойнату тоқтатылды.');});
    const origin=performance.now();
    function loop(now){
      animationTime=(now-origin)/1000;
      if(playing){const t=(now-startTime)/1000,pos=M.timelinePosition(shots,t);if(pos.ended){stopPlayback();}else{if(pos.index!==playIndex){playIndex=pos.index;selectShot(playIndex,true);}stage.update(pos.local);$('play-time').textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');}}
      if(!playing)stage.update(animationTime);stage.render();drawRecording();requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);globalThis.SceneLab=Object.freeze({getProject:()=>M.project(state,shots),getStage:()=>stage});
  }catch(e){$('loading').hidden=false;$('loading').textContent='3D алаңды ашу мүмкін болмады. WebGL қолдайтын браузерде қайта ашыңыз. Жоба коды архивте толық берілген.';say('Графикалық көрініс жүктелмеді.');document.querySelectorAll('button,input,select,textarea').forEach(el=>{if(!['help-button','close-help'].includes(el.id))el.disabled=true;});console.error('SceneLab initialization failed',e);}
  $('help-button').addEventListener('click',()=>$('help').showModal());$('close-help').addEventListener('click',()=>$('help').close());
})();
