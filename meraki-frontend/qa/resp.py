import asyncio, re
from playwright.async_api import async_playwright
BASE='http://localhost:4173'
import importlib.util,sys
spec=importlib.util.spec_from_file_location('s',__import__('os').path.join(__import__('os').path.dirname(__file__),'smoke.py'))
src=open(__import__('os').path.join(__import__('os').path.dirname(__file__),'smoke.py')).read(); ROUTES=eval(src.split('ROUTES=')[1].split('\n}')[0]+'\n}')
NAMES={'user_owner':'Pawan Kushwah','user_anita':'Anita Desai','user_rahul':'Rahul Sharma'}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=__import__('os').environ.get('CHROMIUM_PATH') or None)
        bad=[]
        for w in [360,768,1024,1440]:
            ctx=await b.new_context(viewport={'width':w,'height':860}); page=await ctx.new_page()
            await page.goto(BASE+'/login'); await page.wait_for_timeout(500)
            o=await page.evaluate('document.documentElement.scrollWidth-innerWidth')
            if o>1: bad.append((w,'/login',o))
            if w in (360,1440): await page.screenshot(path=f'/tmp/shot_login_{w}.png')
            for uid,routes in ROUTES.items():
                await page.goto(BASE+'/login'); await page.wait_for_timeout(300)
                if '/login' in page.url:
                    await page.get_by_role('button',name=NAMES[uid]).first.click(); await page.wait_for_timeout(700)
                else:
                    await page.evaluate("localStorage.clear()")
                    await page.goto(BASE+'/login'); await page.wait_for_timeout(400)
                    await page.get_by_role('button',name=NAMES[uid]).first.click(); await page.wait_for_timeout(700)
                for r in routes:
                    await page.goto(BASE+r); await page.wait_for_timeout(650)
                    o=await page.evaluate('document.documentElement.scrollWidth-innerWidth')
                    if o>1: bad.append((w,r,o))
                    key={'/owner/dashboard':'owner','/manager/dashboard':'mgr','/student/home':'stu','/manager/rooms':'rooms','/owner/finance':'fin'}.get(r)
                    if key and w in (360,1440): await page.screenshot(path=f'/tmp/shot_{key}_{w}.png', full_page=True)
            await ctx.close()
        print('OVERFLOWS:', bad)
        await b.close()
asyncio.run(main())
