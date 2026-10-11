#!/usr/bin/env python3
"""Browser regression checks. Start scripts/serve.py first; see tests/README.md."""
import os
import shutil
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'artifacts'/'website-tests';root.mkdir(parents=True,exist_ok=True)
base=os.environ.get('KINDRED_TEST_URL', 'http://127.0.0.1:8080')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('KINDRED_BROWSER_EXECUTABLE') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page()
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 for width in (320,390,768,1440):
  page.set_viewport_size({'width':width,'height':900})
  for path in ('/','/practice','/install','/guide','/404.html'):
   response=page.goto(base+path)
   assert response.status==200,(path,response.status)
   page.locator('.reading-controls summary').click()
   page.locator('[data-reading-size="largest"]').click()
   page.locator('button[data-reading-contrast]').click()
   overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
   assert not overflow,('overflow',width,path,page.evaluate('document.documentElement.scrollWidth'))
   page.locator('[data-reading-reset]').click()
  print('PASS responsive pages at',width)
 page.set_viewport_size({'width':1440,'height':1000})
 page.goto(base+'/')
 page.screenshot(path=str(root/'home.png'),full_page=True)
 page.locator('.reading-controls summary').click()
 page.locator('[data-reading-size="larger"]').click()
 page.locator('button[data-reading-contrast]').click()
 page.goto(base+'/practice')
 assert page.locator('html').get_attribute('data-reading-size')=='larger'
 assert page.locator('html').get_attribute('data-reading-contrast')=='true'
 page.locator('[data-practice-open="note"]').click()
 note=page.locator('#practice-note'); note.fill('My sample café note\nKeep these words.')
 page.locator('[data-practice-save]').click()
 assert 'own documents are unchanged' in page.locator('[data-practice-status]').inner_text()
 page.locator('[data-practice-remove]').click()
 assert page.locator('#practice-confirm').is_visible()
 assert page.locator('#practice-confirm button[value="cancel"]').evaluate('(el)=>el===document.activeElement')
 page.keyboard.press('Escape')
 assert note.input_value()=='My sample café note\nKeep these words.'
 page.locator('[data-practice-remove]').click()
 page.locator('#practice-confirm button[value="remove"]').click()
 expect(note).to_be_hidden()
 page.locator('[data-practice-undo]').click()
 expect(note).to_have_value('My sample café note\nKeep these words.')
 assert note.evaluate('(el)=>el===document.activeElement')
 page.locator('[data-practice-home]').click()
 page.locator('[data-practice-open="message"]').click()
 page.locator('[data-practice-reply]').click()
 page.locator('[data-practice-send]').click()
 assert 'No message was sent' in page.locator('[data-practice-status]').inner_text()
 page.locator('[data-practice-home]').click()
 page.locator('[data-practice-open="reading"]').click()
 page.locator('[data-practice-reading]').click()
 assert page.locator('.reading-controls').get_attribute('open') is not None
 page.locator('[data-reading-reset]').click()
 assert page.locator('html').get_attribute('data-reading-size')=='comfortable'
 page.goto(base+'/practice')
 assert page.locator('#practice-note').input_value()=='Remember to enjoy a cup of tea.'
 page.screenshot(path=str(root/'practice.png'),full_page=True)
 print('PASS practice save, cancel, remove, Undo, focus, reply, reading controls, reset, persistence and reload isolation')
 page.goto(base+'/')
 page.locator('[data-screen="assistant"]').click()
 assert page.locator('#showcase-image').get_attribute('src')=='/assets/assistant.png'
 page.locator('[data-screen="home"]').click()
 assert page.locator('[data-screen="home"]').get_attribute('aria-pressed')=='true'
 print('PASS screenshot switching')
 page.goto(base+'/install')
 page.wait_for_function("document.querySelector('[data-download=iso]').href.includes('github.com')")
 assert 'Public download' in page.locator('#release-status').inner_text()
 print('PASS release metadata loads download links')
 assert not errors, errors
 # Storage denial and failed metadata must leave the reading and practice UI useful.
 context=b.new_context()
 context.add_init_script("Object.defineProperty(window, 'localStorage', {get(){throw new Error('blocked')}})")
 blocked=context.new_page();blocked_errors=[]
 blocked.on('pageerror',lambda e:blocked_errors.append(str(e)))
 blocked.route('**/release.json',lambda route:route.fulfill(status=503,body='unavailable'))
 blocked.goto(base+'/practice')
 blocked.locator('.reading-controls summary').click()
 blocked.locator('[data-reading-size="largest"]').click()
 assert blocked.locator('html').get_attribute('data-reading-size')=='largest'
 assert 'cannot save' in blocked.locator('[data-reading-status]').inner_text()
 blocked.locator('[data-practice-open="note"]').click()
 assert blocked.locator('#practice-note').is_visible()
 blocked.goto(base+'/install')
 blocked.wait_for_function("document.querySelector('#release-status').textContent.includes('could not load')")
 assert blocked.locator('[data-download="iso"]').get_attribute('href')=='/guide'
 assert not blocked_errors,blocked_errors
 print('PASS blocked storage and metadata failure fallback')
 nojs=b.new_context(java_script_enabled=False)
 nojs_page=nojs.new_page();nojs_page.goto(base+'/practice')
 assert nojs_page.locator('noscript').is_visible()
 assert not nojs_page.locator('[data-practice]').is_visible()
 nojs_page.goto(base+'/')
 assert nojs_page.get_by_role('heading',level=1).is_visible()
 print('PASS no-JavaScript fallback')
 b.close()
