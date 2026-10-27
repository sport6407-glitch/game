from pathlib import Path
import json, os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'; OUT.mkdir(exist_ok=True)
proc=subprocess.Popen(['npm','run','preview','--','--host','127.0.0.1'],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
url='http://127.0.0.1:4173/'
try:
    ready=False
    for _ in range(60):
        try:
            with urllib.request.urlopen(url,timeout=1) as r:
                if r.status==200: ready=True; break
        except Exception: time.sleep(.5)
    if not ready: raise RuntimeError('Vite preview server did not become ready on localhost')
    errors=[]; console_errors=[]; metrics={}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.on('console',lambda m: console_errors.append(m.text) if m.type=='error' else None)
        page.goto(url,wait_until='networkidle',timeout=45000)
        page.wait_for_timeout(2500)
        metrics['title']=page.title()
        metrics['menuVisible']=page.locator('#menu').is_visible()
        metrics['startDisabled']=page.locator('#start').is_disabled()
        metrics['canvasCount']=page.locator('canvas').count()
        metrics['canvasInfo']=page.locator('canvas').first.evaluate('c=>({width:c.width,height:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight,webgl2:!!c.getContext("webgl2"),webgl:!!c.getContext("webgl")})')
        if metrics['startDisabled']: raise RuntimeError('Start button disabled: engine initialization failed')
        if not metrics['canvasInfo']['webgl2'] and not metrics['canvasInfo']['webgl']: raise RuntimeError('No WebGL/WebGL2 context on the renderer canvas')
        page.screenshot(path=str(OUT/'real-webgl-startup.png'),full_page=False)
        page.locator('#start').click()
        page.wait_for_timeout(1200)
        metrics['menuHiddenAfterStart']=not page.locator('#menu').is_visible()
        page.screenshot(path=str(OUT/'real-webgl-gameplay.png'),full_page=False)
        metrics['rafFps']=page.evaluate("async()=>{let n=0;let start=performance.now();return await new Promise(resolve=>{function f(t){n++;if(t-start>=2500)resolve({frames:n,elapsedMs:Math.round(t-start),fps:Math.round(n*1000/(t-start)*10)/10});else requestAnimationFrame(f)}requestAnimationFrame(f)})}")
        metrics['pageErrors']=errors
        metrics['consoleErrors']=console_errors
        browser.close()
    (OUT/'real-webgl-smoke-results.json').write_text(json.dumps(metrics,indent=2))
    print(json.dumps(metrics,indent=2))
    if errors: raise SystemExit('FAIL: JavaScript page errors observed')
    if metrics['startDisabled'] or not (metrics['canvasInfo']['webgl2'] or metrics['canvasInfo']['webgl']): raise SystemExit('FAIL: renderer did not initialize with WebGL')
    print('PASS: real-browser WebGL smoke test completed')
finally:
    proc.terminate()
    try: proc.wait(timeout=5)
    except subprocess.TimeoutExpired: proc.kill()
