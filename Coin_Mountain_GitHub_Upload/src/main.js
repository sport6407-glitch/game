import * as THREE from 'three';


const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const TOTAL=1500000,BASE_TOP=2,PILE_RADIUS=15,CORE_R=14.6,CORE_H=7.9,EYE=1.7,COIN_COUNT=12000,MAX_PITCH=1.5,ARENA_R=37,SAVE_KEY='coinMountainSave3',MAX_DRONES=25,DRONE_RATE=.6,CYCLE=480,PILE_MIN_R=15.8;
// ---------- state ----------
let scene,camera,renderer,canvas,clock,sun,moon,hemi,pileLight,stars,starsMat,sunMesh,moonMesh,cloudMat,clouds=[],ambientMotesObj=null;
let grassMat,hillMats=[],leafMat,coinGroup,core,coreMat,coinMat,inst,coinRims,coinMarks,coinYs=[],pileH=CORE_H,pileYMax=8.3,lastPileStep=-1;
let handGroup,rigs={},toolMount,props={},droneGroup,drones=[],goldens=[],obstacles=[],particles={};
let keys={},yaw=0,pitch=0,locked=false,lockBlocked=false,mouseHeld=false,shopOpen=false,settingsOpen=false,settingsFromMenu=false,won=false;
let dragId=null,dragLastX=0,dragLastY=0,dragMoved=0,lastHint='',lastPrompt='',resetArmed=false;
let player={x:0,y:EYE,z:25,vy:0,speed:5.2};
const defaultBinds={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',collect:'KeyE',shop:'KeyB',sprint:'ShiftLeft'};
let binds={...defaultBinds},rebindAction=null;
let masterVolume=.7,sfxVolume=.8,ambVolume=.5,mouseSensitivity=1,invertY=false,showHints=true,headBob=true,quality='high',baseFov=75,fovCur=75;
let collected=0,wallet=0,rate=1,tool='Bare hands',path=null,upgradeLevel={hand:0,machine:0,magnet:0,bag:0,automation:0,alchemy:0},droneCount=0,ascensions=0,lifetime=0,runSeconds=0;
let claimedMilestones=new Set(),collectBuffer=0,comboT=0,floatAcc=0,floatTimer=0,soundTimer=0,saveTimer=0,goldenTimer=6,birdTimer=5,partTimer=0,stepAcc=0,bobT=0,bobAmp=0,tod=.15,dayFactor=1,hudDirty=true,offlineGain=0;
const abilityCooldowns={hand:0,machine:0,magnet:0,bag:0,automation:0,alchemy:0};
const abilityBuffs={hand:0,machine:0,magnet:0,bag:0,automation:0,alchemy:0};
const audio={};let noiseBuf=null;
const ECONOMY_COST_SCALE=2,ECONOMY_GAIN_SCALE=.30;
const upgrades={
 hand:[['Padded gloves',15,1.8],['Precision grip',160,3.5],['Coin gauntlets',850,8],['Rapid sorter',4200,20],['Master collector',18000,55]],
 machine:[['Steel coin scoop',22,2.3],['Reinforced bucket',220,4.5],['Mini conveyor',1100,10],['Front loader',5200,25],['Coin excavator',22000,65]],
 magnet:[['Pocket magnet',25,2.6],['Copper coil',300,5],['Pulse field',1500,12],['Levitator array',7000,30],['Coin singularity',28000,75]],
 bag:[['Canvas coin pouch',22,1.8],['Trail backpack',260,4.2],['Reinforced satchel',1250,10],['Vault carrier',6000,25],['Bottomless pack',26000,62]],
 automation:[['Clockwork helper',35,1.4],['Scout drone',420,4.5],['Swarm controller',1900,12],['Mining squad',8500,31],['Autonomous fleet',36000,78]],
 alchemy:[['Lucky charm',30,2.0],['Gilded catalyst',350,4.8],['Fortune lens',1650,12],['Midas capacitor',7600,29],['Philosopher core',32000,74]]
};
for(const tier of Object.values(upgrades))for(const u of tier){u[1]=Math.round(u[1]*ECONOMY_COST_SCALE);u[2]=Number((u[2]*ECONOMY_GAIN_SCALE).toFixed(3));}
const names={hand:'Handcraft',machine:'Machinery',magnet:'Magnetics',bag:'Bags & Hauling',automation:'Automation',alchemy:'Fortune Tech'};
const perks={hand:'Rhythm builds a combo while you collect. Ultimate: Golden Rhythm — 2.5× active collection for 10 seconds.',machine:'Heavy tools increase your collection reach. Ultimate: Groundbreaker — a powerful instant excavation burst.',magnet:'Magnetic tiers pull coins in automatically near the mountain. Ultimate: Singularity — supercharges collection and passive pull.',bag:'Carry systems boost manual collection and travel efficiency. Ultimate: Overstuffed Satchel — 2.2× active collection for 12 seconds.',automation:'Drones mine while you explore and work with every path. Ultimate: Drone Overdrive — 5× drone income for 15 seconds.',alchemy:'Fortune technology improves your coin flow. Ultimate: Fortune Flip — a burst of bonus coins with a wallet kicker.'};
const abilityInfo={hand:{title:'Golden Rhythm',cooldown:35,desc:'2.5× active collection · 10s'},machine:{title:'Groundbreaker',cooldown:42,desc:'Instant excavation burst'},magnet:{title:'Singularity',cooldown:48,desc:'4× collection and magnet pull · 12s'},bag:{title:'Overstuffed Satchel',cooldown:40,desc:'2.2× active collection · 12s'},automation:{title:'Drone Overdrive',cooldown:52,desc:'5× drone income · 15s'},alchemy:{title:'Fortune Flip',cooldown:55,desc:'Coin burst + wallet bonus'}};
const pathKeys=['hand','machine','magnet','bag','automation','alchemy'];
const biomes=[{name:'Emerald Meadow',grass:0x5c9c59,hill:[0x6d9c70,0x8eae82],leaf:0x3f8a4a,sky:0x87b9d8},{name:'Autumn Ridge',grass:0x9a8a45,hill:[0xa56b3a,0xc08a4a],leaf:0xd06a22,sky:0xb8c4d8},{name:'Frostfield',grass:0xcfe3ee,hill:[0xaec6d8,0xd8e6f0],leaf:0x6aa58f,sky:0xa8cde8},{name:'Crimson Dunes',grass:0xc7925a,hill:[0xb5683e,0xd08a58],leaf:0x8a7a3a,sky:0xe0a98a}];
const MILESTONES=[100,500,1500,5000,...[.01,.05,.1,.25,.5,.75,.9,.99].map(p=>Math.floor(TOTAL*p))];
let daySky,nightCol,duskCol,tmpC;

const menuVisible=()=>!$('menu').classList.contains('hidden');
const isPlaying=()=>!menuVisible()&&!shopOpen&&!settingsOpen&&!won;
const ascMult=()=>1+ascensions*.25;
const computeRate=()=>{let r=1;for(const k of Object.keys(upgrades))for(let i=0;i<upgradeLevel[k];i++)r+=upgrades[k][i][2];return r};
const comboMax=()=>path==='hand'?4:8;
const comboFrac=()=>clamp(comboT/comboMax(),0,1);
const comboMult=()=>1+comboFrac()*(path==='hand'?1.2:.5);
const effRate=()=>rate*ascMult()*comboMult()*(abilityBuffs.hand>0?2.5:1)*(abilityBuffs.bag>0?2.2:1)*(abilityBuffs.magnet>0?4:1);
const droneCost=()=>Math.floor(120*Math.pow(1.2,droneCount));
const collectRange=()=>path==='machine'?30:upgradeLevel.machine>0?25:21;
const fmtInt=n=>Math.floor(n).toLocaleString();
const fmtRate=n=>Number(n.toFixed(1)).toLocaleString();
// Eye height above the ground: grass, a sloped dirt rim (radius 19 -> 17) and the raised base platform.
function floorAt(x,z){const r=Math.hypot(x,z);return (r<=17?BASE_TOP:r>=19?0:19-r)+EYE}

// ---------- texture helpers ----------
function noiseTexture(base,dots,repeat){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,256,256);
 for(let i=0;i<dots;i++){const v=Math.random()<.5?Math.floor(170+Math.random()*50):Math.floor(235+Math.random()*20);g.fillStyle=`rgba(${v},${v},${v},${.2+Math.random()*.35})`;const w=1+Math.random()*3;g.fillRect(Math.random()*256,Math.random()*256,w,w*(1+Math.random()*3))}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const mat=(color,rough=.8,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
function boxMesh(w,h,d,color,rough=.7,metal=.1){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,rough,metal));m.castShadow=true;m.receiveShadow=true;return m}
function facingCenter(g,x,z){g.position.set(x,BASE_TOP,z);g.rotation.y=Math.atan2(z,-x)}

