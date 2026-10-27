from pathlib import Path
import base64, json, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts'
OUT.mkdir(exist_ok=True)
proc = subprocess.Popen(
    ['npm', 'run', 'preview', '--', '--host', '127.0.0.1'],
    cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
)
url = 'http://127.0.0.1:4173/'

def capture_screenshot(page, path):
    # Playwright's screenshot() waits for document.fonts.ready. This game has
    # a continuously animated WebGL scene and that wait hangs in headless CI.
    # Capture directly through Chromium's DevTools protocol instead.
    session = page.context.new_cdp_session(page)
    try:
        image_data = session.send('Page.captureScreenshot', {
            'format': 'png',
            'captureBeyondViewport': False,
            'fromSurface': True
        })['data']
        Path(path).write_bytes(base64.b64decode(image_data))
    finally:
        session.detach()

try:
    ready = False
    for _ in range(60):
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    ready = True
                    break
        except Exception:
            time.sleep(0.5)
    if not ready:
        raise RuntimeError('Vite preview server did not become ready on localhost')

    errors, console_errors, metrics = [], [], {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=[
            '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist',
            '--use-gl=angle', '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader'
        ])
        page = browser.new_page(viewport={'width': 1280, 'height': 720}, device_scale_factor=1)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        # SwiftShader is a software renderer in CI; use Low to exercise the real scene without software-shadow bottlenecks.
        page.add_init_script("try { if (location.origin !== 'null') localStorage.setItem('coinSettings', JSON.stringify({quality:'low'})); } catch (e) {}")
        page.goto(url + '?qa=1', wait_until='networkidle', timeout=45000)
        page.wait_for_timeout(2500)

        metrics['title'] = page.title()
        metrics['menuVisible'] = page.locator('#menu').is_visible()
        metrics['startDisabled'] = page.locator('#start').is_disabled()
        metrics['canvasCount'] = page.locator('canvas').count()
        metrics['canvasInfo'] = page.locator('canvas').first.evaluate(
            'c => { const gl2=c.getContext("webgl2"); const gl=gl2 ? null : c.getContext("webgl"); return {width:c.width,height:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight,webgl2:!!gl2,webgl:!!gl}; }'
        )
        if metrics['startDisabled']:
            raise RuntimeError('Start button disabled: engine initialization failed')
        if not (metrics['canvasInfo']['webgl2'] or metrics['canvasInfo']['webgl']):
            raise RuntimeError('No WebGL/WebGL2 context on the renderer canvas')

        capture_screenshot(page, OUT / 'real-webgl-startup.png')
        page.locator('#start').click()
        page.wait_for_timeout(1200)
        metrics['menuHiddenAfterStart'] = not page.locator('#menu').is_visible()
        capture_screenshot(page, OUT / 'real-webgl-gameplay.png')
        if not metrics['menuHiddenAfterStart']:
            raise RuntimeError('Start button did not dismiss the main menu')

        # QA-only spawn begins just inside the real collection radius, so this verifies input and economy without requiring software-rendered frames to simulate walking across the whole arena.
        before_coins = page.locator('#collected').inner_text()
        page.keyboard.down('w')
        page.wait_for_timeout(250)
        page.keyboard.up('w')
        page.keyboard.down('e')
        page.wait_for_timeout(5000)
        page.keyboard.up('e')
        page.wait_for_timeout(250)
        after_coins = page.locator('#collected').inner_text()
        metrics['collectionBefore'] = before_coins
        metrics['collectionAfter'] = after_coins
        if after_coins == before_coins:
            raise RuntimeError('Holding W to approach the mountain and E to collect did not change the coin counter')

        # Verify the settings overlay remains reachable and responsive after starting a run.
        page.locator('#hudSettings').click()
        metrics['settingsOpensInGameplay'] = page.locator('#settings').is_visible()
        if not metrics['settingsOpensInGameplay']:
            raise RuntimeError('HUD settings button did not open settings during gameplay')
        page.locator('#closeSettings').click()
        metrics['settingsCloses'] = not page.locator('#settings').is_visible()
        if not metrics['settingsCloses']:
            raise RuntimeError('Settings close button did not close the overlay')
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(150)
        metrics['mobileCanvasVisible'] = page.locator('canvas').first.is_visible()
        if not metrics['mobileCanvasVisible']:
            raise RuntimeError('Renderer canvas disappeared at mobile viewport size')
        page.set_viewport_size({'width': 1280, 'height': 720})

        metrics['rafFps'] = page.evaluate(
            "async()=>{let n=0;let start=performance.now();return await new Promise(resolve=>{function f(t){n++;if(t-start>=2500)resolve({frames:n,elapsedMs:Math.round(t-start),fps:Math.round(n*1000/(t-start)*10)/10});else requestAnimationFrame(f)}requestAnimationFrame(f)})}"
        )
        metrics['pageErrors'] = errors
        metrics['consoleErrors'] = console_errors
        browser.close()

    (OUT / 'real-webgl-smoke-results.json').write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))
    if errors:
        raise SystemExit('FAIL: JavaScript page errors observed')
    print('PASS: real-browser WebGL smoke test completed')
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
