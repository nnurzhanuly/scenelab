import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const candidate=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist/scenelab');
const dir=fs.existsSync(path.join(candidate,'index.html'))?candidate:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({console,AbortController});
vm.runInContext(fs.readFileSync(path.join(dir,'src/model.js'),'utf8'),context);
const M=context.SceneLabModel;

test('untrusted project values stay finite, bounded and cannot introduce unsupported actions',()=>{
  const s=M.normalize({distance:Infinity,focal:-20,azimuth:999,mode:'<script>',actors:[{x:NaN,z:99,color:'url(javascript:alert(1))',action:'execute'}]});
  assert.equal(s.distance,M.DEFAULT.distance);assert.equal(s.focal,24);assert.equal(s.azimuth,110);assert.equal(s.mode,'warm');
  assert.equal(s.actors[0].x,-.7);assert.equal(s.actors[0].z,1.4);assert.equal(s.actors[0].color,'#d99d7d');assert.equal(s.actors[0].action,'reach');
  const fresh=M.normalize();s.actors[1].x=100;assert.equal(fresh.actors[1].x,1.25);
});
test('generated plan preserves the user premise and makes three distinct camera setups',()=>{
  const idea='Жұмбақ түн: <img src=x onerror=alert(1)>',s=M.normalize();const plan=M.makePlan(idea,s);
  assert.equal(plan.length,3);assert.equal(plan[0].settings.idea,idea);assert.equal(plan[1].settings.mode,'cool');
  assert.equal(new Set(plan.map(p=>p.settings.distance)).size,3);assert.equal(plan[1].settings.actors[0].action,'reach');
  plan[0].settings.actors[0].x=2;assert.equal(plan[1].settings.actors[0].x,-.7);
});
test('portable JSON round-trips and malformed or oversized project payloads fail clearly',()=>{
  const s=M.normalize(),data=M.project(s,M.makePlan(s.idea,s)),loaded=M.parseProject(JSON.stringify(data));
  assert.equal(JSON.stringify(data),JSON.stringify(loaded));
  assert.throws(()=>M.parseProject('{'));assert.throws(()=>M.parseProject('{"type":"other","version":1}'));assert.throws(()=>M.parseProject('a'.repeat(2_000_001)));
  const normalized=M.parseProject(JSON.stringify({type:'scenelab',version:1,state:{},shots:[null,{duration:100},...Array(12).fill({})]}));
  assert.equal(normalized.shots.length,8);assert.equal(normalized.shots[1].duration,8);assert.equal(normalized.shots[0].title,'Кадр 1');
});
test('timeline cuts and completion use exact elapsed time, independent of frame sampling',()=>{
  const shots=M.makePlan('Оқиға',M.normalize());
  assert.equal(M.timelinePosition(shots,0).index,0);assert.equal(M.timelinePosition(shots,3.999).index,0);
  assert.equal(M.timelinePosition(shots,4).index,1);assert.equal(M.timelinePosition(shots,8).index,2);assert.equal(M.timelinePosition(shots,11.9).ended,false);assert.equal(M.timelinePosition(shots,12).ended,true);
  for(const sample of [1/24,1/60,1/144]){const time=Math.ceil(4/sample)*sample;assert.equal(M.timelinePosition(shots,time).index,1);}
});
test('camera orbit stays at the requested distance and every official preset is finite',()=>{
  for(const p of Object.values(M.CAMERAS)){
    const s=M.normalize({...M.DEFAULT,...p}),c=M.cameraPosition(s);
    assert.ok(Object.values(c).filter(x=>typeof x==='number').every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(c.x-c.target.x,c.y-c.target.y,c.z-c.target.z)-s.distance)<1e-9);
  }
});
test('offline Three.js bundle builds actual scene geometry with two independently animated actors',()=>{
  vm.runInContext(fs.readFileSync(path.join(dir,'src/vendor/three.bundle.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(dir,'src/world.js'),'utf8'),context);
  const T=context.THREE;assert.equal(T.REVISION,'180');assert.equal(typeof T.WebGLRenderer,'function');assert.equal(typeof T.CapsuleGeometry,'function');
  const scene=new T.Scene(),set=context.SceneLabWorld.buildSet(T,scene);assert.equal(set.actors.length,2);
  assert.notEqual(set.actors[0].cloth,set.actors[1].cloth);assert.equal(set.actors[0].limbs.length,4);
  let meshes=0;scene.traverse(obj=>{if(obj.isMesh){meshes++;const attr=obj.geometry.getAttribute('position');for(const n of attr.array)assert.ok(Number.isFinite(n));}});
  assert.ok(meshes>100);scene.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(set.actors[0].group);assert.ok(bounds.max.y>1.7);assert.ok(bounds.min.y>-.01);
});
test('real camera and lighting respond to settings with a stubbed GPU only',()=>{
  const T=context.THREE;const saved=T.WebGLRenderer;
  class Renderer{constructor(){this.domElement={setAttribute(){},style:{},width:800,height:500};this.shadowMap={};}setPixelRatio(){}setSize(w,h){this.domElement.width=w;this.domElement.height=h;}render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);}}
  T.WebGLRenderer=Renderer;
  try{
    const stage=context.SceneLabWorld.createStage({appendChild(){},getBoundingClientRect:()=>({width:800,height:500})});
    const before=stage.camera.position.clone();stage.apply({...M.DEFAULT,...M.CAMERAS.close,mode:'noir'});stage.update(.5);stage.render();assert.ok(before.distanceTo(stage.camera.position)>1);assert.equal(stage.renderer.domElement.style.filter,'grayscale(1)');
    assert.ok(Math.abs(stage.camera.getFocalLength()-M.CAMERAS.close.focal)<1e-8);
    stage.apply({...M.DEFAULT,...M.CAMERAS.wide});stage.resize();stage.render();
    assert.ok(Math.abs(stage.camera.getFocalLength()-M.CAMERAS.wide.focal)<1e-8);
    for(const actor of stage.set.actors){const head=new T.Vector3(actor.group.position.x,1.8,actor.group.position.z).project(stage.camera);assert.ok(Math.abs(head.x)<1&&Math.abs(head.y)<1);}
    stage.setMotion(false);stage.update(0);const first=stage.set.actors[0].limbs[3].rotation.x;stage.update(9);assert.equal(stage.set.actors[0].limbs[3].rotation.x,first);
  }finally{T.WebGLRenderer=saved;}
});