// ---------- world building ----------
function buildGround(){
 grassMat=new THREE.MeshStandardMaterial({color:biomes[0].grass,map:noiseTexture('#9cae8c',9000,28),roughness:.98});
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(420,420),grassMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const rockTexture=noiseTexture('#a5aaa1',6200,4.5);const dirt=new THREE.MeshStandardMaterial({color:0x515d59,map:rockTexture,bumpMap:rockTexture,bumpScale:.18,roughness:.98,metalness:.02});
 const base=new THREE.Mesh(new THREE.CylinderGeometry(17,19,BASE_TOP,64),dirt);base.position.set(0,BASE_TOP/2,0);base.castShadow=true;base.receiveShadow=true;scene.add(base);
 const pathTexture=noiseTexture('#a0a49b',4200,2);const pathMat=new THREE.MeshStandardMaterial({color:0x66706c,map:pathTexture,bumpMap:pathTexture,bumpScale:.08,roughness:.98,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const trail=new THREE.Mesh(new THREE.PlaneGeometry(5,26),pathMat);trail.rotation.x=-Math.PI/2;trail.position.set(0,.025,31);trail.receiveShadow=true;scene.add(trail);
 // Surveyor's inlaid brass rings frame the excavation site and anchor the composition.
 const inlayMat=new THREE.MeshStandardMaterial({color:0x9a7133,roughness:.42,metalness:.72,emissive:0x241504,emissiveIntensity:.12});
 for(const [r,tube] of [[20,.055],[22.2,.035],[24.1,.025]]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,tube,6,160),inlayMat);ring.rotation.x=Math.PI/2;ring.position.y=.035;ring.receiveShadow=true;scene.add(ring)}
 const radialMat=new THREE.MeshStandardMaterial({color:0x66796a,roughness:.9,metalness:.08});
 for(let i=0;i<48;i++){const a=i*Math.PI/24;const tick=new THREE.Mesh(new THREE.BoxGeometry(i%4===0?.55:.22,.035,.07),i%4===0?inlayMat:radialMat);tick.position.set(Math.cos(a)*23.1,.045,Math.sin(a)*23.1);tick.rotation.y=-a;scene.add(tick)}
}
function buildPile(){
 coinGroup=new THREE.Group();coinGroup.position.y=BASE_TOP;scene.add(coinGroup);
 coreMat=new THREE.MeshStandardMaterial({color:0xc98f14,roughness:.4,metalness:.5});
 core=new THREE.Mesh(new THREE.BufferGeometry(),coreMat);core.castShadow=true;core.receiveShadow=true;coinGroup.add(core);
 const coinGeo=new THREE.CylinderGeometry(.235,.235,.09,24,1);
 // Fine milled rims and raised mint marks give the pile a deliberate collectible silhouette.
 const coinRimGeo=new THREE.TorusGeometry(.164,.012,5,20);
 const coinRimMat=new THREE.MeshStandardMaterial({color:0xffef9b,roughness:.24,metalness:.88,emissive:0x6e4200,emissiveIntensity:.08});
 coinRims=new THREE.InstancedMesh(coinRimGeo,coinRimMat,COIN_COUNT);coinRims.count=0;coinRims.castShadow=false;coinRims.receiveShadow=false;coinRims.frustumCulled=false;
 const coinMarkGeo=new THREE.CylinderGeometry(.045,.045,.012,12);
 const coinMarkMat=new THREE.MeshStandardMaterial({color:0xffe58b,roughness:.25,metalness:.8});
 coinMarks=new THREE.InstancedMesh(coinMarkGeo,coinMarkMat,COIN_COUNT);coinMarks.count=0;coinMarks.frustumCulled=false;
 coinMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.34,metalness:.42,emissive:0xffa000,emissiveIntensity:.16});
 inst=new THREE.InstancedMesh(coinGeo,coinMat,COIN_COUNT);inst.castShadow=false;inst.receiveShadow=false;inst.frustumCulled=false;
 const palette=[0xffd447,0xffc928,0xe9a91b,0xffe27b].map(c=>new THREE.Color(c));
 const list=[];
 for(let i=0;i<COIN_COUNT;i++){
  const layer=Math.floor(Math.random()*24),maxR=PILE_RADIUS-layer*.49,rad=Math.sqrt(Math.random())*maxR,ang=Math.random()*Math.PI*2;
  const y=.15+layer*.085+(1-rad/PILE_RADIUS)*Math.max(0,8-layer*.19)+Math.random()*.035;
  list.push({x:Math.cos(ang)*rad,y,z:Math.sin(ang)*rad,rx:(Math.random()-.5)*.18,ry:Math.random()*Math.PI,rz:(Math.random()-.5)*.18,s:.75+Math.random()*.5,c:Math.floor(Math.random()*4)});
 }
 list.sort((a,b)=>a.y-b.y);coinYs=list.map(o=>o.y);pileYMax=coinYs[COIN_COUNT-1];
 const temp=new THREE.Object3D();
 list.forEach((o,i)=>{temp.position.set(o.x,o.y,o.z);temp.rotation.set(o.rx,o.ry,o.rz);temp.scale.set(o.s,1,o.s);temp.updateMatrix();inst.setMatrixAt(i,temp.matrix);inst.setColorAt(i,palette[o.c]);
  // Fine concentric milling and a raised center stamp on every coin; low-overhead instancing.
  const d=new THREE.Object3D();d.position.set(o.x,o.y+.047*o.s,o.z);d.rotation.set(-Math.PI/2, o.ry, 0);d.scale.setScalar(o.s);d.updateMatrix();coinRims.setMatrixAt(i,d.matrix);
  d.position.set(o.x,o.y+.052*o.s,o.z);d.rotation.set(0,o.ry,0);d.scale.set(o.s,1,o.s);d.updateMatrix();coinMarks.setMatrixAt(i,d.matrix);
 });
 inst.instanceMatrix.needsUpdate=true;if(inst.instanceColor)inst.instanceColor.needsUpdate=true;coinRims.count=COIN_COUNT;coinMarks.count=COIN_COUNT;coinRims.instanceMatrix.needsUpdate=true;coinMarks.instanceMatrix.needsUpdate=true;coinGroup.add(inst,coinRims,coinMarks);
 for(let i=0;i<180;i++){const a=Math.random()*Math.PI*2,r=19.6+Math.random()*4;const c=new THREE.Mesh(coinGeo,mat(Math.random()>.5?0xffc928:0xffe58b,.3,.5));c.position.set(Math.cos(a)*r,.06,Math.sin(a)*r);c.rotation.set((Math.random()-.5)*.1,Math.random()*Math.PI,0);c.scale.set(.8,.8,.8);c.castShadow=true;scene.add(c)}
 updatePileShape(true);
}
// The mountain really erodes: coins are sorted by height, so the highest ones disappear first.
function updatePileShape(force){
 const frac=1-collected/TOTAL,step=Math.round(frac*400);
 if(!force&&step===lastPileStep)return;lastPileStep=step;
 const h=pileYMax*frac;let lo=0,hi=COIN_COUNT;while(lo<hi){const mid=(lo+hi)>>1;if(coinYs[mid]<=h)lo=mid+1;else hi=mid}
 inst.count=lo;coinRims.count=lo;coinMarks.count=lo;pileH=h;
 const hc=h>.25?Math.min(CORE_H,h-.15):0;core.visible=hc>.05;
 if(hc>.05){core.geometry.dispose();core.geometry=new THREE.CylinderGeometry(CORE_R*(1-hc/CORE_H),CORE_R,hc,48);core.position.y=hc/2}
}
function surfaceY(r){return BASE_TOP+Math.min(pileH,CORE_H*(1-r/CORE_R))}
function buildScenery(){
 const woodM=mat(0x755033);
 for(let i=0;i<24;i++){
  if(i===6)continue;const a=i/24*Math.PI*2;const post=new THREE.Mesh(new THREE.BoxGeometry(.22,1.5,.22),woodM);post.position.set(Math.cos(a)*24,.75,Math.sin(a)*24);post.castShadow=true;scene.add(post);
  if(i!==5){const a2=(i+.5)/24*Math.PI*2;for(const y of [.55,1.05]){const rail=new THREE.Mesh(new THREE.BoxGeometry(6.2,.11,.09),woodM);rail.position.set(Math.cos(a2)*23.85,y,Math.sin(a2)*23.85);rail.rotation.y=-(a2+Math.PI/2);scene.add(rail)}}
 }
 hillMats=[mat(biomes[0].hill[0],.95),mat(biomes[0].hill[1],.95)];
 // The cinematic faceted alpine ridgelines are generated in buildVisualOverhaul(); avoid stacking the old cone-shaped hills in front of them.
 leafMat=mat(biomes[0].leaf,.9);
 const trunkM=mat(0x5b3d26),rockM=mat(0x70757d,.95);
 const treeN=16+110,trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.38,2.35,8),trunkM,treeN),f1=new THREE.InstancedMesh(new THREE.ConeGeometry(2.05,3.35,9,2),leafMat,treeN),f2=new THREE.InstancedMesh(new THREE.ConeGeometry(1.62,2.75,9,2),mat(biomes[0].leaf,.94),treeN),f3=new THREE.InstancedMesh(new THREE.ConeGeometry(1.08,2.1,9,2),mat(0x6ba76b,.92),treeN);
 [trunk,f1,f2,f3].forEach(m=>{m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;scene.add(m)});
 const t=new THREE.Object3D();let ti=0;
 const addTree=(x,z,s,solid)=>{const ry=Math.random()*6;t.rotation.set(0,ry,0);t.scale.setScalar(s);t.position.set(x,1.1*s,z);t.updateMatrix();trunk.setMatrixAt(ti,t.matrix);t.position.set(x,3.7*s,z);t.updateMatrix();f1.setMatrixAt(ti,t.matrix);t.position.set(x,4.95*s,z);t.updateMatrix();f2.setMatrixAt(ti,t.matrix);t.position.set(x,6.0*s,z);t.updateMatrix();f3.setMatrixAt(ti,t.matrix);ti++;if(solid)obstacles.push({x,z,r:.5*s+.1,on:true})};
 const spot=(rMin,rMax)=>{for(let k=0;k<30;k++){const a=Math.random()*Math.PI*2,r=rMin+Math.random()*(rMax-rMin),x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x,z-25)>6&&Math.hypot(x+4.2,z-21)>3&&Math.abs(x)>3.2||z<0)return[x,z]}return[30,-5]};
 for(let i=0;i<16;i++){const [x,z]=spot(27.5,35);addTree(x,z,.9+Math.random()*.7,true)}
 for(let i=0;i<110;i++){const a=Math.random()*Math.PI*2,r=41+Math.random()*55;addTree(Math.cos(a)*r,Math.sin(a)*r,.9+Math.random()*1.3,false)}
 [trunk,f1,f2,f3].forEach(m=>{m.count=ti;m.instanceMatrix.needsUpdate=true});
 const rockN=40,rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),rockM,rockN);rocks.castShadow=true;rocks.receiveShadow=true;rocks.frustumCulled=false;scene.add(rocks);
 for(let i=0;i<rockN;i++){const solid=i<12;const [x,z]=solid?spot(26,36):(()=>{const a=Math.random()*6.28,r=40+Math.random()*50;return[Math.cos(a)*r,Math.sin(a)*r]})();const s=.5+Math.random()*1.1;t.position.set(x,s*.45,z);t.rotation.set(Math.random(),Math.random()*6,Math.random());t.scale.set(s*(1+Math.random()*.5),s*.75,s);t.updateMatrix();rocks.setMatrixAt(i,t.matrix);if(solid)obstacles.push({x,z,r:s*.9,on:true})}
 const fN=170,flowers=new THREE.InstancedMesh(new THREE.SphereGeometry(.12,6,5),mat(0xffffff,.8),fN);flowers.frustumCulled=false;scene.add(flowers);
 const fc=[0xff6b8b,0xffd166,0xffffff,0xb388ff,0xff9f43].map(c=>new THREE.Color(c));
 for(let i=0;i<fN;i++){const a=Math.random()*6.28,r=21+Math.random()*16;t.position.set(Math.cos(a)*r,.14,Math.sin(a)*r);t.rotation.set(0,0,0);t.scale.setScalar(.7+Math.random()*.8);t.updateMatrix();flowers.setMatrixAt(i,t.matrix);flowers.setColorAt(i,fc[i%fc.length])}
 // Signpost at the spawn trail.
 const sc=document.createElement('canvas');sc.width=512;sc.height=256;const g=sc.getContext('2d');g.fillStyle='#7a5435';g.fillRect(0,0,512,256);g.strokeStyle='#4a3220';g.lineWidth=14;g.strokeRect(7,7,498,242);g.fillStyle='#ffe08a';g.textAlign='center';g.font='bold 58px system-ui,sans-serif';g.fillText('COIN MOUNTAIN',256,110);g.font='32px system-ui,sans-serif';g.fillStyle='#fff';g.fillText(`${fmtInt(TOTAL)} coins ahead  ▲`,256,170);
 const stex=new THREE.CanvasTexture(sc);stex.colorSpace=THREE.SRGBColorSpace;
 const board=new THREE.Mesh(new THREE.PlaneGeometry(2.45,1.22),new THREE.MeshStandardMaterial({map:stex,roughness:.9}));board.position.set(-8.1,1.65,17.4);board.castShadow=true;scene.add(board);
 const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,2.35,8),woodM);post.position.set(-8.1,1.17,17.4);post.castShadow=true;scene.add(post);obstacles.push({x:-8.1,z:17.4,r:.25,on:true});
}

