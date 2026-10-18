import asyncio
from playwright.async_api import async_playwright
B='http://localhost:4173'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=__import__('os').environ.get('CHROMIUM_PATH') or None); page=await b.new_page(viewport={'width':1280,'height':860})
        await page.goto(B+'/login'); await page.wait_for_timeout(500)
        seen=[]
        for _ in range(8):
            await page.keyboard.press('Tab')
            seen.append(await page.evaluate("(()=>{const e=document.activeElement;const o=getComputedStyle(e).outlineStyle;return (e.getAttribute('aria-label')||e.textContent||e.placeholder||e.tagName).trim().slice(0,22)+' | outline:'+o})()"))
        print('LOGIN TAB ORDER:', seen)
        await page.get_by_role('button', name='Anita Desai').first.click(); await page.wait_for_timeout(800)
        await page.goto(B+'/manager/maintenance'); await page.wait_for_timeout(700)
        btn=page.get_by_role('button', name='New ticket'); await btn.focus(); await page.keyboard.press('Enter'); await page.wait_for_timeout(400)
        inside=[]
        for _ in range(25):
            await page.keyboard.press('Tab'); inside.append(await page.evaluate("!!document.activeElement.closest('[role=dialog]')"))
        print('FOCUS TRAPPED IN DIALOG:', all(inside))
        await page.keyboard.press('Escape'); await page.wait_for_timeout(300)
        print('DIALOG CLOSED ON ESC:', await page.get_by_role('dialog').count()==0)
        print('FOCUS RESTORED TO OPENER:', await page.evaluate("document.activeElement.textContent.trim()"))
        await page.keyboard.press('Control+k'); await page.wait_for_timeout(300)
        await page.keyboard.type('leave'); await page.wait_for_timeout(300); await page.keyboard.press('Enter'); await page.wait_for_timeout(600)
        print('CTRL+K ENTER NAVIGATED TO:', page.url.replace(B,''))
        # user menu keyboard
        await page.locator('button[aria-haspopup="menu"]').last.focus(); await page.keyboard.press('Enter'); await page.wait_for_timeout(200)
        await page.keyboard.press('ArrowDown'); f=await page.evaluate("document.activeElement.getAttribute('role')")
        await page.keyboard.press('Escape'); print('MENU ARROW NAV role:', f, '| closed:', await page.get_by_role('menu').count()==0)
        # tabs arrow keys
        await page.goto(B+'/manager/payments'); await page.wait_for_timeout(600)
        await page.get_by_role('tab', name='Dues').focus(); await page.keyboard.press('ArrowRight'); await page.wait_for_timeout(200)
        print('TABS ARROW KEY selected:', await page.get_by_role('tab', selected=True).text_content())
        # headings: exactly one h1 per page
        print('H1 COUNT payments:', await page.locator('h1').count())
        await b.close()
asyncio.run(main())
