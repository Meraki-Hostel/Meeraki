import type { IAnalyticsService, ISearchService, ISettingsService, SearchResult, TrendPoint } from '../interfaces';
import { invalid, notFound } from '../errors';
import { clone, ctx, db, delay, logActivity, mutate, propertyStats, requireRole, scopeProperty, withBalance } from './base';
import { summarize } from './payments';
import { repository } from '../repository';
import { addDays, currentPeriod, todayISO } from '@/lib/clock';
import { formatPeriodShort } from '@/lib/format';
import { isEmail, isIndianPhone } from '@/lib/validation';

function prevPeriod(p: string, n = 1): string {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(y!, m! - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const mockAnalyticsService: IAnalyticsService = {
  async ownerOverview(period = currentPeriod()) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner');
    const s = db();
    const stats = s.properties.map((p) => propertyStats(s, p, period));
    const beds = stats.reduce((a, x) => a + x.beds, 0);
    const occupied = stats.reduce((a, x) => a + x.occupiedBeds, 0);
    const collection = summarize(s.charges.filter((x) => x.period === period).map((x) => withBalance(s, x)));
    const last = summarize(s.charges.filter((x) => x.period === prevPeriod(period)).map((x) => withBalance(s, x)));
    return {
      properties: s.properties.length, activeProperties: s.properties.filter((p) => p.status === 'active').length,
      rooms: s.rooms.length, beds, occupiedBeds: occupied,
      students: s.students.filter((x) => x.status === 'active' || x.status === 'notice').length,
      occupancyPct: beds ? Math.round((occupied / beds) * 100) : 0,
      expectedRent: collection.expected, collection, lastMonthCollectionPct: last.collectionPct,
    };
  },
  async trends({ propertyId, months }) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const pid = scopeProperty(c, propertyId);
    const s = db();
    const end = currentPeriod();
    const periods = Array.from({ length: months }, (_, i) => prevPeriod(end, months - 1 - i));
    const props = s.properties.filter((p) => !pid || p.id === pid);
    return periods.map<TrendPoint>((period) => {
      const live = s.charges.some((x) => x.period === period);
      let expected = 0; let collected = 0; let occSum = 0; let occN = 0; let complaints = 0;
      for (const p of props) {
        if (live) {
          const ch = s.charges.filter((x) => x.propertyId === p.id && x.period === period).map((x) => withBalance(s, x));
          expected += ch.reduce((a, x) => a + x.amount, 0);
          collected += ch.reduce((a, x) => a + Math.min(x.paid, x.amount), 0);
          complaints += s.complaints.filter((x) => x.propertyId === p.id && x.createdAt.slice(0, 7) === period).length;
          if (period === end) { const st = propertyStats(s, p); if (st.beds) { occSum += st.occupancyPct; occN++; } }
          else { const h = s.history.find((x) => x.propertyId === p.id && x.period === period); if (h) { occSum += h.occupancyPct; occN++; } else { const st = propertyStats(s, p); if (st.beds && st.occupiedBeds) { occSum += Math.max(0, st.occupancyPct - 2); occN++; } } }
        } else {
          const h = s.history.find((x) => x.propertyId === p.id && x.period === period);
          if (!h) continue;
          expected += h.expected; collected += h.collected; complaints += h.complaints; occSum += h.occupancyPct; occN++;
        }
      }
      return { period, label: formatPeriodShort(period), occupancyPct: occN ? Math.round(occSum / occN) : 0, expected, collected, arrears: Math.max(0, expected - collected), complaints };
    });
  },
  async propertyComparison() {
    await delay();
    const c = ctx();
    requireRole(c, 'owner');
    const s = db();
    return s.properties.map((p) => ({ ...clone(p), stats: propertyStats(s, p) }));
  },
  async managerOverview() {
    await delay();
    const c = ctx();
    requireRole(c, 'manager');
    const s = db();
    const p = s.properties.find((x) => x.id === c.propertyId);
    if (!p) throw notFound('Assigned property');
    const today = todayISO();
    return {
      property: { ...clone(p), stats: propertyStats(s, p) },
      collection: summarize(s.charges.filter((x) => x.propertyId === p.id && x.period === currentPeriod()).map((x) => withBalance(s, x))),
      openComplaints: s.complaints.filter((x) => x.propertyId === p.id && (x.status === 'open' || x.status === 'in_progress')).length,
      urgentComplaints: s.complaints.filter((x) => x.propertyId === p.id && x.priority === 'urgent' && x.status !== 'resolved' && x.status !== 'closed').length,
      pendingLeaves: s.leaves.filter((x) => x.propertyId === p.id && x.status === 'pending').length,
      visitorsToday: s.visitors.filter((x) => x.propertyId === p.id && x.visitDate === today && x.status !== 'rejected' && x.status !== 'cancelled').length,
      openMaintenance: s.maintenance.filter((x) => x.propertyId === p.id && x.status !== 'completed').length,
      lowStock: s.inventory.filter((x) => x.propertyId === p.id && x.quantity <= x.reorderLevel).length,
      departuresThisWeek: s.leaves.filter((x) => x.propertyId === p.id && x.status === 'approved' && x.from >= today && x.from <= addDays(today, 7)).length,
    };
  },
};