// ---------- expanded world-art pass: landmarks, ground detail, mineral formations ----------
function buildVisualOverhaul(){
 // Layered stone shelves make the excavation feel carved into a real landscape.
 const slate=new THREE.MeshStandardMaterial({color:0x37474b,roughness:.92,metalness:.08});
 const slateLit=new THREE.MeshStandardMaterial({color:0x536365,roughness:.88,metalness:.06});
 const brass=new THREE.MeshStandardMaterial({color:0xe1b85c,roughness:.32,metalness:.78,emissive:0x4a2b08,emissiveIntensity:.16});
 const glow=new THREE.MeshStandardMaterial({color:0x74e8df,roughness:.25,metalness:.28,emissive:0x1fc8bd,emissiveIntensity:1.35});
 const crystalMats=[
  new THREE.MeshStandardMaterial({color:0x49c9c0,roughness:.2,metalness:.18,emissive:0x0a665f,emissiveIntensity:.7}),
  new THREE.MeshStandardMaterial({color:0x8d7bff,roughness:.22,metalness:.15,emissive:0x3522a1,emissiveIntensity:.8}),
  new THREE.MeshStandardMaterial({color:0xffcb62,roughness:.24,metalness:.48,emissive:0x7b4100,emissiveIntensity:.55})
 ];
 // Thousands of instanced grass blades break up the flat ground without hundreds of draw calls.
 const bladeGeo=new THREE.ConeGeometry(.095,.55,4,1);
 const bladeMat=new THREE.MeshStandardMaterial({color:0x8cb77a,roughness:1,vertexColors:true});
 const grass=new THREE.InstancedMesh(bladeGeo,bladeMat,2600);grass.frustumCulled=false;
 const dummy=new THREE.Object3D(),grassColors=[0x9fc27d,0x6f9c68,0xc1c77d,0x638e65].map(c=>new THREE.Color(c));
 let gi=0;
 for(let i=0;i<2600;i++){
  const a=Math.random()*Math.PI*2,r=20.5+Math.random()*90;
  const x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(Math.hypot(x,z)<20.3)continue;
  dummy.position.set(x,.24,z);dummy.rotation.set((Math.random()-.5)*.2,Math.random()*Math.PI,(Math.random()-.5)*.2);
  const sc=.45+Math.random()*1.15;dummy.scale.set(sc,sc,sc);dummy.updateMatrix();grass.setMatrixAt(gi,dummy.matrix);grass.setColorAt(gi,grassColors[Math.floor(Math.random()*grassColors.length)]);gi++;
 }
 grass.count=gi;grass.instanceMatrix.needsUpdate=true;scene.add(grass);
 // Angular ore outcrops with bright crystal shards form a readable ring around the coin mountain.
 const rockGeo=new THREE.IcosahedronGeometry(1,1);
 const outcrops=new THREE.InstancedMesh(rockGeo,slate,92);outcrops.frustumCulled=false;
 for(let i=0;i<92;i++){
  const a=i/92*Math.PI*2+(Math.random()-.5)*.12,r=22.5+Math.random()*14,s=.65+Math.random()*1.7;
  dummy.position.set(Math.cos(a)*r,s*.55,Math.sin(a)*r);dummy.rotation.set(Math.random()*.6,Math.random()*6.28,Math.random()*.45);dummy.scale.set(s*1.35,s*.85,s);dummy.updateMatrix();outcrops.setMatrixAt(i,dummy.matrix);
 }
 outcrops.instanceMatrix.needsUpdate=true;outcrops.castShadow=true;outcrops.receiveShadow=true;scene.add(outcrops);
 for(let i=0;i<38;i++){
  const a=Math.random()*Math.PI*2,r=23+Math.random()*12,x=Math.cos(a)*r,z=Math.sin(a)*r;
  const cluster=new THREE.Group();cluster.position.set(x,.12,z);cluster.rotation.y=Math.random()*6.28;
  const n=2+Math.floor(Math.random()*3);
  for(let j=0;j<n;j++){
   const h=.8+Math.random()*2.1,cr=new THREE.Mesh(new THREE.OctahedronGeometry(.65,0),crystalMats[i%crystalMats.length]);
   cr.scale.set(.55+Math.random()*.5,h,.55+Math.random()*.5);cr.position.set((Math.random()-.5)*1.15,h*.55,(Math.random()-.5)*1.15);cr.rotation.set((Math.random()-.5)*.22,Math.random()*6.28,(Math.random()-.5)*.22);cr.castShadow=true;cluster.add(cr);
  }
  const footing=new THREE.Mesh(new THREE.DodecahedronGeometry(1.1,0),slateLit);footing.scale.set(1.3,.48,1.15);footing.position.y=.38;footing.castShadow=true;cluster.add(footing);scene.add(cluster);
 }
 // Eight tall survey obelisks and warm lamps establish scale and frame the skyline.
 for(let i=0;i<8;i++){
  const a=i/8*Math.PI*2,r=31.5,x=Math.cos(a)*r,z=Math.sin(a)*r;
  const ob=new THREE.Group();ob.position.set(x,0,z);ob.rotation.y=-a;
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.1,.55,8),slate);plinth.position.y=.28;plinth.castShadow=true;ob.add(plinth);
  const shaft=new THREE.Mesh(new THREE.BoxGeometry(.42,3.2,.42),slateLit);shaft.position.y=2;shaft.castShadow=true;ob.add(shaft);
  const band=new THREE.Mesh(new THREE.TorusGeometry(.38,.065,8,24),brass);band.position.y=2.5;ob.add(band);
  const lamp=new THREE.Mesh(new THREE.OctahedronGeometry(.38,1),glow);lamp.position.y=3.85;ob.add(lamp);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.42,.7,4),brass);cap.position.y=4.35;ob.add(cap);
  scene.add(ob);
  const light=new THREE.PointLight(0x65dcd0,.8,11,2);light.position.set(x,3.8,z);scene.add(light);
 }
 // A monumental mining arch at the far end gives the horizon a memorable focal point.
 const gate=new THREE.Group();gate.position.set(0,0,-30);
 const stone=new THREE.MeshStandardMaterial({color:0x34484a,roughness:.8,metalness:.12});
 for(const x of [-5.2,5.2]){
  const pillar=new THREE.Mesh(new THREE.BoxGeometry(1.15,8.5,1.25),stone);pillar.position.set(x,4.25,0);pillar.castShadow=true;pillar.receiveShadow=true;gate.add(pillar);
  const foot=new THREE.Mesh(new THREE.BoxGeometry(2,1,1.8),brass);foot.position.set(x,.5,0);gate.add(foot);
 }
 const lintel=new THREE.Mesh(new THREE.BoxGeometry(12,1.25,1.5),stone);lintel.position.y=8.2;lintel.castShadow=true;gate.add(lintel);
 const crest=new THREE.Mesh(new THREE.TorusGeometry(1.35,.13,10,48),brass);crest.position.set(0,7.2,.85);gate.add(crest);
 const crestCoin=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,.18,32),new THREE.MeshStandardMaterial({color:0xffd45c,roughness:.2,metalness:.9,emissive:0x9b5b00,emissiveIntensity:.35}));crestCoin.rotation.x=Math.PI/2;crestCoin.position.set(0,7.2,.78);gate.add(crestCoin);
 const rune=new THREE.Mesh(new THREE.TorusGeometry(2.15,.035,6,64),glow);rune.position.set(0,7.2,.7);gate.add(rune);scene.add(gate);
 // Broken stone pavers make the approach trail feel intentional and tactile.
 const paverMat=new THREE.MeshStandardMaterial({color:0x626b65,roughness:.95});
 for(let i=0;i<44;i++){
  const z=31-i*1.2,x=Math.sin(i*1.71)*1.8;
  const p=new THREE.Mesh(new THREE.BoxGeometry(1.35+Math.random()*.6,.12,.7+Math.random()*.35),paverMat);
  p.position.set(x,.07,z);p.rotation.y=(Math.random()-.5)*.28;p.rotation.x=(Math.random()-.5)*.035;p.receiveShadow=true;scene.add(p);
 }
 // Fine drifting points catch the light and add depth in the foreground.
 const moteN=520,positions=new Float32Array(moteN*3),colors=new Float32Array(moteN*3);
 const cA=new THREE.Color(0xffdc8a),cB=new THREE.Color(0x8ae9dc);
 for(let i=0;i<moteN;i++){
  const a=Math.random()*Math.PI*2,r=8+Math.random()*46;
  positions[i*3]=Math.cos(a)*r;positions[i*3+1]=.6+Math.random()*15;positions[i*3+2]=Math.sin(a)*r;
  const c=Math.random()<.72?cA:cB;colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
 }
 const motesGeo=new THREE.BufferGeometry();motesGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));motesGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const motes=new THREE.Points(motesGeo,new THREE.PointsMaterial({size:.095,vertexColors:true,transparent:true,opacity:.72,depthWrite:false,sizeAttenuation:true}));motes.name='ambientMotes';ambientMotesObj=motes;scene.add(motes);
 // Distinctive luminous inlays reinforce the brass-and-teal art direction at the excavation rim.
 const runeMat=new THREE.MeshStandardMaterial({color:0x64d9cc,roughness:.3,metalness:.55,emissive:0x1b9488,emissiveIntensity:.7});
 for(let i=0;i<32;i++){
  const a=i/32*Math.PI*2,r=21.4;
  const mark=new THREE.Mesh(new THREE.BoxGeometry(.65,.045,.11),i%4===0?brass:runeMat);
  mark.position.set(Math.cos(a)*r,.11,Math.sin(a)*r);mark.rotation.y=-a;scene.add(mark);
 }

 // --- AAA art pass: textured mineral surfaces, layered alpine silhouettes and sun shafts ---
 // A single reusable procedural texture adds readable surface breakup without external assets.
 const weathering=noiseTexture('#777b76',9800,2.4);
 weathering.anisotropy=4;
 slate.map=weathering;slate.bumpMap=weathering;slate.bumpScale=.16;slate.needsUpdate=true;
 slateLit.map=weathering;slateLit.bumpMap=weathering;slateLit.bumpScale=.11;slateLit.needsUpdate=true;
 paverMat.map=noiseTexture('#92958b',6800,1.25);paverMat.bumpMap=paverMat.map;paverMat.bumpScale=.09;paverMat.needsUpdate=true;
 stone.map=weathering;stone.bumpMap=weathering;stone.bumpScale=.13;stone.needsUpdate=true;
 // Three handcrafted, faceted mountain ridgelines create strong atmospheric depth beyond the playable arena.
 const ridgeLayers=[
  {z:-92,base:1,amp:32,colorA:new THREE.Color(0x334e59),colorB:new THREE.Color(0x76919a),seed:1.7},
  {z:-128,base:3,amp:43,colorA:new THREE.Color(0x243d4a),colorB:new THREE.Color(0x536f7b),seed:4.1},
  {z:-166,base:5,amp:53,colorA:new THREE.Color(0x1a303d),colorB:new THREE.Color(0x3b5362),seed:7.3}
 ];
 for(let li=0;li<ridgeLayers.length;li++){
  const layer=ridgeLayers[li],segments=128,verts=[],cols=[],indices=[];
  for(let x=0;x<=segments;x++){
   const u=x/segments,wx=(u-.5)*440;
   const broad=Math.pow(Math.max(0,Math.sin(u*Math.PI)),.55);
   const wave=Math.abs(Math.sin(u*18+layer.seed))*.52+Math.abs(Math.sin(u*39+layer.seed*2))*.3+Math.abs(Math.sin(u*7+layer.seed*.7))*.55;
   const peak=layer.base+broad*layer.amp*(.28+wave);
   verts.push(wx,peak,layer.z+(Math.sin(u*13+layer.seed)*3));
   verts.push(wx,-9,layer.z);
   const shade=.68+.32*(.5+.5*Math.sin(u*23+layer.seed));
   const c=layer.colorA.clone().lerp(layer.colorB,shade);
   cols.push(c.r,c.g,c.b,c.r*.62,c.g*.7,c.b*.76);
   if(x<segments){const a=x*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));geo.setIndex(indices);geo.computeVertexNormals();
  const ridge=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:0,flatShading:true,side:THREE.DoubleSide,fog:true}));
  ridge.name='distantAlpineRidge';ridge.frustumCulled=false;scene.add(ridge);
 }
 // A broken outer escarpment gives the arena a less circular, more geological silhouette.
 const cliffGeo=new THREE.IcosahedronGeometry(1,1),cliffMat=new THREE.MeshStandardMaterial({color:0x40555a,map:weathering,bumpMap:weathering,bumpScale:.2,roughness:.98,flatShading:true});
 const escarpment=new THREE.InstancedMesh(cliffGeo,cliffMat,156);escarpment.frustumCulled=false;
 for(let i=0;i<156;i++){
  const a=i/156*Math.PI*2+(Math.random()-.5)*.08,r=43+Math.random()*17;
  const sx=1.4+Math.random()*4.8,sy=2+Math.random()*8.5,sz=1.5+Math.random()*5.5;
  dummy.position.set(Math.cos(a)*r,sy*.34-1.2,Math.sin(a)*r-7);
  dummy.rotation.set((Math.random()-.5)*.4,Math.random()*Math.PI*2,(Math.random()-.5)*.32);
  dummy.scale.set(sx,sy,sz);dummy.updateMatrix();escarpment.setMatrixAt(i,dummy.matrix);
 }
 escarpment.instanceMatrix.needsUpdate=true;escarpment.castShadow=true;escarpment.receiveShadow=true;scene.add(escarpment);
 // Mineral seams catch the sun across the exposed rock: thin fractured ribbons, not flat decals.
 const seamMat=new THREE.MeshStandardMaterial({color:0x7de2d4,roughness:.3,metalness:.48,emissive:0x187c75,emissiveIntensity:.5});
 for(let i=0;i<18;i++){
  const a=i/18*Math.PI*2,r=24.5+(i%4)*.55;
  const seam=new THREE.Mesh(new THREE.TorusGeometry(.55+(i%3)*.18,.025,5,18,Math.PI*.8),i%3===0?brass:seamMat);
  seam.position.set(Math.cos(a)*r,.32+(i%3)*.12,Math.sin(a)*r);seam.rotation.set(Math.PI/2+(Math.random()-.5)*.2,a,0);seam.scale.set(1.5,.7,1);scene.add(seam);
 }
 // Subtle volumetric-looking shafts frame the ancient gate and add cinematic depth without post-processing.
 const shaftMat=new THREE.MeshBasicMaterial({color:0xffdca0,transparent:true,opacity:.055,depthWrite:false,side:THREE.DoubleSide});
 for(let i=0;i<5;i++){
  const shaft=new THREE.Mesh(new THREE.ConeGeometry(2.1+i*.24,25,7,1,true),shaftMat);
  shaft.position.set(-8+i*4.1,14,-38-i*.7);shaft.rotation.z=Math.PI;shaft.rotation.x=(i-2)*.045;shaft.renderOrder=1;scene.add(shaft);
 }
 // Layered halo rings make the distant gate read as a deliberate destination at a glance.
 const haloMat=new THREE.MeshBasicMaterial({color:0xffd36a,transparent:true,opacity:.22,depthWrite:false});
 for(let i=0;i<3;i++){
  const halo=new THREE.Mesh(new THREE.TorusGeometry(2.5+i*.42,.035,6,72),haloMat);
  halo.position.set(0,7.2,-29.1-i*.08);halo.rotation.y=i*.08;gate.add(halo);
 }

}

