/* SceneLab portable model. Also used by dependency-free Node tests. */
(function (root) {
  'use strict';
  const CAMERAS = Object.freeze({
    wide: { azimuth: 26, elevation: 18, distance: 10.5, focal: 42 },
    medium: { azimuth: 6, elevation: 12, distance: 6.6, focal: 48 },
    close: { azimuth: -22, elevation: 9, distance: 4.7, focal: 62 },
    high: { azimuth: 26, elevation: 52, distance: 10.2, focal: 42 }
  });
  const DEFAULT = Object.freeze({
    idea: 'Кешкі қалада бір қыз ескі хат тауып алады. Досы оның қасына келеді.',
    title: 'Кешкі хат', mode: 'warm', intensity: 1.25, lightAngle: -35,
    ...CAMERAS.wide, actor: 0,
    actors: [{x:-0.7,z:0,color:'#d99d7d',action:'reach'}, {x:1.25,z:-0.5,color:'#7ba2b8',action:'idle'}]
  });
  const MODES = ['warm','cool','noir'];
  const ACTIONS = ['idle','walk','wave','reach'];
  function clamp(value, min, max, fallback) {
    const n=Number(value); return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
  }
  function cleanText(v, fallback, limit) { return typeof v==='string'?v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,limit):fallback; }
  function normalize(input={}) {
    const p=input&&typeof input==='object'?input:{};
    return {
      idea:cleanText(p.idea,DEFAULT.idea,600),title:cleanText(p.title,DEFAULT.title,70),
      mode:MODES.includes(p.mode)?p.mode:DEFAULT.mode,
      intensity:clamp(p.intensity,.3,2.6,DEFAULT.intensity),lightAngle:clamp(p.lightAngle,-120,120,DEFAULT.lightAngle),
      azimuth:clamp(p.azimuth,-110,110,DEFAULT.azimuth),elevation:clamp(p.elevation,5,65,DEFAULT.elevation),
      distance:clamp(p.distance,3.5,15,DEFAULT.distance),focal:clamp(p.focal,24,85,DEFAULT.focal),
      actor:Math.round(clamp(p.actor,0,1,0)),
      actors:DEFAULT.actors.map((fallback,i)=>{
        const a=Array.isArray(p.actors)&&p.actors[i]&&typeof p.actors[i]==='object'?p.actors[i]:{};
        return {x:clamp(a.x,-2.5,2.5,fallback.x),z:clamp(a.z,-1.4,1.4,fallback.z),
          color:typeof a.color==='string'&&/^#[a-f0-9]{6}$/i.test(a.color)?a.color:fallback.color,
          action:ACTIONS.includes(a.action)?a.action:fallback.action};
      })
    };
  }
  function cameraPosition(state) {
    const s=normalize(state),a=s.azimuth*Math.PI/180,e=s.elevation*Math.PI/180;
    const center=s.focal>58?{x:s.actors[0].x,y:1.14,z:s.actors[0].z}:{x:0,y:1.05,z:0};
    return {target:center,x:center.x+s.distance*Math.cos(e)*Math.sin(a),
      y:center.y+s.distance*Math.sin(e),z:center.z+s.distance*Math.cos(e)*Math.cos(a)};
  }
  function makePlan(idea, base) {
    const s=normalize({...base,idea});
    const lower=s.idea.toLocaleLowerCase('kk');
    const mode=/түн|құпия|жұмбақ|суық/.test(lower)?'cool':/қара.ақ|көлеңке|нуар/.test(lower)?'noir':s.mode;
    return [
      {title:'01 · Оқиға өтетін орта',duration:4,settings:normalize({...s,...CAMERAS.wide,mode})},
      {title:'02 · Кейіпкердің әрекеті',duration:4,settings:normalize({...s,...CAMERAS.medium,mode,actors:[{...s.actors[0],action:'reach'},s.actors[1]]})},
      {title:'03 · Сезім мен деталь',duration:4,settings:normalize({...s,...CAMERAS.close,mode,actors:[{...s.actors[0],action:'wave'},s.actors[1]]})}
    ];
  }
  function normalizeShot(shot={},i=0) {
    const s=shot&&typeof shot==='object'?shot:{};
    return {title:cleanText(s.title,`Кадр ${i+1}`,80),duration:Math.round(clamp(s.duration,2,8,4)),settings:normalize(s.settings)};
  }
  function project(state,shots) {return {type:'scenelab',version:1,state:normalize(state),shots:(Array.isArray(shots)?shots:[]).slice(0,8).map(normalizeShot)};}
  function parseProject(text) {
    if(typeof text!=='string'||text.length>2_000_000)throw new Error('Жоба файлы тым үлкен.');
    let data;try {data=JSON.parse(text);} catch {throw new Error('JSON файлын оқу мүмкін болмады.');}
    if(!data||data.type!=='scenelab'||data.version!==1)throw new Error('SceneLab жобасының JSON файлын таңдаңыз.');
    return project(data.state,data.shots);
  }
  function timelinePosition(shots,time) {
    const clean=shots.slice(0,8).map(normalizeShot); const total=clean.reduce((sum,s)=>sum+s.duration,0);
    const t=clamp(time,0,total,0);let elapsed=0;
    for(let i=0;i<clean.length;i++){if(t<elapsed+clean[i].duration)return {index:i,local:t-elapsed,total,ended:false};elapsed+=clean[i].duration;}
    return {index:Math.max(0,clean.length-1),local:clean.length?clean.at(-1).duration:0,total,ended:true};
  }
  root.SceneLabModel=Object.freeze({CAMERAS,DEFAULT,MODES,ACTIONS,normalize,cameraPosition,makePlan,project,parseProject,timelinePosition});
})(globalThis);
