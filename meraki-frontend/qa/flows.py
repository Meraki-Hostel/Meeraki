import asyncio, re
from playwright.async_api import async_playwright, expect
BASE='http://localhost:4173'; import os; EXE=os.environ.get('CHROMIUM_PATH') or None
log=[]
def ok(msg): log.append('PASS '+msg); print('PASS', msg, flush=True)
async def persona(page, name):
    await page.goto(BASE+'/login'); await page.wait_for_timeout(300)
    if '/login' not in page.url:
        await page.get_by_role('button', name=re.compile('Account menu|Pawan|Anita|Rahul')).first.click() if False else None
        # log out via user menu
        await page.locator('button[aria-haspopup="menu"]').last.click()
        await page.get_by_role('menuitem', name='Log out').click(); await page.wait_for_url('**/login')
    await page.get_by_role('button', name=re.compile(name)).first.click(); await page.wait_for_timeout(800)
async def toast(page, text):
    await expect(page.locator('[role=status],[role=alert]').filter(has_text=re.compile(text))).to_be_visible(timeout=4000)

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=EXE)
        ctx=await b.new_context(viewport={'width':1366,'height':900}); page=await ctx.new_page()
        errs=[]; page.on('pageerror',lambda e: errs.append(str(e)))
        # ---- Password login validation + role mismatch
        await page.goto(BASE+'/login')
        await page.get_by_role('button', name=re.compile('^Sign in')).click()
        await expect(page.get_by_text('Email or phone number is required')).to_be_visible(); ok('login inline validation')
        await page.get_by_label('Email or phone number').fill('rahul.sharma@student.example'); await page.get_by_label(re.compile('^Password')).fill('meraki@123')
        await page.get_by_role('button', name=re.compile('^Sign in')).click()
        await expect(page.get_by_text(re.compile('registered as Student'))).to_be_visible(); ok('role mismatch message')
        await page.get_by_role('radio', name='Student').click(); await page.get_by_role('button', name=re.compile('^Sign in')).click()
        await page.wait_for_url('**/student/home'); ok('password login -> student home')

        # ---- Student: complaint, leave, visitor, pay
        await page.goto(BASE+'/student/complaints?new=1')
        await page.get_by_label('Title').fill('Window latch broken in 204'); await page.get_by_label('Details').fill('The window latch near bed B does not lock since yesterday.')
        await page.get_by_role('button', name='Submit complaint').click(); await toast(page,'raised'); ok('student raised complaint')
        await page.keyboard.press('Escape')
        await page.goto(BASE+'/student/leave')
        await page.get_by_label('Leaving on').fill('2026-10-30'); await page.get_by_label('Returning on').fill('2026-11-02')
        await page.get_by_label('Destination').fill('Kanpur (home)'); await page.get_by_label('Reason').fill('Diwali with family')
        await page.get_by_role('button', name='Send request').click(); await toast(page,'Leave request sent'); ok('student leave request')
        await page.goto(BASE+'/student/visitors')
        await page.get_by_label('Visitor name').fill('Neeraj Sharma'); await page.get_by_label('Visitor phone').fill('9935011122'); await page.get_by_label('Time').fill('15:00')
        await page.get_by_role('button', name='Request visit').click(); await toast(page,'Visit requested'); ok('student visitor request')
        await page.goto(BASE+'/student/rent')
        await page.get_by_role('button', name=re.compile('Pay ₹')).first.click()
        await page.get_by_role('dialog').get_by_role('button', name=re.compile('Pay ₹')).click()
        await expect(page.get_by_role('dialog').get_by_text('Simulated payment')).to_be_visible(timeout=5000); ok('student simulated pay-now')
        await page.get_by_role('dialog').get_by_role('button', name='View receipt', exact=True).click(); await expect(page.get_by_role('dialog', name='Payment receipt')).to_be_visible(); ok('receipt preview')
        await page.keyboard.press('Escape'); await page.wait_for_timeout(300)
        await expect(page.get_by_text('Outstanding').locator('..').get_by_text('₹0')).to_be_visible(); ok('student balance now ₹0')

        # ---- Manager
        await persona(page,'Anita Desai'); assert '/manager/dashboard' in page.url
        await page.goto(BASE+'/manager/complaints')
        await page.get_by_role('row', name=re.compile('Window latch')).click()
        dlg=page.get_by_role('dialog')
        await dlg.get_by_label('Status').select_option('in_progress'); await dlg.get_by_label('Assignee').select_option(label='Deepak Verma (Maintenance)')
        await dlg.get_by_label(re.compile('Note for status change')).fill('Carpenter visiting at 5 pm today.')
        await dlg.get_by_role('button', name='Save update').click(); await toast(page,'Complaint updated'); ok('manager triaged complaint')
        await page.keyboard.press('Escape')
        await page.goto(BASE+'/manager/leave')
        await page.get_by_role('row', name=re.compile('Rahul Sharma')).get_by_role('button', name='Approve').click()
        await page.get_by_role('dialog').get_by_role('button', name='Approve').click(); await toast(page,'Leave approved'); ok('manager approved leave')
        await page.goto(BASE+'/manager/visitors?tab=requests')
        await page.get_by_role('tab', name=re.compile('Requests')).click()
        await page.get_by_role('row', name=re.compile('Neeraj Sharma')).get_by_role('button', name='Approve').click(); await toast(page,'approved'); ok('manager approved visitor')
        await page.get_by_role('tab', name='Today').click()
        await page.get_by_role('row', name=re.compile('Neeraj Sharma')).get_by_role('button', name='Check in').click(); await toast(page,'checked in'); ok('manager checked in visitor')
        # payment for another resident
        await page.goto(BASE+'/manager/payments')
        await page.get_by_role('button', name='Record payment').click()
        dlg=page.get_by_role('dialog'); sel=dlg.get_by_label('Due')
        await expect(sel.locator('option').nth(1)).to_be_attached(timeout=5000)
        opts=await sel.locator('option').all_text_contents(); await sel.select_option(index=1)
        await dlg.get_by_label('Reference / UTR').fill('UTR555666777')
        await dlg.get_by_role('button', name='Record payment').click(); await toast(page,'Payment recorded'); ok(f'manager recorded payment ({opts[1][:40]})')
        await page.keyboard.press('Escape')
        # announcement targeted floor 2 (Rahul floor 2)
        await page.goto(BASE+'/manager/announcements?new=1')
        dlg=page.get_by_role('dialog'); await dlg.get_by_label('Title').fill('Lift maintenance on Friday'); await dlg.get_by_label('Message').fill('The lift will be off from 10 am to 1 pm on Friday.')
        await dlg.get_by_text('Selected floors').click(); await dlg.get_by_role('button', name='Floor 2').click()
        await dlg.get_by_role('button', name='Publish now').click(); await toast(page,'Notice published'); ok('manager published targeted notice')
        # event
        await page.goto(BASE+'/manager/events'); await page.get_by_role('button', name='Create event').first.click()
        dlg=page.get_by_role('dialog'); await dlg.get_by_label('Title').fill('Movie night on the terrace'); await dlg.get_by_label('Location').fill('Terrace')
        await dlg.get_by_role('button', name='Schedule event').click(); await toast(page,'Event scheduled'); ok('manager created event')
        # inventory negative stock blocked
        await page.goto(BASE+'/manager/inventory')
        await page.get_by_role('button', name=re.compile('^Stock out Pillow covers')).click()
        dlg=page.get_by_role('dialog'); await dlg.get_by_label(re.compile('Quantity')).fill('999'); await dlg.get_by_label('Note').fill('Issued')
        await dlg.get_by_role('button', name='Remove stock').click(); await expect(dlg.get_by_text(re.compile('cannot go negative'))).to_be_visible(); ok('negative stock blocked')
        await page.keyboard.press('Escape')
        # add student wizard with bed, then transfer
        await page.goto(BASE+'/manager/students'); await page.get_by_role('button', name='Add student').click()
        dlg=page.get_by_role('dialog')
        await dlg.get_by_label('Full name').fill('Kartik Saxena'); await dlg.get_by_label('Mobile number').fill('9876543210')  # duplicate of Rahul
        await dlg.get_by_label('Email').fill('kartik.saxena@student.example'); await dlg.get_by_label('Date of birth').fill('2005-05-05')
        await dlg.get_by_label('College').fill('Lucknow University'); await dlg.get_by_label('Course').fill('BBA')
        await dlg.get_by_role('button', name='Continue').click()
        await dlg.get_by_label('Guardian name').fill('Alok Saxena'); await dlg.get_by_label('Guardian phone').fill('9415111222')
        await dlg.get_by_label('Emergency contact name').fill('Ritu Saxena'); await dlg.get_by_label('Emergency phone').fill('9415111223')
        await dlg.get_by_label('Home address').fill('12, Civil Lines, Bareilly')
        await dlg.get_by_role('button', name='Continue').click()
        await dlg.get_by_role('radio', name=re.compile('Room 101 bed B: Available|Room 202 bed C: Available|Available')).first.click()
        await dlg.get_by_role('button', name='Continue').click(); await dlg.get_by_role('button', name='Add student').click()
        await expect(dlg.get_by_text('Another student already uses this phone number')).to_be_visible(); ok('duplicate phone blocked in wizard')
        await dlg.get_by_label('Mobile number').fill('9876500011')
        for _ in range(3): await dlg.get_by_role('button', name='Continue').click()
        await dlg.get_by_role('button', name='Add student').click(); await page.wait_for_url('**/manager/students/stu_*'); ok('wizard created student with bed')
        before=await page.locator('main h1').text_content()
        await page.get_by_role('button', name='Transfer').click()
        dlg=page.get_by_role('dialog'); occ=dlg.get_by_role('radio', name=re.compile('Occupied')).first
        assert await occ.is_disabled(); ok('occupied beds not selectable')
        await dlg.get_by_role('radio', name=re.compile(': Available')).last.click(); await dlg.get_by_role('button', name='Confirm transfer').click()
        await toast(page,'transferred'); await page.wait_for_timeout(400)
        after=await page.locator('main h1').text_content(); assert before!=after, (before,after); ok(f'transfer updated profile: {after[-30:]}')

        # ---- Student sees updates
        await persona(page,'Rahul Sharma')
        await page.goto(BASE+'/student/complaints'); await page.get_by_role('button', name=re.compile('Window latch')).click()
        await expect(page.get_by_role('dialog').get_by_text('Carpenter visiting at 5 pm today.')).to_be_visible(); ok('student sees complaint timeline update')
        await page.keyboard.press('Escape')
        await page.goto(BASE+'/student/leave'); await expect(page.locator('li', has_text='Kanpur (home)').get_by_text('Approved')).to_be_visible(); ok('student sees leave approved')
        await page.goto(BASE+'/student/visitors'); await expect(page.locator('li', has_text='Neeraj Sharma').get_by_text('Checked in')).to_be_visible(); ok('student sees visitor checked in')
        await page.goto(BASE+'/student/notices'); await expect(page.get_by_text('Lift maintenance on Friday')).to_be_visible(); ok('targeted notice in student feed')
        await page.goto(BASE+'/student/home'); await expect(page.get_by_text('Movie night on the terrace').first).to_be_visible(); ok('event on student home')
        await page.goto(BASE+'/notifications'); await expect(page.get_by_text('Leave approved').first).to_be_visible(); ok('student notifications created')

        # ---- Owner
        await persona(page,'Pawan Kushwah')
        await page.goto(BASE+'/owner/complaints'); await expect(page.get_by_role('row', name=re.compile('Window latch'))).to_be_visible(); ok('owner sees portfolio complaint')
        await page.goto(BASE+'/owner/events'); await expect(page.get_by_text('Movie night on the terrace')).to_be_visible(); ok('owner sees manager event')
        await page.goto(BASE+'/owner/properties/new')
        await page.get_by_label('Property name').fill('Lotus Residency'); await page.get_by_label('Short code').fill('LR')
        await page.get_by_label('Street address').fill('22, Ring Road, Mahanagar'); await page.get_by_label('Locality').fill('Mahanagar')
        await page.get_by_label('PIN code').fill('226006'); await page.get_by_label('Front desk phone').fill('9415099999')
        await page.get_by_role('button', name='Create property').click(); await page.wait_for_url('**/owner/properties/prop_*'); ok('owner created property')
        await page.goto(BASE+'/owner/dashboard'); await expect(page.get_by_text('Lotus Residency').first).to_be_visible(); ok('new property on dashboard')
        # settings persist after reload
        await page.goto(BASE+'/owner/settings'); await page.get_by_label('Display name').fill('Meraki Living Co.')
        await page.get_by_role('button', name='Save changes').click(); await toast(page,'Settings saved')
        await page.reload(); await page.wait_for_timeout(800); assert await page.get_by_label('Display name').input_value()=='Meraki Living Co.'; ok('settings persist after refresh')
        # Ctrl+K search
        await page.keyboard.press('Control+k'); await page.get_by_role('combobox', name='Search').fill('Rahul'); await page.wait_for_timeout(400)
        await expect(page.get_by_role('option', name=re.compile('Rahul Sharma'))).to_be_visible(); await page.keyboard.press('Escape'); ok('Ctrl+K search finds resident')
        # reset
        await page.locator('button[aria-haspopup="menu"]').last.click(); await page.get_by_role('menuitem', name='Reset demo data').click()
        await page.get_by_role('alertdialog').get_by_role('button', name='Reset demo data').click(); await toast(page,'restored')
        await page.goto(BASE+'/owner/properties'); await page.wait_for_timeout(500)
        assert await page.get_by_text('Lotus Residency').count()==0; ok('reset restored fixtures')
        await page.goto(BASE+'/owner/complaints'); assert await page.get_by_role('row', name=re.compile('Window latch')).count()==0; ok('reset removed new complaint')
        print('PAGE ERRORS:', errs)
        await b.close()
asyncio.run(main())