function buildSkyObjects(){
 const n=700,arr=new Float32Array(n*3);for(let i=0;i<n;i++){const u=Math.random()*Math.PI*2,v=Math.random()*.95+.05,r=250;arr[i*3]=Math.cos(u)*Math.sqrt(1-v*v)*r;arr[i*3+1]=v*r;arr[i*3+2]=Math.sin(u)*Math.sqrt(1-v*v)*r}
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
 starsMat=new THREE.PointsMaterial({color:0xffffff,size:1.8,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false});stars=new THREE.Points(sg,starsMat);stars.frustumCulled=false;scene.add(stars);
 sunMesh=new THREE.Mesh(new THREE.SphereGeometry(9,16,12),new THREE.MeshBasicMaterial({color:0xfff3c4,fog:false}));sunMesh.frustumCulled=false;scene.add(sunMesh);
 moonMesh=new THREE.Mesh(new THREE.SphereGeometry(5.5,16,12),new THREE.MeshBasicMaterial({color:0xdfe8ff,fog:false}));moonMesh.frustumCulled=false;scene.add(moonMesh);
 cloudMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,fog:false,depthWrite:false});
 const puff=new THREE.SphereGeometry(1,10,8);
 for(let i=0;i<16;i++){const g=new THREE.Group();const k=4+Math.floor(Math.random()*3);for(let j=0;j<k;j++){const m=new THREE.Mesh(puff,cloudMat);m.position.set((j-k/2)*6+Math.random()*3,Math.random()*2,Math.random()*4);m.scale.set(7+Math.random()*5,3+Math.random()*2,5+Math.random()*3);g.add(m)}
  const a=Math.random()*Math.PI*2,r=70+Math.random()*100;g.position.set(Math.cos(a)*r,52+Math.random()*25,Math.sin(a)*r);g.userData.speed=.6+Math.random()*1.2;scene.add(g);clouds.push(g)}
}
function buildProps(){
 const yellow=0xd9a83f;
 const enamel=0x164b58,steel=0x778a91;
 const boltMat=new THREE.MeshStandardMaterial({color:0xd6c18c,roughness:.28,metalness:.82});
 props.table=new THREE.Group();const top=boxMesh(2.4,.12,1.2,0x8a5d36);top.position.y=.95;props.table.add(top);
 for(const [x,z] of [[-1,-.45],[1,-.45],[-1,.45],[1,.45]]){const l=boxMesh(.1,.95,.1,0x5b3d26);l.position.set(x,.47,z);props.table.add(l)}
 props.stacks=[];for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.35+i*.12,14),mat(0xffc928,.3,.6));s.position.set(-.7+i*.7,1.14+i*.06,0);s.castShadow=true;props.table.add(s);props.stacks.push(s)}
 facingCenter(props.table,-11.5,11.8);scene.add(props.table);
 // Front loader
 props.loader=new THREE.Group();const lb=boxMesh(2.6,.9,1.6,yellow);lb.position.y=.95;props.loader.add(lb);const cab=boxMesh(1,.9,1.3,enamel,.34,.42);cab.position.set(-.55,1.8,0);props.loader.add(cab);
 for(const [x,z] of [[-.9,-.85],[.9,-.85],[-.9,.85],[.9,.85]]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.35,14),mat(0x111111,.9));w.rotation.x=Math.PI/2;w.position.set(x,.5,z);w.castShadow=true;props.loader.add(w)}
 props.loaderArm=new THREE.Group();props.loaderArm.position.set(1.3,1.1,0);const arm=boxMesh(1.9,.2,1.1,yellow);arm.position.x=.9;props.loaderArm.add(arm);const bucket=boxMesh(.6,.55,1.7,0x555b63);bucket.position.set(1.9,-.1,0);props.loaderArm.add(bucket);props.loader.add(props.loaderArm);
 facingCenter(props.loader,12.5,-10.5);scene.add(props.loader);
 // Excavator
 props.exc=new THREE.Group();for(const z of [-1,1]){const tr=boxMesh(3.2,.55,.75,0x2a2d31);tr.position.set(0,.3,z);props.exc.add(tr)}
 props.turret=new THREE.Group();props.turret.position.y=.75;const eb=boxMesh(2,.8,1.7,yellow,.42,.38);eb.position.y=.4;props.turret.add(eb);const ec=boxMesh(.9,.8,.9,enamel,.34,.42);ec.position.set(-.45,1.1,.4);props.turret.add(ec);
 props.boom=new THREE.Group();props.boom.position.set(.9,.7,0);const b1=boxMesh(2.8,.3,.35,yellow);b1.position.set(1.3,.6,0);b1.rotation.z=.35;props.boom.add(b1);const b2=boxMesh(1.7,.25,.3,yellow);b2.position.set(3.1,1.05,0);b2.rotation.z=-.9;props.boom.add(b2);const bk=boxMesh(.55,.55,1,0x555b63);bk.position.set(3.6,.35,0);props.boom.add(bk);props.turret.add(props.boom);props.exc.add(props.turret);
 facingCenter(props.exc,-12,-11.5);scene.add(props.exc);
 // Conveyor with moving coins
 props.conv=new THREE.Group();props.conv.position.y=BASE_TOP;const belt=boxMesh(9.6,.25,1.2,0x2b3038);belt.position.set(16.5,.55,0);props.conv.add(belt);
 for(const z of [-.55,.55]){const l=boxMesh(.18,2.55,.18,0x444b55);l.position.set(20.6,-.7,z);props.conv.add(l)}
 props.convCoins=[];const cg=new THREE.CylinderGeometry(.22,.22,.08,12);for(let i=0;i<12;i++){const c=new THREE.Mesh(cg,mat(0xffc928,.3,.6));c.position.set(12,.78,(i%3-1)*.3);props.conv.add(c);props.convCoins.push(c)}
 scene.add(props.conv);
 // Magnet rings and the singularity
 props.magnet=new THREE.Group();props.rings=[];for(let i=0;i<5;i++){const r=new THREE.Mesh(new THREE.TorusGeometry(2.4+i*.55,.09,8,40),new THREE.MeshStandardMaterial({color:0x66e0ff,emissive:0x2aa8ff,emissiveIntensity:1.4,roughness:.3,metalness:.6}));props.magnet.add(r);props.rings.push(r)}
 props.sing=new THREE.Group();const core2=new THREE.Mesh(new THREE.SphereGeometry(.9,18,14),new THREE.MeshStandardMaterial({color:0x080414,emissive:0x7a2cff,emissiveIntensity:1.6,roughness:.4}));props.sing.add(core2);const halo=new THREE.Mesh(new THREE.TorusGeometry(1.5,.07,8,36),new THREE.MeshBasicMaterial({color:0xc79bff}));halo.rotation.x=Math.PI/2;props.sing.add(halo);props.magnet.add(props.sing);props.magnet.position.y=BASE_TOP;scene.add(props.magnet);
 droneGroup=new THREE.Group();scene.add(droneGroup);
 props.obsTable={x:-11.5,z:11.8,r:1.4,on:false};props.obsLoader={x:12.5,z:-10.5,r:1.9,on:false};props.obsExc={x:-12,z:-11.5,r:2.3,on:false};obstacles.push(props.obsTable,props.obsLoader,props.obsExc);
}
function refreshProps(){
 const h=upgradeLevel.hand,m=upgradeLevel.machine,g=upgradeLevel.magnet;
 props.table.visible=h>=3;props.stacks.forEach((s,i)=>s.visible=h>=3+i);props.obsTable.on=h>=3;
 props.conv.visible=m>=3;props.loader.visible=m>=4;props.obsLoader.on=m>=4;props.exc.visible=m>=5;props.obsExc.on=m>=5;
 props.magnet.visible=g>=1;props.rings.forEach((r,i)=>r.visible=g>i);props.sing.visible=g>=5;
}
function makeDrone(i){
 const grp=new THREE.Group();const body=new THREE.Mesh(new THREE.SphereGeometry(.28,12,8),mat(0x34495e,.4,.6));body.castShadow=true;grp.add(body);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.36,.04,6,16),mat(0xffc928,.3,.7));ring.rotation.x=Math.PI/2;grp.add(ring);
 const led=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshBasicMaterial({color:0x66ffcc}));led.position.y=-.22;grp.add(led);
 const rotor=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.015,14),new THREE.MeshBasicMaterial({color:0xcfe8ff,transparent:true,opacity:.35}));rotor.position.y=.26;grp.add(rotor);
 droneGroup.add(grp);return {grp,phase:Math.random()*6.28,i,rotor};
}
function syncDrones(){while(drones.length<droneCount)drones.push(makeDrone(drones.length));while(drones.length>droneCount){const d=drones.pop();droneGroup.remove(d.grp)}}
function buildRigs(){
 handGroup=new THREE.Group();handGroup.scale.setScalar(.55);camera.add(handGroup);scene.add(camera);
 const skin=mat(0xd9a477),sleeveM=mat(0x294d70);
 const lS=new THREE.Mesh(new THREE.BoxGeometry(.28,.42,.32),sleeveM);lS.position.set(-.38,-.4,-.65);handGroup.add(lS);const lH=new THREE.Mesh(new THREE.SphereGeometry(.14,16,12),skin);lH.position.set(-.38,-.27,-.78);handGroup.add(lH);
 const rS=new THREE.Mesh(new THREE.BoxGeometry(.28,.42,.32),sleeveM);rS.position.set(.38,-.4,-.65);handGroup.add(rS);
 toolMount=new THREE.Group();toolMount.position.set(.38,-.27,-.78);handGroup.add(toolMount);
 rigs.bare=new THREE.Mesh(new THREE.SphereGeometry(.14,16,12),skin);
 rigs.hand=new THREE.Group();rigs.handGlove=new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),mat(0x8a5a2b,.7));const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.1,12),mat(0x333333));cuff.position.set(0,-.12,.06);cuff.rotation.x=.9;rigs.hand.add(rigs.handGlove,cuff);
 rigs.machine=new THREE.Group();const hnd=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.55,8),mat(0x6a4a2a));hnd.rotation.x=1.2;hnd.position.set(0,-.02,.05);rigs.machine.add(hnd);rigs.scoop=new THREE.Mesh(new THREE.BoxGeometry(.3,.05,.28),mat(0xaab3bd,.35,.7));rigs.scoop.position.set(0,.1,-.25);rigs.scoop.rotation.x=-.4;rigs.machine.add(rigs.scoop);
 rigs.magnet=new THREE.Group();rigs.horseshoe=new THREE.Mesh(new THREE.TorusGeometry(.12,.04,8,18,Math.PI),new THREE.MeshStandardMaterial({color:0xd93636,roughness:.4,metalness:.5,emissive:0x2aa8ff,emissiveIntensity:0}));rigs.horseshoe.rotation.set(-1.2,0,Math.PI);rigs.magnet.add(rigs.horseshoe);
 for(const k of ['bare','hand','machine','magnet'])toolMount.add(rigs[k]);
 updateToolVisuals();
}
function updateToolVisuals(){
 const visualPath={hand:'hand',machine:'machine',magnet:'magnet',bag:'hand',automation:'machine',alchemy:'magnet'};
 const visual=path?visualPath[path]:null;
 for(const k of ['bare','hand','machine','magnet'])rigs[k].visible=(k==='bare'&&!visual)||k===visual;
 const tier=path?upgradeLevel[path]:0;
 rigs.handGlove.material.color.setHex([0x8a5a2b,0x8a5a2b,0xaaaaaa,0x3aa0ff,0xffd24d,0xff5fd2][tier]);
 rigs.scoop.material.color.setHex([0xaab3bd,0xaab3bd,0xc9a24a,0xe8b21a,0xffd24d,0xff9f1a][tier]);rigs.machine.scale.setScalar(1+tier*.08);
 rigs.horseshoe.material.emissiveIntensity=tier*.35;rigs.magnet.scale.setScalar(1+tier*.08);
}
function buildParticles(){
 const N=120;particles={N,t:new Float32Array(N).fill(1),dur:new Float32Array(N).fill(1),sx:new Float32Array(N),sy:new Float32Array(N),sz:new Float32Array(N),type:new Uint8Array(N),idx:new Int16Array(N),arc:new Float32Array(N),ptr:0};
 particles.mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.16,.06,10),new THREE.MeshStandardMaterial({color:0xffd447,emissive:0xffa000,emissiveIntensity:.7,roughness:.3,metalness:.5}),N);
 particles.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);particles.mesh.frustumCulled=false;scene.add(particles.mesh);
 const t=new THREE.Object3D();t.scale.setScalar(0);t.updateMatrix();for(let i=0;i<N;i++)particles.mesh.setMatrixAt(i,t.matrix);
}
function spawnParticle(x,y,z,type,idx){const p=particles;const i=p.ptr;p.ptr=(p.ptr+1)%p.N;p.t[i]=0;p.sx[i]=x;p.sy[i]=y;p.sz[i]=z;p.type[i]=type;p.idx[i]=idx||0;p.dur[i]=type===0?.5+Math.random()*.3:.8+Math.random()*.4;p.arc[i]=1+Math.random()*1.5}
function spawnFromPile(type,idx){const ang=Math.atan2(player.z,player.x)+(Math.random()-.5)*1.1,r=6+Math.random()*7;spawnParticle(Math.cos(ang)*r,surfaceY(r)+.1,Math.sin(ang)*r,type,idx)}
const _t=null;let _obj=null;
function updateParticles(dt,tx,ty,tz){
 const p=particles;_obj=_obj||new THREE.Object3D();let any=false;
 for(let i=0;i<p.N;i++){
  if(p.t[i]>=1)continue;any=true;p.t[i]+=dt/p.dur[i];
  if(p.t[i]>=1){_obj.scale.setScalar(0);_obj.updateMatrix();p.mesh.setMatrixAt(i,_obj.matrix);continue}
  const t=p.t[i],e=t*t*(3-2*t);let ex=tx,ey=ty,ez=tz;
  if(p.type[i]===1){const d=drones[p.idx[i]];if(d){ex=d.grp.position.x;ey=d.grp.position.y;ez=d.grp.position.z}}
  _obj.position.set(lerp(p.sx[i],ex,e),lerp(p.sy[i],ey,e)+Math.sin(Math.PI*t)*p.arc[i],lerp(p.sz[i],ez,e));
  _obj.rotation.set(t*11,t*7,0);_obj.scale.setScalar(.8*(1-t*.5));_obj.updateMatrix();p.mesh.setMatrixAt(i,_obj.matrix);
 }
 if(any)p.mesh.instanceMatrix.needsUpdate=true;
}
function spawnGolden(){
 if(goldens.length>=4)return;
 const a=Math.random()*Math.PI*2,r=22+Math.random()*13,x=Math.cos(a)*r,z=Math.sin(a)*r;
 if(Math.hypot(x,z-25)<5)return;
 const g=new THREE.Group();
 const c=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.13,22),new THREE.MeshStandardMaterial({color:0xffd700,emissive:0xffa000,emissiveIntensity:.9,metalness:.8,roughness:.2}));c.rotation.x=Math.PI/2;g.add(c);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.04,8,28),new THREE.MeshBasicMaterial({color:0xfff2a0,transparent:true,opacity:.7}));g.add(ring);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,26,6),new THREE.MeshBasicMaterial({color:0xffe27a,transparent:true,opacity:.28,depthWrite:false}));beam.position.y=13;g.add(beam);
 g.position.set(x,1.5,z);scene.add(g);goldens.push({g,x,z,ph:Math.random()*6.28,life:55});
}
function clearGoldens(){for(const o of goldens)scene.remove(o.g);goldens=[]}
function collectGolden(o){
 const n=Math.max(40,Math.round(rate*ascMult()*12)),got=Math.min(n,TOTAL-collected);if(got>0)addCoins(got);
 for(let i=0;i<22;i++)spawnParticle(o.x+(Math.random()-.5),1.5+Math.random()*2,o.z+(Math.random()-.5),0);
 playChime();showFloat(`GOLDEN +${fmtInt(Math.max(got,0))}`,true);toast('Golden coin!',`+${fmtInt(Math.max(got,0))} coins`);
 scene.remove(o.g);goldens.splice(goldens.indexOf(o),1);
}
function applyBiome(){const b=biomes[ascensions%biomes.length];grassMat.color.setHex(b.grass);hillMats[0].color.setHex(b.hill[0]);hillMats[1].color.setHex(b.hill[1]);leafMat.color.setHex(b.leaf);daySky.setHex(b.sky)}

