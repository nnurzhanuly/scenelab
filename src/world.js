(function(root){
  'use strict';
  function buildSet(T, scene){
    const group=new T.Group();scene.add(group);
    const standard=(color,roughness=.7)=>new T.MeshStandardMaterial({color,roughness});
    const mat={floor:standard('#333c40',.44),wall:standard('#696b63'),stone:standard('#898d81'),wood:standard('#80634e'),metal:standard('#28322e',.4),paper:standard('#eee7d6'),red:standard('#b45c49')};
    const box=(w,h,d,m,x,y,z)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
    const cylinder=(r1,r2,h,m,x,y,z)=>{const o=new T.Mesh(new T.CylinderGeometry(r1,r2,h,24),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
    box(18,.15,17,mat.floor,0,-.11,-1);
    for(let i=-7;i<=7;i++){box(16,.004,.015,mat.metal,0,-.032,i);box(.015,.004,15,mat.metal,i,-.031,-.5);}
    const buildings=[[-5.5,3.8,-4.6,2.4,'#7d8170'],[-3.1,5.2,-5.7,2.7,'#676e72'],[.1,4.3,-5.8,3.3,'#947c6b'],[3.35,5.4,-5.6,2.7,'#7b8984'],[5.65,3.6,-4.5,2.2,'#6a707a']];
    const windowMat=new T.MeshStandardMaterial({color:'#edc99a',emissive:'#e0a362',emissiveIntensity:1.3,roughness:.35});
    buildings.forEach(([x,h,z,w,color],i)=>{
      const wall=standard(color);box(w,h,1.7,wall,x,h/2-.02,z);box(w+.12,.17,1.82,mat.stone,x,h+.02,z);
      box(w+.08,.12,.14,mat.stone,x,.25,z+.91);
      for(let row=0;row<Math.floor((h-.6)/1.12);row++)for(let col=0;col<2;col++){
        const wx=x+(col-.5)*w*.47,wy=.9+row*1.12;
        box(.58,.77,.085,mat.metal,wx,wy,z+.875);
        box(.43,.61,.09,windowMat,wx,wy,z+.93);
        box(.5,.025,.105,mat.metal,wx,wy,z+.99);
      }
    });
    // Stylized courtyard arch and climbing plants.
    box(.34,2.5,.4,mat.stone,2.6,1.25,-3);box(.34,2.5,.4,mat.stone,4.2,1.25,-3);
    const arch=new T.Mesh(new T.TorusGeometry(.8,.17,10,28,Math.PI),mat.stone);arch.position.set(3.4,2.5,-3);arch.castShadow=true;group.add(arch);
    const leaf=standard('#536452');
    for(let i=0;i<18;i++){const o=new T.Mesh(new T.IcosahedronGeometry(.19+(i%3)*.03,0),leaf);o.position.set(-4.55+Math.sin(i*1.7)*.35,.4+i*.12,-3.4+Math.cos(i)*.25);group.add(o);}
    cylinder(.42,.28,.63,mat.red,-4.55,.29,-3.3);
    // Bench, table, and the letter which anchors the story.
    for(let i=0;i<4;i++)box(1.7,.085,.13,mat.wood,-2.75,.54,.28+(i-.5)*.15);
    for(let i=0;i<3;i++)box(1.7,.12,.07,mat.wood,-2.75,.91+i*.16,-.04);
    [-3.35,-2.15].forEach(x=>{box(.07,.52,.58,mat.metal,x,.24,.36);box(.065,1.13,.07,mat.metal,x,.79,-.055);});
    cylinder(.62,.62,.10,mat.wood,0,.85,.6);cylinder(.075,.095,.81,mat.metal,0,.40,.6);cylinder(.33,.38,.05,mat.metal,0,.015,.6);
    const letter=box(.32,.012,.23,mat.paper,-.03,.91,.57);letter.rotation.y=.17;
    const seam=box(.26,.013,.008,mat.stone,-.03,.919,.57);seam.rotation.y=.17;
    cylinder(.033,.033,.014,mat.red,-.02,.925,.55);
    // Two practical lanterns become visible compositional anchors.
    const bulbs=[];
    [-3.8,3.8].forEach((x,i)=>{
      cylinder(.05,.08,3.1,mat.metal,x,1.5,-1.9);
      cylinder(.2,.22,.14,mat.metal,x,3.02,-1.9);
      const bulb=new T.Mesh(new T.SphereGeometry(.16,16,12),new T.MeshStandardMaterial({color:'#ffdec0',emissive:'#e8aa68',emissiveIntensity:2}));bulb.position.set(x,2.81,-1.9);group.add(bulb);bulbs.push(bulb);
      const light=new T.PointLight('#ffbf83',7,5,2);light.position.copy(bulb.position);group.add(light);
    });
    const moon=new T.Mesh(new T.SphereGeometry(.42,24,16),new T.MeshBasicMaterial({color:'#eee0c2'}));moon.position.set(-2,6.7,-8);group.add(moon);
    // Graphic ribbons high above the actors, made from local geometry.
    const ribbonMat=new T.MeshBasicMaterial({color:'#dfa777'});
    for(let i=0;i<13;i++){const sphere=new T.Mesh(new T.SphereGeometry(.031,8,6),ribbonMat);sphere.position.set(-3.3+i*.56,3.75-Math.sin(i/12*Math.PI)*.32,-3.15);group.add(sphere);}
    function actor(index){
      const a=new T.Group();group.add(a);
      const cloth=standard(index?'#7ba2b8':'#d99d7d'),skin=standard('#c99b7a'),hair=standard('#302824'),shoe=standard('#2e3432'),eye=standard('#292924');
      const part=(geo,m,x,y,z,parent=a)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
      const body=part(index?new T.CylinderGeometry(.22,.23,.58,18):new T.CylinderGeometry(.18,.31,.59,18),cloth,0,1.0,0);
      part(new T.CylinderGeometry(.065,.075,.16,12),skin,0,1.37,0);
      part(new T.SphereGeometry(.19,24,16),skin,0,1.59,0);
      part(new T.SphereGeometry(.20,20,12,0,Math.PI*2,0,Math.PI*.59),hair,0,1.61,-.015);
      if(!index)part(new T.CapsuleGeometry(.075,.26,4,10),hair,0,1.45,-.175);
      [-.067,.067].forEach(x=>part(new T.SphereGeometry(.018,10,8),eye,x,1.62,.175));
      part(new T.SphereGeometry(.025,10,8),skin,0,1.565,.19);
      const limbs=[];
      for(let side of [-1,1]){
        const leg=new T.Group();leg.position.set(side*.115,.74,0);a.add(leg);
        part(new T.CylinderGeometry(.073,.062,.64,10),index?mat.metal:skin,0,-.32,0,leg);
        part(new T.BoxGeometry(.16,.10,.26),shoe,0,-.69,.045,leg);limbs.push(leg);
      }
      for(let side of [-1,1]){
        const arm=new T.Group();arm.position.set(side*.26,1.25,0);a.add(arm);
        part(new T.CylinderGeometry(.065,.053,.4,10),cloth,0,-.19,0,arm);
        part(new T.CapsuleGeometry(.048,.14,3,8),skin,0,-.45,0,arm);limbs.push(arm);
      }
      return {group:a,cloth,body,limbs,index};
    }
    return {group,mat,actors:[actor(0),actor(1)],bulbs,windowMat,moon};
  }
  function createStage(container){
    const T=root.THREE,M=root.SceneLabModel;
    const renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    container.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Екі кейіпкері бар үшөлшемді кешкі түсірілім алаңы');renderer.domElement.setAttribute('role','img');
    const scene=new T.Scene();scene.background=new T.Color('#35414e');scene.fog=new T.Fog('#35414e',17,37);
    const camera=new T.PerspectiveCamera(43,1,.08,80);
    const set=buildSet(T,scene);
    const hemi=new T.HemisphereLight('#c6d7ed','#655444',1.1);scene.add(hemi);
    const key=new T.DirectionalLight('#ffcc9d',3.2);key.position.set(-3,5,4);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=7;key.shadow.camera.bottom=-5;key.shadow.camera.near=.1;key.shadow.camera.far=20;key.shadow.bias=-.0006;key.shadow.normalBias=.025;scene.add(key);
    const fill=new T.DirectionalLight('#8faad4',1.25);fill.position.set(-4,3,-3);scene.add(fill);
    const rim=new T.DirectionalLight('#e697b5',1.8);rim.position.set(3,3,-2);scene.add(rim);
    let state=M.normalize(),motion=true;
    function apply(input){
      state=M.normalize(input);const c=M.cameraPosition(state);
      camera.position.set(c.x,c.y,c.z);camera.lookAt(c.target.x,c.target.y,c.target.z);camera.setFocalLength(state.focal);camera.updateProjectionMatrix();
      const angle=state.lightAngle*Math.PI/180;key.position.set(Math.sin(angle)*5,5,Math.cos(angle)*5);
      const modes={warm:{bg:'#41434a',key:'#ffd2a5',fill:'#99aabd',rim:'#f5a287',hemi:1.0,exposure:1.15},cool:{bg:'#1d3047',key:'#b5d5ff',fill:'#6a90c8',rim:'#9b94e0',hemi:.8,exposure:1.05},noir:{bg:'#242728',key:'#fff7e9',fill:'#414d56',rim:'#eeeeee',hemi:.28,exposure:1.0}};
      const m=modes[state.mode];scene.background.set(m.bg);scene.fog.color.set(m.bg);key.color.set(m.key);key.intensity=state.intensity*2.7;fill.color.set(m.fill);fill.intensity=state.mode==='noir'?.28:1.1;rim.color.set(m.rim);hemi.intensity=m.hemi;renderer.toneMappingExposure=m.exposure;
      set.actors.forEach((a,i)=>{const data=state.actors[i];a.cloth.color.set(data.color);if(state.mode==='noir'){const grey=(a.cloth.color.r+a.cloth.color.g+a.cloth.color.b)/3;a.cloth.color.setRGB(grey,grey,grey);}a.group.position.set(data.x,0,data.z);a.group.rotation.y=i?-.20:.14;});
      renderer.domElement.style.filter=state.mode==='noir'?'grayscale(1)':'';
    }
    function update(time){
      const t=motion?time:0;
      set.actors.forEach((a,i)=>{
        const data=state.actors[i],local=t+i*.73;
        a.group.position.set(data.x,0,data.z);a.group.rotation.y=i?-.20:.14;
        a.limbs.forEach(l=>l.rotation.set(0,0,0));
        if(data.action==='walk'){
          a.group.position.x+=Math.sin(local*.85)*.34;a.group.position.y=Math.abs(Math.sin(local*5))*.018;
          a.limbs[0].rotation.x=Math.sin(local*5)*.44;a.limbs[1].rotation.x=-Math.sin(local*5)*.44;
          a.limbs[2].rotation.x=-Math.sin(local*5)*.35;a.limbs[3].rotation.x=Math.sin(local*5)*.35;
        }else if(data.action==='wave'){
          a.limbs[3].rotation.z=-2.3+Math.sin(local*4)*.22;a.limbs[3].rotation.x=.12;
        }else if(data.action==='reach'){
          a.limbs[3].rotation.x=-1.05-Math.sin(local*1.6)*.1;a.limbs[3].rotation.z=-.28;
          a.group.rotation.y=-.2;
        }else {a.limbs[2].rotation.z=.05+Math.sin(local*1.1)*.025;a.limbs[3].rotation.z=-.05-Math.sin(local*1.1)*.025;}
      });
    }
    function resize(){const rect=container.getBoundingClientRect();const w=Math.max(1,rect.width),h=Math.max(1,rect.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.setFocalLength(state.focal);camera.updateProjectionMatrix();}
    function render(){renderer.render(scene,camera);}
    function capture(type='image/png',quality=.9){render();
      // Canvas exports include monochrome pixels rather than relying on CSS.
      if(state.mode==='noir') {const c=document.createElement('canvas');c.width=renderer.domElement.width;c.height=renderer.domElement.height;const ctx=c.getContext('2d');ctx.filter='grayscale(1)';ctx.drawImage(renderer.domElement,0,0);return c.toDataURL(type,quality);}
      return renderer.domElement.toDataURL(type,quality);
    }
    apply(state);resize();update(0);render();
    return {renderer,scene,camera,set,apply,update,resize,render,capture,setMotion(value){motion=!!value;},getState:()=>M.normalize(state)};
  }
  root.SceneLabWorld=Object.freeze({buildSet,createStage});
})(globalThis);