export const mockSettingsService: ISettingsService = {
  async get() {
    await delay(80);
    ctx();
    return clone(db().settings);
  },
  async update(patch) {
    await delay(300);
    const c = ctx();
    requireRole(c, 'owner');
    const e: Record<string, string> = {};
    if (patch.orgName !== undefined && patch.orgName.trim().length < 2) e.orgName = 'Organization name is required';
    if (patch.contactEmail !== undefined && !isEmail(patch.contactEmail)) e.contactEmail = 'Enter a valid email address';
    if (patch.contactPhone !== undefined && !isIndianPhone(patch.contactPhone)) e.contactPhone = 'Enter a 10-digit Indian mobile number';
    if (patch.gstin !== undefined && patch.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(patch.gstin.toUpperCase())) e.gstin = 'Enter a valid 15-character GSTIN';
    if (patch.rentDueDay !== undefined && !(patch.rentDueDay >= 1 && patch.rentDueDay <= 28)) e.rentDueDay = 'Choose a day between 1 and 28';
    if (patch.lateFeePerDay !== undefined && !(patch.lateFeePerDay >= 0)) e.lateFeePerDay = 'Late fee cannot be negative';
    if (Object.keys(e).length) throw invalid(e);
    mutate((s) => {
      s.settings = { ...s.settings, ...patch, gstin: (patch.gstin ?? s.settings.gstin).toUpperCase() };
      if (patch.orgName) s.organization.name = patch.orgName;
      logActivity(s, c, 'settings', 'Updated organization settings');
    });
    return clone(db().settings);
  },
  async planUsage() {
    await delay(100);
    const c = ctx();
    requireRole(c, 'owner');
    const s = db();
    return { plan: clone(s.plans.find((p) => p.id === s.organization.planId)!), plans: clone(s.plans), properties: s.properties.length, beds: s.beds.length, staff: s.staff.filter((x) => x.status !== 'inactive').length };
  },
  async changePlan(planId) {
    await delay(500);
    const c = ctx();
    requireRole(c, 'owner');
    const s0 = db();
    const plan = s0.plans.find((p) => p.id === planId);
    if (!plan) throw notFound('Plan');
    if (s0.properties.length > plan.propertyLimit || s0.beds.length > plan.bedLimit) throw invalid({ planId: `${plan.name} supports up to ${plan.propertyLimit} properties and ${plan.bedLimit} beds. Your portfolio is larger.` });
    mutate((s) => { s.organization.planId = planId; logActivity(s, c, 'settings', `Switched plan to ${plan.name} (demo, no billing)`); });
    return mockSettingsService.planUsage();
  },
  async resetDemoData() {
    await delay(300);
    repository.reset();
  },
};

const PAGES: Record<string, Array<[string, string]>> = {
  owner: [['Dashboard', '/owner/dashboard'], ['Properties', '/owner/properties'], ['Add property', '/owner/properties/new'], ['Analytics', '/owner/analytics'], ['Finance', '/owner/finance'], ['Staff', '/owner/staff'], ['Complaints', '/owner/complaints'], ['Events', '/owner/events'], ['Inventory', '/owner/inventory'], ['Plans', '/owner/plans'], ['Settings', '/owner/settings']],
  manager: [['Dashboard', '/manager/dashboard'], ['Rooms & beds', '/manager/rooms'], ['Students', '/manager/students'], ['Payments', '/manager/payments'], ['Complaints', '/manager/complaints'], ['Leave', '/manager/leave'], ['Visitors', '/manager/visitors'], ['Maintenance', '/manager/maintenance'], ['Inventory', '/manager/inventory'], ['Staff', '/manager/staff'], ['Announcements', '/manager/announcements'], ['Events', '/manager/events'], ['Feedback', '/manager/feedback'], ['Activity', '/manager/activity']],
  student: [['Home', '/student/home'], ['My profile', '/student/profile'], ['Rent & receipts', '/student/rent'], ['Complaints', '/student/complaints'], ['Leave', '/student/leave'], ['Visitors', '/student/visitors'], ['Notices', '/student/notices'], ['Documents', '/student/documents'], ['Feedback', '/student/feedback'], ['Emergency', '/student/emergency']],
};