// ---------- sky / day-night ----------
function updateSky(dt){
 tod=(tod+dt/CYCLE)%1;
 const a=tod*Math.PI*2,sinA=Math.sin(a),cosA=Math.cos(a);
 const dayF=smooth(-.12,.32,sinA);dayFactor=dayF;const dusk=Math.max(0,1-Math.abs(sinA)/.3)*.6;
 tmpC.copy(nightCol).lerp(daySky,dayF).lerp(duskCol,dusk);scene.background.copy(tmpC);scene.fog.color.copy(tmpC);
 sun.position.set(cosA*60,Math.max(sinA*60,3),22);sun.intensity=3.3*dayF;sun.color.setHex(0xffefce).lerp(duskCol,dusk*.7);
 hemi.intensity=.3+1.7*dayF;moon.position.set(-cosA*50,Math.max(-sinA*50,10),-20);moon.intensity=.9*(1-dayF);
 pileLight.intensity=140*(1-dayF);pileLight.position.y=BASE_TOP+pileH+1.5;coinMat.emissiveIntensity=.45*(1-dayF);
 starsMat.opacity=(1-dayF)*(1-dayF);stars.position.copy(camera.position);
 sunMesh.position.set(camera.position.x+cosA*230,camera.position.y+sinA*210,camera.position.z+80);sunMesh.visible=sinA>-.12;
 moonMesh.position.set(camera.position.x-cosA*230,camera.position.y-sinA*210,camera.position.z-60);moonMesh.visible=sinA<.12;
 cloudMat.color.setRGB(lerp(.1,1,dayF),lerp(.12,1,dayF),lerp(.2,1,dayF));
 for(const c of clouds){c.position.x+=c.userData.speed*dt;if(c.position.x>190)c.position.x=-190}
}

// ---------- audio ----------
function ensureAudio(){
 if(audio.ctx){if(audio.ctx.state==='suspended')audio.ctx.resume();return}
 try{
  const ctx=new (window.AudioContext||window.webkitAudioContext)();const master=ctx.createGain(),sfx=ctx.createGain(),amb=ctx.createGain();
  sfx.connect(master);amb.connect(master);master.connect(ctx.destination);
  audio.ctx=ctx;audio.master=master;audio.sfx=sfx;audio.amb=amb;
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  applyVolumes();startAmbience();
 }catch(e){}
}
function applyVolumes(){if(!audio.ctx)return;const t=audio.ctx.currentTime;audio.master.gain.setTargetAtTime(masterVolume,t,.05);audio.sfx.gain.setTargetAtTime(sfxVolume,t,.05);audio.amb.gain.setTargetAtTime(ambVolume*.55,t,.2)}
function startAmbience(){
 try{
  const ctx=audio.ctx;const src=ctx.createBufferSource();src.buffer=noiseBuf;src.loop=true;
  const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=520;bp.Q.value=.6;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1400;
  const wind=ctx.createGain();wind.gain.value=.22;const lfo=ctx.createOscillator();lfo.frequency.value=.09;const lg=ctx.createGain();lg.gain.value=.14;lfo.connect(lg);lg.connect(wind.gain);
  src.connect(bp);bp.connect(lp);lp.connect(wind);wind.connect(audio.amb);src.start();lfo.start();
  for(const [f,v] of [[110,.03],[164.8,.02],[220.4,.012]]){const o=ctx.createOscillator();o.type='sine';o.frequency.value=f;const g=ctx.createGain();g.gain.value=v;o.connect(g);g.connect(audio.amb);o.start()}
 }catch(e){}
}
function playTone(freq=620,duration=.07,type='sine',vol=.05,delay=0){
 if(!audio.ctx)return;try{const ctx=audio.ctx,now=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,now);gain.gain.setValueAtTime(vol,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(audio.sfx);osc.start(now);osc.stop(now+duration+.02)}catch(e){}
}
function coinSound(){const f=820+Math.random()*420;playTone(f,.09,'triangle',.05);playTone(f*2.51,.06,'sine',.02)}
function playChime(){[784,988,1175,1568].forEach((f,i)=>playTone(f,.28,'sine',.05,i*.08))}
function playBuy(){[523,659,784].forEach((f,i)=>playTone(f,.16,'triangle',.05,i*.07))}
function playFanfare(){[392,523,659,784,1047].forEach((f,i)=>playTone(f,.45,'triangle',.06,i*.14))}
function footstep(){if(!audio.ctx||!noiseBuf)return;try{const ctx=audio.ctx,now=ctx.currentTime,s=ctx.createBufferSource();s.buffer=noiseBuf;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=300+Math.random()*180;const g=ctx.createGain();g.gain.setValueAtTime(.14,now);g.gain.exponentialRampToValueAtTime(.001,now+.09);s.connect(lp);lp.connect(g);g.connect(audio.sfx);s.start(now,Math.random()*1.5,.1)}catch(e){}}
function chirp(){if(!audio.ctx)return;try{const ctx=audio.ctx,n=2+Math.floor(Math.random()*3),base=2200+Math.random()*1400;for(let i=0;i<n;i++){const now=ctx.currentTime+i*.13,o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(base,now);o.frequency.exponentialRampToValueAtTime(base*1.35,now+.07);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.018,now+.015);g.gain.exponentialRampToValueAtTime(.0001,now+.09);o.connect(g);g.connect(audio.amb);o.start(now);o.stop(now+.1)}}catch(e){}}

// ---------- HUD helpers ----------
function toast(title,sub=''){const box=$('toasts'),t=document.createElement('div');t.className='toast';t.innerHTML=`<b>${title}</b>${sub?`<small>${sub}</small>`:''}`;box.appendChild(t);while(box.children.length>3)box.firstChild.remove();setTimeout(()=>t.remove(),4300)}
function showFloat(text,big){const f=document.createElement('div');f.className='float';f.textContent=text;f.style.marginLeft=(Math.random()*80-40)+'px';if(big)f.style.fontSize='28px';document.body.appendChild(f);setTimeout(()=>f.remove(),1200)}
function updateObjective(){
 const el=$('objectiveText');if(!el)return;
 let msg;
 if(collected>=TOTAL)msg='Mountain cleared! Choose Ascend to begin a stronger run.';
 else if(!pathKeys.some(k=>upgradeLevel[k]>0))msg=collected<100?'Hold E near the mountain to collect your first coins.':'Open upgrades with B and buy your first tool to increase collection speed.';
 else if(droneCount===0&&wallet>=droneCost())msg=`You can afford a drone. Open B and buy one for +${fmtRate(DRONE_RATE*ascMult())} coins/sec, even while exploring.`;
 else if(droneCount===0)msg='Keep collecting or find a golden coin beam. Your first drone will earn coins while you explore.';
 else if(collected<15000)msg='Keep your combo going, grab golden coins, and reinvest in tools or drones.';
 else msg='Build your favorite upgrade paths, use unlocked ultimates (1–6), and clear the mountain to Ascend.';
 el.textContent=msg;
}
function updateHUD(){
 $('collected').textContent=`${fmtInt(collected)} / ${fmtInt(TOTAL)}`;updateObjective();$('wallet').textContent=fmtInt(wallet);$('rate').textContent=`${fmtRate(effRate())} / sec`;
 $('auto').textContent=`${fmtRate(droneCount*DRONE_RATE*ascMult()*(abilityBuffs.automation>0?5:1))} / sec`;$('tool').textContent=tool;$('asc').textContent=`${ascensions} · ×${ascMult().toFixed(2)}`;$('progress').style.width=(collected/TOTAL*100)+'%';renderAbilities();hudDirty=false;
}
function updateLookHint(){
 let text='';if(isPlaying()&&!locked)text=lockBlocked?'Mouse capture unavailable here — click and drag to look around':'Click to capture the mouse · or click and drag to look around';
 if(text===lastHint)return;lastHint=text;const el=$('lookHint');el.textContent=text;el.classList.toggle('hidden',!text);
}
function updatePrompt(near,collecting){
 const text=(isPlaying()&&near&&!collecting&&collected<TOTAL)?`Hold ${keyLabel(binds.collect)} (or left mouse) to collect coins`:'';
 if(text!==lastPrompt){lastPrompt=text;const el=$('prompt');el.textContent=text;el.classList.toggle('hidden',!text)}
 const cf=comboFrac(),show=comboT>.05&&isPlaying();$('combo').classList.toggle('hidden',!show);
 if(show){$('comboText').textContent=`COMBO ×${comboMult().toFixed(2)}`;$('comboFill').style.width=(cf*100)+'%'}
}
let mmCtx=null;
function drawMinimap(){
 if(!mmCtx)mmCtx=$('minimap').getContext('2d');const c=mmCtx,W=150,R=75,s=1.7;c.clearRect(0,0,W,W);c.save();c.beginPath();c.arc(R,R,R-1,0,Math.PI*2);c.clip();
 c.fillStyle='rgba(16,24,39,.85)';c.fillRect(0,0,W,W);
 const sy=Math.sin(yaw),cy=Math.cos(yaw);const tr=(wx,wz)=>{const dx=wx-player.x,dz=wz-player.z;return[R+(dx*cy-dz*sy)*s,R+(dx*sy+dz*cy)*s]};
 const [cx,cz]=tr(0,0);
 c.strokeStyle='rgba(255,255,255,.18)';c.lineWidth=1;for(const rr of [ARENA_R,24]){c.beginPath();c.arc(cx,cz,rr*s,0,Math.PI*2);c.stroke()}
 c.fillStyle='rgba(121,86,61,.9)';c.beginPath();c.arc(cx,cz,18*s,0,Math.PI*2);c.fill();
 c.fillStyle=collected<TOTAL?'rgba(255,205,70,.95)':'rgba(120,120,120,.6)';c.beginPath();c.arc(cx,cz,CORE_R*s*(.35+.65*(1-collected/TOTAL)),0,Math.PI*2);c.fill();
 for(const o of goldens){let [gx,gz]=tr(o.x,o.z);const dx=gx-R,dz=gz-R,d=Math.hypot(dx,dz),lim=R-8;if(d>lim){gx=R+dx/d*lim;gz=R+dz/d*lim}c.fillStyle='#fff3a0';c.strokeStyle='#ff9d00';c.lineWidth=2;c.beginPath();c.arc(gx,gz,4,0,Math.PI*2);c.fill();c.stroke()}
 c.fillStyle='#fff';c.font='bold 11px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('N',R+sy*(R-9),R-cy*(R-9));
 c.fillStyle='#5ee6ff';c.beginPath();c.moveTo(R,R-7);c.lineTo(R+5,R+5);c.lineTo(R-5,R+5);c.closePath();c.fill();c.restore();
}

