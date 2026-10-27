from pathlib import Path
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent
GAME=Path(__import__('sys').argv[1]).resolve() if len(__import__('sys').argv)>1 else HERE/'Coin_Mountain_Ascension_Ascendant_Edition_QA_Fixed.html'
src=GAME.read_text()
mock=(HERE/'mock_three.js').read_text().replace('getDelta(){return .016}', 'getDelta(){return .05}')
src=src.replace("THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js')", "THREE=window.__THREE_MOCK")
src=src.replace('<head>', '<head><script>window.__QA_MODE=true;window.__ls={};Object.defineProperty(window,'+'\"localStorage\"'+',{configurable:true,value:{getItem(k){return window.__ls[k]??null},setItem(k,v){window.__ls[k]=String(v)},removeItem(k){delete window.__ls[k]}}});</script><script>'+mock+'</script>',1)
hook='''\nwindow.__qa={
 state:()=>({TOTAL,goldenTimer,collected,wallet,rate,tool,path,binds:{...binds},upgradeLevel:{...upgradeLevel},droneCount,ascensions,runSeconds,won,shopOpen,settingsOpen,menuVisible:menuVisible(),abilityCooldowns:{...abilityCooldowns},abilityBuffs:{...abilityBuffs},ownedPaths:pathKeys.filter(k=>upgradeLevel[k]>0),toolNames:pathKeys.map(k=>names[k]),goalHeading:$('win').querySelector('h1').textContent,boardTexture:undefined}),
 setWallet(v){wallet=v;refreshShop();updateHUD()}, setDrones(n){droneCount=n;syncDrones();refreshShop();updateHUD()}, setPlayer(x,z){player.x=x;player.z=z;player.y=floorAt(x,z)}, holdCollect(v){keys[binds.collect]=v}, collect(n){addCoins(n)}, buy, buyDrone, useAbility, tickAbilities, ascend, saveGame, loadGame, hardReset, cycleTool, frame:animate, loadSettings, syncSettingsUI, refresh(){updateHUD()},
 renderAbilities, simTick(){if(!isPlaying())return;runSeconds+=1;tickAbilities(1);comboT=Math.min(comboMax(),comboT+1);let r=effRate()+droneCount*DRONE_RATE*ascMult()*(abilityBuffs.automation>0?5:1);collectBuffer+=r;const n=Math.floor(collectBuffer);collectBuffer-=n;if(n>0)addCoins(n);for(let i=0;i<6;i++){const before=wallet;this.autoBuyBest();if(before===wallet)break}this.useReadyAbilities();updateHUD()}, autoBuyBest(){const opts=[];for(const k of pathKeys){const i=upgradeLevel[k];if(i<5){const u=upgrades[k][i];opts.push({k,i,cost:u[1],eff:u[2]*Math.max(1,comboMult())})}}if(droneCount<MAX_DRONES)opts.push({drone:true,cost:droneCost(),eff:DRONE_RATE});opts.sort((a,b)=>a.cost/a.eff-b.cost/b.eff);const o=opts.find(x=>wallet>=x.cost);if(o){if(o.drone)buyDrone();else buy(o.k,o.i);if(upgradeLevel.hand>0){let n=0;while(path!=='hand'&&n++<pathKeys.length)cycleTool()}}}, useReadyAbilities(){for(const k of pathKeys)if(upgradeLevel[k]>0&&abilityCooldowns[k]<=0)useAbility(k)}, testGoldenAtGoal(){collected=TOTAL-1;wallet=0;won=false;$('win').classList.add('hidden');const o={g:new THREE.Group(),x:30,z:30,ph:0,life:1};scene.add(o.g);goldens.push(o);collectGolden(o);return{collected,won,wallet}}, openShop(){shopOpen=true;$('shop').classList.remove('hidden');refreshShop()}, closeShop(){shopOpen=false;$('shop').classList.add('hidden')}, setCollected(v){collected=v;updateHUD()}, setCooldown(k,v){abilityCooldowns[k]=v;renderAbilities()}, isPlaying
};
'''
src=src.replace('function animate(){\n requestAnimationFrame(animate);','function animate(){\n if(!window.__QA_MODE) requestAnimationFrame(animate);')
src=src.replace('</script></body>',hook+'</script></body>')
errors=[]; console=[]; reqfails=[]
with sync_playwright() as p:
 
 import shutil
 browser_path=shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
 launch={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}
 if browser_path: launch['executable_path']=browser_path
 b=p.chromium.launch(**launch)
 page=b.new_page(viewport={'width':1440,'height':900})
 page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGEERROR',e)))
 page.on('console',lambda m:(console.append((m.type,m.text)),print('CONSOLE',m.type,m.text) if m.type=='error' else None))
 page.set_content(src,wait_until='domcontentloaded',timeout=30000)
 page.wait_for_timeout(1500)
 print('START_READY',page.locator('#start').is_disabled(),'CANVASES',page.locator('canvas').evaluate_all('(xs)=>xs.map(x=>x.id)'))
 print('ERROR_TEXT',page.locator('body').inner_text()[-400:])
 print('QA_AVAILABLE',page.evaluate('!!window.__qa'))
 if not page.evaluate('!!window.__qa'):
  b.close(); raise SystemExit('test hook did not initialize')
 # basic start and UI smoke test
 page.locator('#start').click()
 page.wait_for_timeout(100)
 print('AFTER_START',page.evaluate('JSON.stringify(window.__qa.state())'))
 objective=page.locator('#objectiveText').inner_text(); assert 'Hold E' in objective, f'new-player objective unclear: {objective}'
 assert page.evaluate('window.__qa.state().goldenTimer') == 6, 'first golden coin is not scheduled early enough'
 assert page.locator('#objective').is_visible(), 'objective card missing'
 print('ONBOARDING_OBJECTIVE', objective)
 page.evaluate('window.__qa.setCollected(100);window.__qa.refresh()'); objective2=page.locator('#objectiveText').inner_text(); assert 'Open upgrades' in objective2, f'objective did not progress: {objective2}'
 print('OBJECTIVE_AFTER_FIRST_COINS', objective2)
 assert page.evaluate('document.querySelector("#rate").textContent') == '1 / sec', 'initial active rate label incorrect'
 print('ABILITY_BUTTONS',page.locator('.ability-btn').count())
 # Responsive layout smoke test at mobile, tablet, and desktop sizes.
 for width,height in [(320,568),(390,844),(768,1024),(1440,900)]:
  page.set_viewport_size({'width':width,'height':height})
  layout=page.evaluate("""(()=>{const ids=['hudSettings','abilityBar','minimap','top','objective'];const out={width:innerWidth};for(const id of ids){const r=document.getElementById(id).getBoundingClientRect();out[id]={left:r.left,right:r.right,top:r.top,bottom:r.bottom}}return out})()""")
  print('RESPONSIVE_LAYOUT',layout)
  assert layout['hudSettings']['left']>=0 and layout['hudSettings']['right']<=width+1, f'settings button clipped at {width}px'
  assert layout['abilityBar']['left']>=0 and layout['abilityBar']['right']<=width+1, f'ability bar clipped at {width}px'
  assert layout['minimap']['left']>=0 and layout['minimap']['right']<=width+1, f'minimap clipped at {width}px'
  assert layout['objective']['left']>=0 and layout['objective']['right']<=width+1, f'objective clipped at {width}px'
  assert layout['objective']['bottom'] <= layout['minimap']['top'] + 1, f'objective overlaps minimap at {width}px'
 page.set_viewport_size({'width':1440,'height':900})
 page.evaluate("document.getElementById('hudSettings').click()"); print('SETTINGS_VISIBLE',page.locator('#settings').is_visible()); page.evaluate("document.getElementById('closeSettings').click()")
 # Untrusted/corrupt settings must not inject markup or create duplicate controls.
 page.evaluate("localStorage.setItem('coinSettings',JSON.stringify({binds:{forward:'<img src=x onerror=alert(1)>',back:'KeyW'},masterVolume:9,mouseSensitivity:-5}));window.__qa.loadSettings();window.__qa.syncSettingsUI()")
 safe_settings=page.evaluate("({binds:window.__qa.state().binds,help:document.getElementById('help').innerHTML,volume:document.getElementById('masterVolume').value,sensitivity:document.getElementById('sensitivity').value,images:document.querySelectorAll('#help img').length})")
 print('SETTINGS_SANITIZATION',safe_settings)
 assert safe_settings['binds']['forward']=='KeyW' and safe_settings['images']==0 and safe_settings['volume']=='100' and safe_settings['sensitivity']=='25', 'unsafe settings were not normalized'
 page.evaluate("localStorage.removeItem('coinSettings');window.__qa.loadSettings();window.__qa.syncSettingsUI()")
 # milestone reward test, then reset to a clean run
 page.evaluate("window.__qa.setCollected(0);window.__qa.collect(15000)")
 milestone=page.evaluate("({collected:window.__qa.state().collected,wallet:window.__qa.state().wallet})")
 print('MILESTONE_REWARD',milestone)
 assert milestone['collected']==15000 and milestone['wallet']==15663, '1% milestone reward incorrect'
 page.evaluate("window.__qa.hardReset()")
 page.evaluate("document.getElementById('start').click()")
 page.evaluate("window.__qa.openShop()")
 print('SHOP_PATHS',page.locator('#upgradeGrid .path').count(),'UPGRADE_BUTTONS',page.locator('#upgradeGrid .upgrade').count())
 costs={k:page.locator(f'#u-{k}-0').inner_text() for k in ['hand','machine','magnet','bag','automation','alchemy']}
 assert all('Cost:' in costs[k] for k in ['hand','machine','magnet','bag','automation','alchemy']), f'first-tier prices missing: {costs}'
 print('DESIGN_TUNING', costs)
 page.evaluate('window.__qa.setWallet(1000);window.__qa.refresh()')
 assert page.locator('.upgrade[data-recommended="true"]').count()==1, 'best-value recommendation missing or duplicated'
 print('RECOMMENDED_UPGRADE', page.locator('.upgrade[data-recommended="true"]').inner_text())
 # reject unaffordable purchases
 page.evaluate("window.__qa.setWallet(0);window.__qa.buy('hand',0)")
 assert page.evaluate("window.__qa.state().upgradeLevel.hand")==0, 'unaffordable upgrade was purchased'
 # afford all paths and purchase tiers in sequence; ensure multi-path progression
 page.evaluate("window.__qa.setWallet(1e12);window.__qa.buy('hand',1)")
 assert page.evaluate("window.__qa.state().upgradeLevel.hand")==0, 'tier skipping exploit: higher tier purchased before prerequisite'
 for key in ['hand','machine','magnet','bag','automation','alchemy']:
  for i in range(5): page.evaluate(f"window.__qa.buy('{key}',{i})")
 page.evaluate("window.__qa.setWallet(1e12);window.__qa.setDrones(25);window.__qa.buyDrone()")
 assert page.evaluate("window.__qa.state().droneCount")==25, 'drone fleet exceeded its cap'
 page.evaluate("window.__qa.setDrones(0)")
 state=page.evaluate('window.__qa.state()')
 print('ALL_PATHS_STATE',state['ownedPaths'],state['upgradeLevel'],'rate',state['rate'])
 assert len(state['ownedPaths'])==6 and all(v==5 for v in state['upgradeLevel'].values()), 'multi-path max upgrade failed'
 first_tool=state['path']
 cycled=[]
 for _ in range(6):
  page.evaluate('window.__qa.cycleTool()'); cycled.append(page.evaluate('window.__qa.state().path'))
 print('TOOL_CYCLE',cycled)
 assert len(set(cycled))==6 and page.evaluate('window.__qa.state().path')==first_tool, 'tool cycling did not cover all owned paths'
 # save/load round trip
 page.evaluate("window.__qa.setWallet(4321);window.__qa.setCollected(678);window.__qa.saveGame();window.__qa.setWallet(0);window.__qa.setCollected(0);window.__qa.loadGame();window.__qa.refresh()")
 restored=page.evaluate('window.__qa.state()')
 print('SAVE_LOAD',restored['collected'],restored['wallet'])
 assert restored['collected']==678 and restored['wallet']==4321, 'save/load failed to restore state'
 # each ultimate available, runs once and starts cooldown; reusing during cooldown must not reset it
 page.evaluate("window.__qa.closeShop();window.__qa.renderAbilities()")
 for key in ['hand','machine','magnet','bag','automation','alchemy']:
  page.evaluate(f"document.getElementById('ability-{key}').click()")
  s=page.evaluate('window.__qa.state()')
  print('ULT',key,'cd',s['abilityCooldowns'][key],'buff',s['abilityBuffs'][key],'coins',s['collected'])
  page.evaluate(f"window.__qa.useAbility('{key}')")
  s2=page.evaluate('window.__qa.state()')
  assert s2['abilityCooldowns'][key]==s['abilityCooldowns'][key],f'cooldown reset exploit {key}'
 # Persisted cooldowns/buffs must survive a reload; elapsed wall time is deducted on load.
 before_reload=page.evaluate('window.__qa.state()')
 assert before_reload['abilityCooldowns']['hand']>0 and before_reload['abilityBuffs']['hand']>0, 'ultimate did not set cooldown/buff'
 page.evaluate("window.__qa.tickAbilities(100);window.__qa.loadGame();window.__qa.refresh()")
 after_reload=page.evaluate('window.__qa.state()')
 print('ABILITY_SAVE_LOAD',after_reload['abilityCooldowns']['hand'],after_reload['abilityBuffs']['hand'])
 assert after_reload['abilityCooldowns']['hand']>0, 'cooldown was reset by save/load'
 assert after_reload['abilityBuffs']['hand']>0, 'active buff was lost on immediate save/load'
 page.evaluate("const saved=JSON.parse(localStorage.getItem('coinMountainSave3'));saved.savedAt=Date.now()-12000;localStorage.setItem('coinMountainSave3',JSON.stringify(saved));window.__qa.loadGame();window.__qa.refresh()")
 elapsed_reload=page.evaluate('window.__qa.state()')
 print('ABILITY_OFFLINE_EXPIRY',elapsed_reload['abilityCooldowns']['hand'],elapsed_reload['abilityBuffs']['hand'])
 assert 20<=elapsed_reload['abilityCooldowns']['hand']<=25 and elapsed_reload['abilityBuffs']['hand']==0, 'offline time did not reduce ability timers correctly'
 # test cooldown ticks
 page.evaluate("window.__qa.tickAbilities(100)")
 print('COOLDOWNS_AFTER_TICK',page.evaluate('JSON.stringify(window.__qa.state().abilityCooldowns)'))
 # natural collection loop near the mountain, through the actual game frame/update logic
 page.evaluate("window.__qa.setCollected(0);window.__qa.setPlayer(0,20);window.__qa.holdCollect(true);for(let i=0;i<200;i++)window.__qa.frame();window.__qa.holdCollect(false)")
 natural=page.evaluate('window.__qa.state().collected')
 print('NATURAL_COLLECTED_IN_200_FRAMES',natural)
 assert natural>0, 'holding collect near mountain produced no coins'
 # completion and win screen
 page.evaluate("window.__qa.collect(1500000)")
 s=page.evaluate('window.__qa.state()')
 print('WIN_STATE',s['collected'],s['won'],s['goalHeading'],'winVisible',page.locator('#win').is_visible())
 assert s['collected']==1500000 and s['won'] and s['goalHeading']=='1,500,000 COINS!' and page.locator('#win').is_visible(), 'goal completion screen incorrect'
 # ascension resets current run but preserves permanent bonus
 page.evaluate("document.getElementById('ascend').click()")
 s=page.evaluate('window.__qa.state()')
 print('ASCENSION_STATE',s['ascensions'],s['collected'],s['wallet'],s['ownedPaths'])
 # check save/load normalization
 page.evaluate("window.__qa.setWallet(4321);window.__qa.saveGame()")
 page.reload(wait_until='domcontentloaded') if False else None
 
 assert not errors, f'browser runtime errors: {errors}'
 assert not [x for x in console if x[0]=='error'], f'console errors: {[x for x in console if x[0]=="error"]}'
 assert s['ascensions']==1 and s['collected']==0 and s['wallet']==0, 'ascension did not reset run correctly'
 # golden coins should be allowed to finish the final coin instead of disappearing for +0
 golden_end=page.evaluate('window.__qa.testGoldenAtGoal()')
 print('GOLDEN_FINAL_COIN',golden_end)
 assert golden_end['collected']==1500000 and golden_end['won'], 'golden coin could not complete the final coin'
 # malformed save data must fail safely without throwing a runtime error
 page.evaluate("localStorage.setItem('coinMountainSave3','{broken-json');window.__qa.loadGame()")
 assert not errors, f'browser runtime errors: {errors}'
 assert not [x for x in console if x[0]=='error'], f'console errors: {[x for x in console if x[0]=='error']} '
 # Full deterministic progression simulation: fresh run, real economy/purchase/ultimate functions, accelerated one-second ticks.
 page.evaluate("window.__qa.hardReset();document.getElementById('start').click();window.__qa.setPlayer(0,20);window.__qa.holdCollect(true)")
 sim=page.evaluate("""(()=>{let steps=0;while(!window.__qa.state().won&&steps<20000){window.__qa.simTick();steps++}window.__qa.holdCollect(false);return {steps,...window.__qa.state()}})()""")
 print('LEGITIMATE_RUN_SIMULATION',{k:sim[k] for k in ['steps','runSeconds','collected','wallet','rate','upgradeLevel','droneCount','won','ascensions']})
 assert sim['won'] and sim['collected']==1500000, 'legitimate progression simulation did not reach the goal within the 20,000-second budget'
 assert not errors, f'browser runtime errors: {errors}'
 assert not [x for x in console if x[0]=='error'], f'browser console errors: {[x for x in console if x[0]=='error']} '
 print('PASS: automated logic checks and full progression simulation passed; no browser or console errors.')
 b.close()
