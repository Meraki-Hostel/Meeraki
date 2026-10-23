import asyncio, json
from playwright.async_api import async_playwright
BASE='http://localhost:4173'
import os; EXE=os.environ.get('CHROMIUM_PATH') or None
ROUTES={
 'user_owner':['/owner/dashboard','/owner/properties','/owner/properties/new','/owner/properties/prop_crown','/owner/properties/prop_crown?tab=rooms','/owner/properties/prop_crown?tab=residents','/owner/properties/prop_crown?tab=finance','/owner/properties/prop_crown?tab=activity','/owner/analytics','/owner/finance','/owner/staff','/owner/complaints','/owner/events','/owner/inventory','/owner/plans','/owner/settings','/notifications','/profile','/help'],
 'user_anita':['/manager/dashboard','/manager/rooms','/manager/students','/manager/students/stu_rahul','/manager/students/stu_rahul?tab=payments','/manager/students/stu_rahul?tab=documents','/manager/students/stu_rahul?tab=requests','/manager/payments','/manager/complaints','/manager/leave','/manager/visitors','/manager/maintenance','/manager/inventory','/manager/staff','/manager/announcements','/manager/events','/manager/feedback','/manager/activity','/notifications','/profile','/help'],
 'user_rahul':['/student/home','/student/profile','/student/rent','/student/complaints','/student/leave','/student/visitors','/student/notices','/student/documents','/student/feedback','/student/emergency','/notifications','/profile','/help'],
}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=EXE)
        results=[]
        # public
        ctx=await b.new_context(); page=await ctx.new_page()
        errs=[]; page.on('pageerror',lambda e: errs.append(str(e))); page.on('console',lambda m: m.type=='error' and errs.append(m.text))
        for r in ['/','/login','/forgot-password','/reset-password?token=abc','/reset-password','/invite/accept','/invite/accept?token=demo-invite-2026','/invite/accept?token=expired-invite','/invite/accept?token=nope','/unauthorized','/help','/does-not-exist','/owner/dashboard']:
            errs.clear(); await page.goto(BASE+r); await page.wait_for_timeout(700)
            h=await page.locator('h1,h2').first.text_content() if await page.locator('h1,h2').count() else ''
            results.append(('public',r,page.url.replace(BASE,''),h.strip()[:50],list(errs)))
        await ctx.close()
        for uid,routes in ROUTES.items():
            ctx=await b.new_context(viewport={'width':1366,'height':900}); page=await ctx.new_page()
            errs=[]; page.on('pageerror',lambda e: errs.append(str(e))); page.on('console',lambda m: m.type=='error' and errs.append(m.text))
            await page.goto(BASE+'/login'); await page.wait_for_timeout(500)
            # click persona by name
            names={'user_owner':'Pawan Kushwah','user_anita':'Anita Desai','user_rahul':'Rahul Sharma'}
            await page.get_by_role('button',name=names[uid]).first.click(); await page.wait_for_timeout(900)
            results.append((uid,'login',page.url.replace(BASE,''),'',list(errs)))
            for r in routes:
                errs.clear(); await page.goto(BASE+r); await page.wait_for_timeout(900)
                h=(await page.locator('main h1').first.text_content()) if await page.locator('main h1').count() else '(no h1)'
                results.append((uid,r,page.url.replace(BASE,''),h.strip()[:50],list(errs)))
            # cross-role guard
            for r in ['/owner/dashboard','/manager/rooms','/student/home']:
                await page.goto(BASE+r); await page.wait_for_timeout(500)
                results.append((uid,'guard '+r,page.url.replace(BASE,''),'',[]))
            await ctx.close()
        await b.close()
        for x in results: print(x)
asyncio.run(main())