// ---------- path ultimates ----------
function renderAbilities(){
 const bar=$('abilityBar');if(!bar)return;
 if(!bar.dataset.built){bar.innerHTML='';for(let i=0;i<pathKeys.length;i++){const k=pathKeys[i],b=document.createElement('button');b.className='ability-btn';b.id='ability-'+k;b.innerHTML=`<b>${i+1} · ${abilityInfo[k].title}</b><small>${abilityInfo[k].desc}</small>`;b.title=`Press ${i+1} to activate`;b.onclick=()=>useAbility(k);bar.appendChild(b)}bar.dataset.built='1'}
 for(let i=0;i<pathKeys.length;i++){const k=pathKeys[i],b=$('ability-'+k),owned=upgradeLevel[k]>0,cd=abilityCooldowns[k];b.disabled=!owned||cd>0||won||menuVisible()||shopOpen||settingsOpen;b.classList.toggle('ready',owned&&cd<=0&&!won&&!menuVisible()&&!shopOpen&&!settingsOpen);const small=b.querySelector('small');small.textContent=!owned?'Unlock this path to activate':cd>0?`Cooldown ${Math.ceil(cd)}s · ${abilityInfo[k].desc}`:abilityInfo[k].desc;b.querySelector('b').textContent=`${i+1} · ${abilityInfo[k].title}`;}
}
function useAbility(k){
 if(!pathKeys.includes(k)||upgradeLevel[k]<1||abilityCooldowns[k]>0||!isPlaying())return;
 const info=abilityInfo[k];abilityCooldowns[k]=info.cooldown;abilityBuffs[k]=0;
 if(k==='hand'){abilityBuffs.hand=10;toast('GOLDEN RHYTHM','Active collection is 2.5× for 10 seconds!')}
 else if(k==='machine'){const burst=Math.min(TOTAL-collected,Math.max(600,Math.floor(rate*ascMult()*14)));addCoins(burst);const bonus=Math.floor(burst*.12);wallet+=bonus;toast('GROUNDBREAKER',`Excavated ${fmtInt(burst)} coins and found a +${fmtInt(bonus)} bonus cache!`)}
 else if(k==='magnet'){abilityBuffs.magnet=12;toast('SINGULARITY','The field surges — collection and magnet pull ×4 for 12 seconds!')}
 else if(k==='bag'){abilityBuffs.bag=12;toast('OVERSTUFFED SATCHEL','Haul efficiency boosted: 2.2× active collection for 12 seconds!')}
 else if(k==='automation'){abilityBuffs.automation=15;toast('DRONE OVERDRIVE','Your drone fleet is producing 5× coins for 15 seconds!')}
 else if(k==='alchemy'){const burst=Math.min(TOTAL-collected,Math.max(1200,Math.floor(rate*ascMult()*20)));addCoins(burst);const bonus=Math.floor(burst*.18);wallet+=bonus;toast('FORTUNE FLIP',`+${fmtInt(burst)} coins and +${fmtInt(bonus)} wallet bonus!`);playFanfare()}
 const flash=$('abilityFlash');flash.classList.remove('pulse');void flash.offsetWidth;flash.classList.add('pulse');playBuy();hudDirty=true;updateHUD();saveGame();
}
function cycleTool(){const owned=pathKeys.filter(k=>upgradeLevel[k]>0);if(!owned.length)return;const idx=owned.indexOf(path);path=owned[(idx+1)%owned.length];tool=upgrades[path][upgradeLevel[path]-1][0];updateToolVisuals();refreshProps();updateHUD();toast('Tool equipped',`${names[path]} · ${tool}`);saveGame()}
function tickAbilities(dt){for(const k of pathKeys){abilityCooldowns[k]=Math.max(0,abilityCooldowns[k]-dt);abilityBuffs[k]=Math.max(0,abilityBuffs[k]-dt)}renderAbilities()}

// ---------- progression ----------
function addCoins(n){
 if(n<=0||collected>=TOTAL)return;n=Math.min(n,TOTAL-collected);collected+=n;wallet+=n;lifetime+=n;hudDirty=true;updatePileShape(false);
 for(const m of MILESTONES){if(collected>=m&&!claimedMilestones.has(m)){claimedMilestones.add(m);const b=Math.round(m*.03);wallet+=b;toast(`Milestone: ${fmtInt(m)} coins!`,`Bonus +${fmtInt(b)} to your wallet`);playChime()}}
 if(collected>=TOTAL)winGame();
}
function mmss(s){s=Math.floor(s);return `${Math.floor(s/60)}m ${String(s%60).padStart(2,'0')}s`}
function winGame(){
 won=true;mouseHeld=false;if(document.pointerLockElement)document.exitPointerLock();
 $('winStats').textContent=`Run time ${mmss(runSeconds)} · Ascension ${ascensions+1} will give a permanent ×${(1+(ascensions+1)*.25).toFixed(2)} bonus and unlock ${biomes[(ascensions+1)%biomes.length].name}.`;
 $('win').classList.remove('hidden');playFanfare();saveGame();
}
function ascend(){
 ascensions++;collected=0;wallet=0;rate=1;tool='Bare hands';path=null;upgradeLevel={hand:0,machine:0,magnet:0,bag:0,automation:0,alchemy:0};droneCount=0;comboT=0;collectBuffer=0;runSeconds=0;claimedMilestones=new Set();for(const k of pathKeys){abilityCooldowns[k]=0;abilityBuffs[k]=0}won=false;
 syncDrones();clearGoldens();applyBiome();player={x:0,y:floorAt(0,25),z:25,vy:0,speed:5.2};yaw=0;pitch=0;
 updatePileShape(true);refreshProps();updateToolVisuals();refreshShop();updateHUD();saveGame();
 $('win').classList.add('hidden');$('menu').classList.add('hidden');requestLock();
 toast(`Ascension ${ascensions}!`,`Permanent ×${ascMult().toFixed(2)} bonus · ${biomes[ascensions%biomes.length].name}`);
}
function saveGame(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({v:4,collected,wallet,path,upgradeLevel,droneCount,ascensions,lifetime,runSeconds,milestones:[...claimedMilestones],tod,abilityCooldowns:{...abilityCooldowns},abilityBuffs:{...abilityBuffs},savedAt:Date.now()}))}catch(e){}}
function loadGame(){
 try{
  const s=JSON.parse(localStorage.getItem(SAVE_KEY)||localStorage.getItem('coinMountainSave2')||'null');if(!s||typeof s!=='object')return false;
  const num=(v,a,b,d=0)=>Number.isFinite(+v)?clamp(+v,a,b):d;
  collected=Math.floor(num(s.collected,0,TOTAL));wallet=Math.floor(num(s.wallet,0,1e12));droneCount=Math.floor(num(s.droneCount,0,MAX_DRONES));ascensions=Math.floor(num(s.ascensions,0,9999));lifetime=num(s.lifetime,0,1e15);runSeconds=num(s.runSeconds,0,1e9);tod=num(s.tod,0,.9999,.15);
  upgradeLevel={};for(const k of pathKeys)upgradeLevel[k]=Math.floor(num(s.upgradeLevel&&s.upgradeLevel[k],0,5));
  path=names[s.path]?s.path:null;if(path&&upgradeLevel[path]===0)path=pathKeys.find(k=>upgradeLevel[k]>0)||null;if(!path)path=pathKeys.find(k=>upgradeLevel[k]>0)||null;
  rate=computeRate();tool=path&&upgradeLevel[path]>0?upgrades[path][upgradeLevel[path]-1][0]:'Bare hands';
  claimedMilestones=new Set((Array.isArray(s.milestones)?s.milestones:[]).filter(m=>MILESTONES.includes(m)));
  const away=Math.min(7200,Math.max(0,(Date.now()-num(s.savedAt,0,Date.now(),Date.now()))/1000));
  // Persist ability timers so refreshing cannot repeatedly trigger instant-burst ultimates.
  // Subtract elapsed wall time on load, so cooldowns and temporary buffs still expire offline.
  for(const k of pathKeys){
   abilityCooldowns[k]=Math.max(0,num(s.abilityCooldowns&&s.abilityCooldowns[k],0,abilityInfo[k].cooldown,0)-away);
   abilityBuffs[k]=Math.max(0,num(s.abilityBuffs&&s.abilityBuffs[k],0,120,0)-away);
  }
  if(away>30&&droneCount>0&&collected<TOTAL){offlineGain=Math.min(Math.floor(droneCount*DRONE_RATE*ascMult()*away*.5),TOTAL-1-collected);if(offlineGain>0){collected+=offlineGain;wallet+=offlineGain;lifetime+=offlineGain}}
  return true;
 }catch(e){return false}
}
function hasProgress(){return collected>0||ascensions>0||path||droneCount>0}
function refreshMenu(){
 $('start').textContent=hasProgress()?'Continue exploring':'Start exploring';
 $('saveInfo').textContent=hasProgress()?`Saved: Ascension ${ascensions} · ${fmtInt(collected)} / ${fmtInt(TOTAL)} coins · ${biomes[ascensions%biomes.length].name}`:'';
}
function hardReset(){
 try{localStorage.removeItem(SAVE_KEY);localStorage.removeItem('coinMountainSave2')}catch(e){}
 collected=0;wallet=0;rate=1;tool='Bare hands';path=null;upgradeLevel={hand:0,machine:0,magnet:0,bag:0,automation:0,alchemy:0};droneCount=0;ascensions=0;lifetime=0;runSeconds=0;claimedMilestones=new Set();comboT=0;collectBuffer=0;for(const k of pathKeys){abilityCooldowns[k]=0;abilityBuffs[k]=0}won=false;shopOpen=false;settingsOpen=false;keys={};mouseHeld=false;
 player={x:0,y:floorAt(0,25),z:25,vy:0,speed:5.2};yaw=0;pitch=0;
 if(document.pointerLockElement)document.exitPointerLock();
 $('win').classList.add('hidden');$('shop').classList.add('hidden');$('settings').classList.add('hidden');$('menu').classList.remove('hidden');
 syncDrones();clearGoldens();applyBiome();updatePileShape(true);refreshProps();updateToolVisuals();refreshShop();updateHUD();refreshMenu();
}