export const mockSearchService: ISearchService = {
  async search(query) {
    await delay(60);
    const c = ctx();
    const q = query.trim().toLowerCase();
    const s = db();
    const out: SearchResult[] = [];
    const base = c.role === 'owner' ? '/owner' : '/manager';
    PAGES[c.role]!.forEach(([t, link]) => { if (!q || t.toLowerCase().includes(q)) out.push({ id: `page_${link}`, kind: 'page', title: t, subtitle: 'Go to page', link }); });
    out.push(...[['Notifications', '/notifications'], ['Help & support', '/help'], ['Profile', '/profile']].filter(([t]) => !q || t!.toLowerCase().includes(q)).map(([t, link]) => ({ id: `page_${link}`, kind: 'page' as const, title: t!, subtitle: 'Go to page', link: link! })));
    if (!q) return out.slice(0, 8);
    if (c.role !== 'student') {
      const pid = scopeProperty(c);
      s.students.filter((x) => (!pid || x.propertyId === pid) && `${x.name} ${x.studentCode} ${x.phone}`.toLowerCase().includes(q)).slice(0, 6)
        .forEach((x) => out.push({ id: x.id, kind: 'student', title: x.name, subtitle: `${x.studentCode} · ${s.rooms.find((r) => r.id === x.roomId)?.number ? `Room ${s.rooms.find((r) => r.id === x.roomId)!.number}` : 'No bed'} · ${s.properties.find((p) => p.id === x.propertyId)?.name}`, link: c.role === 'manager' ? `/manager/students/${x.id}` : `/owner/properties/${x.propertyId}` }));
      s.rooms.filter((r) => (!pid || r.propertyId === pid) && `room ${r.number}`.includes(q)).slice(0, 4)
        .forEach((r) => out.push({ id: r.id, kind: 'room', title: `Room ${r.number}`, subtitle: `${s.properties.find((p) => p.id === r.propertyId)?.name} · Floor ${r.floor}`, link: c.role === 'manager' ? `/manager/rooms?room=${r.id}` : `/owner/properties/${r.propertyId}?tab=rooms` }));
      s.complaints.filter((x) => (!pid || x.propertyId === pid) && `${x.ticketNo} ${x.title}`.toLowerCase().includes(q)).slice(0, 4)
        .forEach((x) => out.push({ id: x.id, kind: 'complaint', title: x.title, subtitle: x.ticketNo, link: `${base}/complaints?id=${x.id}` }));
      s.staff.filter((x) => (!pid || x.propertyId === pid) && x.name.toLowerCase().includes(q)).slice(0, 3)
        .forEach((x) => out.push({ id: x.id, kind: 'staff', title: x.name, subtitle: x.role, link: `${base}/staff` }));
      s.payments.filter((x) => (!pid || x.propertyId === pid) && x.receiptNo.toLowerCase().includes(q)).slice(0, 3)
        .forEach((x) => out.push({ id: x.id, kind: 'payment', title: x.receiptNo, subtitle: `₹${x.amount.toLocaleString('en-IN')}`, link: c.role === 'manager' ? `/manager/payments?receipt=${x.id}` : `/owner/finance?receipt=${x.id}` }));
      if (c.role === 'owner') s.properties.filter((p) => `${p.name} ${p.locality}`.toLowerCase().includes(q)).forEach((p) => out.push({ id: p.id, kind: 'property', title: p.name, subtitle: p.locality, link: `/owner/properties/${p.id}` }));
    } else {
      const st = s.students.find((x) => x.id === c.studentId)!;
      s.complaints.filter((x) => x.studentId === st.id && `${x.ticketNo} ${x.title}`.toLowerCase().includes(q)).forEach((x) => out.push({ id: x.id, kind: 'complaint', title: x.title, subtitle: x.ticketNo, link: `/student/complaints?id=${x.id}` }));
      s.announcements.filter((a) => a.propertyId === st.propertyId && a.status === 'published' && a.title.toLowerCase().includes(q)).forEach((a) => out.push({ id: a.id, kind: 'notice', title: a.title, subtitle: 'Notice', link: '/student/notices' }));
    }
    return out.slice(0, 20);
  },
};