// ---------- shop ----------
function makeShop(){
 const grid=$('upgradeGrid');grid.innerHTML='';
 for(const key of pathKeys){
  const col=document.createElement('div');col.className='path';col.innerHTML=`<h3>${names[key]}</h3><div class="tag">${key==='hand'?'Manual mastery':key==='machine'?'Heavy equipment':key==='magnet'?'Field technology':key==='bag'?'Capacity & mobility':key==='automation'?'Passive production':'Luck & multipliers'}</div><div class="perk">${perks[key]}</div><div class="tag">ULT · ${abilityInfo[key].cooldown}s cooldown</div>`;
  upgrades[key].forEach((u,i)=>{const b=document.createElement('button');b.className='upgrade';b.id=`u-${key}-${i}`;b.innerHTML=`<b>${i+1}. ${u[0]}</b><small>Cost: ${u[1].toLocaleString()} · +${u[2]} coins/sec</small>`;b.onclick=()=>buy(key,i);col.appendChild(b)});
  grid.appendChild(col);
 }
 const ex=$('extras');ex.innerHTML='';
 const dc=document.createElement('div');dc.className='path';dc.innerHTML=`<h3>Auto-collector drones</h3><div class="perk">Each drone mines ${DRONE_RATE} coins/sec forever — even when you are not near the mountain. Works with every path (max ${MAX_DRONES}).</div>`;
 const db=document.createElement('button');db.className='upgrade';db.id='buyDrone';db.onclick=buyDrone;dc.appendChild(db);ex.appendChild(dc);
 const ac=document.createElement('div');ac.className='path';ac.innerHTML='<h3>Ascension</h3><div class="perk" id="ascInfo"></div>';ex.appendChild(ac);
 refreshShop();
}
function refreshShop(){
 for(const k of Object.keys(upgrades))upgrades[k].forEach((u,i)=>{const b=$(`u-${k}-${i}`);const owned=upgradeLevel[k]>i,available=upgradeLevel[k]===i;b.disabled=owned||!available||wallet<u[1];b.style.borderColor=owned?'#66d99b':(path===k?'#ffce4d':'#ffffff1b');b.style.background=owned?'#214737':'';b.querySelector('small').textContent=owned?'PURCHASED':`Cost: ${u[1].toLocaleString()} · +${u[2]} coins/sec`});
 const db=$('buyDrone');if(db){const full=droneCount>=MAX_DRONES;db.disabled=full||wallet<droneCost();db.innerHTML=full?`<b>Drone fleet complete (${MAX_DRONES}/${MAX_DRONES})</b>`:`<b>Buy drone #${droneCount+1}</b><small>Cost: ${droneCost().toLocaleString()} · +${fmtRate(DRONE_RATE*ascMult())} coins/sec · owned ${droneCount}</small>`}
 const ai=$('ascInfo');if(ai)ai.textContent=`Current bonus ×${ascMult().toFixed(2)} (${ascensions} ascension${ascensions===1?'':'s'}). Clear the whole mountain to Ascend: +25% permanent collection speed, drones and golden coins, plus a new biome.`;
 const candidates=[];for(const k of pathKeys){const i=upgradeLevel[k];if(i<5&&wallet>=upgrades[k][i][1])candidates.push({k,i,cost:upgrades[k][i][1],gain:upgrades[k][i][2],score:upgrades[k][i][2]/upgrades[k][i][1]})}
 const best=candidates.sort((a,b)=>b.score-a.score)[0];
 for(const k of pathKeys)for(let i=0;i<5;i++){const b=$(`u-${k}-${i}`);if(!b)continue;const rec=best&&best.k===k&&best.i===i; b.dataset.recommended=rec?'true':'false';b.style.boxShadow=rec?'0 0 0 2px #ffd65b, 0 0 18px #ffd65b22':'';const small=b.querySelector('small');if(small&&!small.textContent.includes('BEST VALUE')){if(rec)small.textContent+=' · BEST VALUE'}}
 $('shopNote').textContent=`Owned paths: ${pathKeys.filter(k=>upgradeLevel[k]>0).map(k=>names[k]).join(', ')||'none yet'}. All branches remain available; Q cycles equipped tools, and number keys 1–6 trigger unlocked ultimates.`;
}
function buy(k,i){
 const u=upgrades[k][i];if(upgradeLevel[k]!==i||wallet<u[1])return;
 wallet-=u[1];playBuy();path=k;upgradeLevel[k]++;rate=computeRate();tool=u[0];
 updateToolVisuals();refreshProps();refreshShop();updateHUD();saveGame();toast(u[0],`${names[k]} upgraded · +${u[2]} coins/sec · ${abilityInfo[k].title} ${upgradeLevel[k]===1?'unlocked':''}`);
}
function buyDrone(){const c=droneCost();if(droneCount>=MAX_DRONES||wallet<c)return;wallet-=c;droneCount++;syncDrones();playBuy();refreshShop();updateHUD();saveGame()}
function toggleShop(){if(menuVisible()||won||settingsOpen)return;shopOpen=!shopOpen;$('shop').classList.toggle('hidden',!shopOpen);if(shopOpen){mouseHeld=false;if(document.pointerLockElement)document.exitPointerLock();refreshShop()}else requestLock()}

// ---------- settings ----------
function keyLabel(code){const m={KeyW:'W',KeyA:'A',KeyS:'S',KeyD:'D',KeyE:'E',KeyB:'B',Space:'Space',ShiftLeft:'Left Shift',ShiftRight:'Right Shift',Escape:'Esc',ControlLeft:'Left Ctrl',ControlRight:'Right Ctrl',AltLeft:'Left Alt',AltRight:'Right Alt',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Tab:'Tab',Enter:'Enter'};return m[code]||code.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'Num ')}
function renderBinds(){const box=$('keybindRows');if(!box)return;box.innerHTML='';const labels={forward:'Move forward',back:'Move backward',left:'Move left',right:'Move right',jump:'Jump',collect:'Collect coins',shop:'Upgrade shop',sprint:'Sprint'};for(const action of Object.keys(defaultBinds)){const row=document.createElement('div');row.className='bind-row';const label=document.createElement('span');label.textContent=labels[action];const btn=document.createElement('button');btn.className='bind-key'+(rebindAction===action?' listening':'');btn.textContent=rebindAction===action?'Press a key…':keyLabel(binds[action]);btn.onclick=()=>{rebindAction=action;renderBinds()};row.append(label,btn);box.appendChild(row)}}
function syncSettingsUI(){
 $('volumeValue').textContent=Math.round(masterVolume*100)+'%';$('sfxValue').textContent=Math.round(sfxVolume*100)+'%';$('ambValue').textContent=Math.round(ambVolume*100)+'%';$('sensitivityValue').textContent=Math.round(mouseSensitivity*100)+'%';$('fovValue').textContent=Math.round(baseFov)+'°';
 $('help').classList.toggle('hidden',!showHints);
 $('help').innerHTML=`<kbd>${keyLabel(binds.forward)}</kbd> <kbd>${keyLabel(binds.left)}</kbd> <kbd>${keyLabel(binds.back)}</kbd> <kbd>${keyLabel(binds.right)}</kbd> move · <kbd>Mouse</kbd> look (or drag) · <kbd>${keyLabel(binds.jump)}</kbd> jump · <kbd>${keyLabel(binds.sprint)}</kbd> sprint · <kbd>Hold ${keyLabel(binds.collect)}</kbd> collect · <kbd>${keyLabel(binds.shop)}</kbd> upgrades · <kbd>Q</kbd> switch tool · <kbd>1–6</kbd> ultimates · <kbd>Esc</kbd> pause`;
}
function pushSettingsToUI(){$('masterVolume').value=Math.round(masterVolume*100);$('sfxVolume').value=Math.round(sfxVolume*100);$('ambVolume').value=Math.round(ambVolume*100);$('sensitivity').value=Math.round(mouseSensitivity*100);$('fov').value=Math.round(baseFov);$('invertY').checked=invertY;$('headBob').checked=headBob;$('showHints').checked=showHints;$('quality').value=quality}
function readSettingsUI(){masterVolume=+$('masterVolume').value/100;sfxVolume=+$('sfxVolume').value/100;ambVolume=+$('ambVolume').value/100;mouseSensitivity=+$('sensitivity').value/100;baseFov=+$('fov').value;invertY=$('invertY').checked;headBob=$('headBob').checked;showHints=$('showHints').checked;quality=$('quality').value}
function saveSettings(){try{localStorage.setItem('coinSettings',JSON.stringify({binds,masterVolume,sfxVolume,ambVolume,mouseSensitivity,invertY,headBob,showHints,quality,fov:baseFov}))}catch(e){}}
function loadSettings(){
 try{
  const s=JSON.parse(localStorage.getItem('coinSettings')||'{}'),savedBinds=s.binds&&typeof s.binds==='object'?s.binds:{};
  // Key codes are persisted locally; validate them before rendering any labels into the HUD.
  binds={...defaultBinds};const used=new Set();
  for(const action of Object.keys(defaultBinds)){
   const v=savedBinds[action];
   if(typeof v==='string'&&/^[A-Za-z][A-Za-z0-9]{0,23}$/.test(v)&&!used.has(v)){binds[action]=v;used.add(v)}
   else{const fallback=!used.has(defaultBinds[action])?defaultBinds[action]:Object.values(defaultBinds).find(code=>!used.has(code));if(fallback){binds[action]=fallback;used.add(fallback)}}
  }
  const safe=(v,lo,hi,d)=>Number.isFinite(Number(v))?clamp(Number(v),lo,hi):d;
  masterVolume=safe(s.masterVolume??.7,0,1,.7);sfxVolume=safe(s.sfxVolume??.8,0,1,.8);ambVolume=safe(s.ambVolume??.5,0,1,.5);mouseSensitivity=safe(s.mouseSensitivity??1,.25,2.5,1);
  invertY=typeof s.invertY==='boolean'?s.invertY:false;headBob=typeof s.headBob==='boolean'?s.headBob:true;showHints=typeof s.showHints==='boolean'?s.showHints:true;
  quality=['high','medium','low'].includes(s.quality)?s.quality:'high';baseFov=clamp(Number(s.fov??localStorage.getItem('coinFov'))||75,60,110)
 }catch(e){binds={...defaultBinds};masterVolume=.7;sfxVolume=.8;ambVolume=.5;mouseSensitivity=1;invertY=false;headBob=true;showHints=true;quality='high';baseFov=75}
 fovCur=baseFov;pushSettingsToUI();
}
function applyQuality(){
 renderer.setPixelRatio(quality==='high'?Math.min(devicePixelRatio||1,2):quality==='medium'?Math.min(devicePixelRatio||1,1.35):1);renderer.setSize(innerWidth,innerHeight);
 const sz=quality==='high'?3072:quality==='medium'?1536:1024;if(sun.shadow.mapSize.x!==sz){sun.shadow.mapSize.set(sz,sz);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
 sun.castShadow=quality!=='low';
}
function openSettings(fromMenu=false){
 const menuUp=menuVisible();settingsFromMenu=fromMenu||menuUp;settingsOpen=true;mouseHeld=false;
 $('settings').classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();
 if(settingsFromMenu)$('menu').classList.add('hidden');syncSettingsUI();renderBinds();
}
function closeSettings(){
 rebindAction=null;settingsOpen=false;$('settings').classList.add('hidden');
 if(settingsFromMenu){settingsFromMenu=false;$('menu').classList.remove('hidden');return}
 if(isPlaying())requestLock();
}

// ---------- input ----------
function requestLock(){
 if(!canvas||!canvas.requestPointerLock||locked)return;
 try{const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{lockBlocked=true})}catch(err){lockBlocked=true}
}
function applyCameraRotation(){camera.rotation.set(pitch,yaw,0)}
function look(dx,dy){
 const k=.0022*mouseSensitivity;yaw-=dx*k;pitch+=(invertY?1:-1)*dy*k;pitch=clamp(pitch,-MAX_PITCH,MAX_PITCH);
 if(yaw>Math.PI)yaw-=Math.PI*2;else if(yaw<-Math.PI)yaw+=Math.PI*2;applyCameraRotation();
}
function setupInput(){
 addEventListener('keydown',e=>{
  ensureAudio();
  if(rebindAction){e.preventDefault();if(e.code!=='Escape'){const other=Object.keys(binds).find(a=>a!==rebindAction&&binds[a]===e.code);if(other)binds[other]=binds[rebindAction];binds[rebindAction]=e.code;saveSettings()}rebindAction=null;renderBinds();syncSettingsUI();return}
  if(e.code==='Escape'){if(settingsOpen)closeSettings();else if(shopOpen)toggleShop();else if(isPlaying())openSettings(false);return}
  keys[e.code]=true;
  if(isPlaying()&&Object.values(binds).includes(e.code))e.preventDefault();
  if(e.code===binds.shop&&!e.repeat)toggleShop();
  if(!e.repeat&&isPlaying()&&e.code==='KeyQ'){cycleTool();e.preventDefault()}
  if(!e.repeat&&isPlaying()){const abilityIndex={'Digit1':0,'Digit2':1,'Digit3':2,'Digit4':3,'Digit5':4,'Digit6':5}[e.code];if(abilityIndex!==undefined){useAbility(pathKeys[abilityIndex]);e.preventDefault()}}
  if(e.code===binds.jump&&isPlaying()&&player.y<=floorAt(player.x,player.z)+.05)player.vy=6.8;
 });
 addEventListener('keyup',e=>{keys[e.code]=false;if(isPlaying()&&Object.values(binds).includes(e.code))e.preventDefault()});
 const clearInputs=()=>{keys={};dragId=null;mouseHeld=false};
 addEventListener('blur',clearInputs);document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInputs();saveGame()}});addEventListener('beforeunload',saveGame);
 document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button');if(b)setTimeout(()=>b.blur(),0)},true);
 document.addEventListener('mousemove',e=>{if(!locked||!isPlaying())return;const dx=e.movementX||0,dy=e.movementY||0;if(Math.abs(dx)>300||Math.abs(dy)>300)return;look(dx,dy)});
 document.addEventListener('mousedown',e=>{if(locked&&e.button===0&&isPlaying())mouseHeld=true});document.addEventListener('mouseup',e=>{if(e.button===0)mouseHeld=false});
 document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(locked)lockBlocked=false;else mouseHeld=false;dragId=null});
 document.addEventListener('pointerlockerror',()=>{lockBlocked=true});
 canvas.addEventListener('pointerdown',e=>{ensureAudio();if(!isPlaying()||locked)return;if(e.pointerType==='mouse'&&e.button!==0)return;dragId=e.pointerId;dragLastX=e.clientX;dragLastY=e.clientY;dragMoved=0;try{canvas.setPointerCapture(e.pointerId)}catch(err){}});
 canvas.addEventListener('pointermove',e=>{if(e.pointerId!==dragId||locked||!isPlaying())return;const dx=e.clientX-dragLastX,dy=e.clientY-dragLastY;dragLastX=e.clientX;dragLastY=e.clientY;dragMoved+=Math.abs(dx)+Math.abs(dy);look(dx,dy)});
 const endDrag=e=>{if(e.pointerId!==dragId)return;const wasClick=e.type==='pointerup'&&dragMoved<6;dragId=null;try{canvas.releasePointerCapture(e.pointerId)}catch(err){}if(wasClick&&isPlaying()&&!locked)requestLock()};
 canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
 $('start').onclick=()=>{ensureAudio();$('menu').classList.add('hidden');requestLock()};
 $('openSettings').onclick=()=>openSettings(true);$('hudSettings').onclick=()=>openSettings(false);$('closeSettings').onclick=closeSettings;
 $('defaultsSettings').onclick=()=>{binds={...defaultBinds};masterVolume=.7;sfxVolume=.8;ambVolume=.5;mouseSensitivity=1;invertY=false;headBob=true;showHints=true;quality='high';baseFov=75;pushSettingsToUI();applyQuality();applyVolumes();saveSettings();syncSettingsUI();renderBinds()};
 ['masterVolume','sfxVolume','ambVolume','sensitivity','fov','invertY','headBob','showHints','quality'].forEach(id=>$(id).addEventListener('input',()=>{readSettingsUI();applyQuality();applyVolumes();syncSettingsUI();saveSettings()}));
 $('reset').onclick=()=>{if(!resetArmed){resetArmed=true;$('reset').textContent='Click again to erase ALL progress';setTimeout(()=>{resetArmed=false;$('reset').textContent='Reset progress'},4000);return}resetArmed=false;$('reset').textContent='Reset progress';hardReset()};
 $('closeShop').onclick=toggleShop;$('ascend').onclick=ascend;
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
}

// ---------- init + main loop ----------
function init(){
 daySky=new THREE.Color(biomes[0].sky);nightCol=new THREE.Color(0x070c22);duskCol=new THREE.Color(0xff8f4a);tmpC=new THREE.Color();
 scene=new THREE.Scene();scene.background=new THREE.Color(daySky);scene.fog=new THREE.Fog(daySky.getHex(),64,188);
 camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,320);camera.rotation.order='YXZ';
 renderer=new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
 canvas=renderer.domElement;document.body.prepend(canvas);clock=new THREE.Clock();
 hemi=new THREE.HemisphereLight(0xc9e7ff,0x55402b,1.65);scene.add(hemi);
 const fill=new THREE.DirectionalLight(0x83b6c8,.72);fill.position.set(24,18,-22);scene.add(fill);
 const rimFill=new THREE.DirectionalLight(0xffc76b,.48);rimFill.position.set(4,12,26);scene.add(rimFill);
 sun=new THREE.DirectionalLight(0xffe3ad,3.0);sun.position.set(-18,35,12);sun.castShadow=true;sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.camera.far=200;scene.add(sun);
 moon=new THREE.DirectionalLight(0x7f9bff,0);scene.add(moon);
 pileLight=new THREE.PointLight(0xffc94a,0,75,1.2);pileLight.position.set(0,BASE_TOP+9,0);scene.add(pileLight);
 buildGround();buildPile();buildScenery();buildVisualOverhaul();buildSkyObjects();buildProps();buildRigs();buildParticles();
 loadSettings();applyQuality();
 const loaded=loadGame();
 applyBiome();updatePileShape(true);syncDrones();refreshProps();updateToolVisuals();
 player.y=floorAt(player.x,player.z);camera.position.set(player.x,player.y,player.z);applyCameraRotation();
 setupInput();makeShop();renderAbilities();syncSettingsUI();renderBinds();updateHUD();refreshMenu();
 if(loaded&&collected>=TOTAL)winGame();
 if(offlineGain>0){const gained=offlineGain;setTimeout(()=>{if(collected>=gained)toast('Welcome back!',`Your drones mined +${fmtInt(gained)} coins while you were away`)},600)}
 animate();
}

function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.05),playing=isPlaying(),inMenu=menuVisible(),sim=!inMenu&&!won&&!settingsOpen;
 const asc=ascMult();
 let near=false,collecting=false,moving=false,onGround=true;
 // ---- player ----
 if(playing){
  const f=(keys[binds.forward]?1:0)-(keys[binds.back]?1:0),s=(keys[binds.right]?1:0)-(keys[binds.left]?1:0);
  const sprint=!!(keys[binds.sprint]||keys.ShiftRight);moving=!!(f||s);
  if(moving){
   const step=player.speed*(sprint&&moving?1.6:1)*dt/Math.hypot(f,s),sinY=Math.sin(yaw),cosY=Math.cos(yaw);
   // camera-relative: forward = (-sin, -cos), right = (cos, -sin) in (x, z)
   player.x+=(-sinY*f+cosY*s)*step;player.z+=(-cosY*f-sinY*s)*step;
   stepAcc+=player.speed*(sprint?1.6:1)*dt;bobT+=dt*(sprint?11:8);
  }
  fovCur+=((baseFov+(sprint&&moving?7:0))-fovCur)*Math.min(1,dt*8);
  for(const o of obstacles){if(!o.on)continue;const dx=player.x-o.x,dz=player.z-o.z,d=Math.hypot(dx,dz),m=o.r+.45;if(d<m&&d>1e-4){player.x=o.x+dx/d*m;player.z=o.z+dz/d*m}}
  let dist=Math.hypot(player.x,player.z);
  if(dist>ARENA_R){player.x*=ARENA_R/dist;player.z*=ARENA_R/dist;dist=ARENA_R}
  if(dist<PILE_MIN_R){if(dist<.001){player.x=0;player.z=PILE_MIN_R}else{player.x*=PILE_MIN_R/dist;player.z*=PILE_MIN_R/dist}}
  const floor=floorAt(player.x,player.z);player.vy-=17*dt;player.y+=player.vy*dt;if(player.y<=floor){player.y=floor;player.vy=0}
  onGround=player.y<=floor+.02;
  if(moving&&onGround&&stepAcc>2.3){stepAcc=0;footstep()}
 }
 const pdist=Math.hypot(player.x,player.z);near=pdist<collectRange();
 collecting=playing&&!!(keys[binds.collect]||mouseHeld)&&near&&collected<TOTAL;
 // ---- economy ----
 if(sim){
  runSeconds+=dt;tickAbilities(dt);
  if(collecting)comboT=Math.min(comboMax(),comboT+dt);else comboT=Math.max(0,comboT-dt*1.2);
  if(collected<TOTAL){
   let r=0;
   if(collecting)r+=effRate();else if(upgradeLevel.magnet>0&&pdist<32)r+=rate*asc*.12*upgradeLevel.magnet*(abilityBuffs.magnet>0?4:1);
   r+=droneCount*DRONE_RATE*asc*(abilityBuffs.automation>0?5:1);
   collectBuffer+=r*dt;
   if(collectBuffer>=1){const n=Math.floor(collectBuffer);collectBuffer-=n;const before=collected;addCoins(n);if(collecting)floatAcc+=collected-before}
  }
  if(collecting){soundTimer-=dt;if(soundTimer<=0){coinSound();soundTimer=.09}floatTimer-=dt;if(floatTimer<=0&&floatAcc>0){showFloat('+'+fmtInt(floatAcc));floatAcc=0;floatTimer=.6}}
  // particles
  partTimer+=dt;const pr=collecting?clamp(6+rate*.35,6,45):0;
  if(collecting)while(partTimer>1/pr){partTimer-=1/pr;spawnFromPile(0)}else partTimer=0;
  if(droneCount>0&&Math.random()<droneCount*dt*.5&&drones.length)spawnFromPile(1,Math.floor(Math.random()*drones.length));
  // golden coins
  goldenTimer-=dt;if(goldenTimer<=0){spawnGolden();goldenTimer=12+Math.random()*6}
  for(let i=goldens.length-1;i>=0;i--){const o=goldens[i];o.life-=dt;if(o.life<=0){scene.remove(o.g);goldens.splice(i,1);continue}
   o.g.rotation.y+=dt*2.2;o.g.position.y=1.5+Math.sin(performance.now()*.002+o.ph)*.2;
   if(playing&&Math.hypot(player.x-o.x,player.z-o.z)<1.9&&player.y<3.9+floorAt(o.x,o.z)-EYE){collectGolden(o)}}
  saveTimer+=dt;if(saveTimer>8){saveTimer=0;saveGame()}
  birdTimer-=dt;if(birdTimer<=0){birdTimer=4+Math.random()*7;if(dayFactor>.6)chirp()}
 }
 // ---- visuals ----
 updateSky(dt);
 const tnow=performance.now()*.001;
 if(ambientMotesObj){ambientMotesObj.rotation.y+=dt*.012;ambientMotesObj.position.y=Math.sin(tnow*.22)*.18;}
 drones.forEach((d,i)=>{const ang=tnow*(.35+(i%3)*.08)*(i%2?1:-1)+d.phase,rr=10.5+(i%4)*1.5;d.grp.position.set(Math.cos(ang)*rr,BASE_TOP+4.5+(i%5)*1.2+Math.sin(tnow*2+d.phase)*.3,Math.sin(ang)*rr);d.rotor.rotation.y=tnow*40;d.grp.rotation.y=-ang});
 if(props.conv.visible)props.convCoins.forEach((c,i)=>{c.position.x=12+((tnow*1.6+i*.8)%9.6)});
 if(props.loader.visible)props.loaderArm.rotation.z=Math.sin(tnow*1.1)*.35;
 if(props.exc.visible){props.turret.rotation.y=Math.sin(tnow*.6)*.5;props.boom.rotation.z=.1+Math.sin(tnow*1.3)*.2}
 if(props.magnet.visible){props.rings.forEach((r,i)=>{r.position.y=pileH+2.4+i*1.15;r.rotation.x=Math.PI/2+Math.sin(tnow*.8+i)*.25;r.rotation.z+=dt*(.5+i*.25)});props.sing.position.y=pileH+9;props.sing.rotation.y+=dt;props.sing.scale.setScalar(1+Math.sin(tnow*3)*.08)}
 if(inMenu){
  const t=performance.now()*.00012;camera.position.set(Math.cos(t)*40,9+Math.sin(t*2)*1.5,Math.sin(t)*40);camera.lookAt(0,BASE_TOP+pileH*.4,0);handGroup.visible=false;
 }else{
  handGroup.visible=true;bobAmp+=(((moving&&onGround)?1:0)-bobAmp)*Math.min(1,dt*8);
  camera.position.set(player.x,player.y+(headBob?Math.sin(bobT)*.05*bobAmp:0),player.z);applyCameraRotation();
  handGroup.position.y=-.16+(collecting?Math.sin(performance.now()*.025)*.035:Math.sin(bobT*.5)*.01*bobAmp);handGroup.rotation.x=collecting?Math.sin(performance.now()*.018)*.08:0;
 }
 if(Math.abs(camera.fov-fovCur)>.01){camera.fov=fovCur;camera.updateProjectionMatrix()}
 const hx=-Math.sin(yaw)*Math.cos(pitch),hy=Math.sin(pitch),hz=-Math.cos(yaw)*Math.cos(pitch);
 updateParticles(dt,camera.position.x+hx*.6,camera.position.y+hy*.6-.25,camera.position.z+hz*.6);
 if(hudDirty)updateHUD();else renderAbilities();
 updateLookHint();updatePrompt(near,collecting);drawMinimap();
 renderer.render(scene,camera);
}
try{init()}catch(err){document.querySelector('#menu .panel').insertAdjacentHTML('beforeend','<p style="color:#ff9b9b"><b>Could not start 3D graphics.</b> Make sure WebGL is enabled in your browser.</p>');$('start').disabled=true;console.error(err)}
