import type { IInventoryService, IMaintenanceService, IStaffService, InventoryView } from '../interfaces';
import type { DemoState, InventoryItem, MaintenanceTicket, StaffMember } from '@/types/domain';
import { ServiceError, invalid, notFound } from '../errors';
import { assertPropertyAccess, bumpCounter, clone, ctx, db, delay, logActivity, mutate, newId, notifyStaff, propertyName, requireRole, scopeProperty, staffName } from './base';
import { isEmail, isIndianPhone, normalizePhone } from '@/lib/validation';
import { addDays, nowISO } from '@/lib/clock';
import { sentenceCase } from '@/lib/format';

/* ---------------- Maintenance ---------------- */
const mView = (s: DemoState, m: MaintenanceTicket) => ({ ...clone(m), propertyName: propertyName(s, m.propertyId), assigneeName: staffName(s, m.assigneeStaffId) });

export const mockMaintenanceService: IMaintenanceService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const pid = scopeProperty(c);
    const s = db();
    return s.maintenance.filter((m) => !pid || m.propertyId === pid)
      .filter((m) => !filters.status || m.status === filters.status)
      .filter((m) => !filters.priority || m.priority === filters.priority)
      .map((m) => mView(s, m)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async create(input) {
    await delay(280);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const propertyId = scopeProperty(c, input.propertyId);
    const e: Record<string, string> = {};
    if (!propertyId) e.propertyId = 'Choose a property';
    if (input.title.trim().length < 5) e.title = 'Title must be at least 5 characters';
    if (!input.location.trim()) e.location = 'Location is required';
    if (!(input.estimatedCost >= 0)) e.estimatedCost = 'Estimated cost cannot be negative';
    if (Object.keys(e).length) throw invalid(e);
    const id = newId('mnt');
    mutate((s) => {
      const n = bumpCounter(s, 'maintenance', 220);
      const at = nowISO();
      s.maintenance.push({ id, ticketNo: `MNT-${n}`, propertyId: propertyId!, title: input.title.trim(), description: input.description.trim(), category: input.category, location: input.location.trim(), priority: input.priority, status: input.assigneeStaffId ? 'assigned' : 'open', assigneeStaffId: input.assigneeStaffId || undefined, vendor: input.vendor?.trim() || undefined, estimatedCost: input.estimatedCost, createdAt: at, updatedAt: at });
      logActivity(s, c, 'maintenance', `Created ticket MNT-${n}: ${input.title.trim()}`, propertyId, '/manager/maintenance');
    });
    return clone(db().maintenance.find((m) => m.id === id)!);
  },
  async update(id, patch) {
    await delay(220);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const m = db().maintenance.find((x) => x.id === id);
    if (!m) throw notFound('Maintenance ticket');
    assertPropertyAccess(c, m.propertyId);
    const e: Record<string, string> = {};
    if (patch.actualCost !== undefined && !(patch.actualCost >= 0)) e.actualCost = 'Actual cost cannot be negative';
    if (patch.estimatedCost !== undefined && !(patch.estimatedCost >= 0)) e.estimatedCost = 'Estimated cost cannot be negative';
    if (patch.status === 'completed' && patch.actualCost === undefined && m.actualCost === undefined) e.actualCost = 'Enter the actual cost to complete this ticket';
    if (Object.keys(e).length) throw invalid(e);
    mutate((s) => {
      const x = s.maintenance.find((y) => y.id === id)!;
      const before = x.status;
      Object.assign(x, { ...patch, assigneeStaffId: patch.assigneeStaffId === null ? undefined : patch.assigneeStaffId ?? x.assigneeStaffId });
      if (patch.assigneeStaffId && x.status === 'open') x.status = 'assigned';
      x.updatedAt = nowISO();
      logActivity(s, c, 'maintenance', `${x.ticketNo} ${before !== x.status ? `moved to ${sentenceCase(x.status)}` : 'updated'}`, x.propertyId, '/manager/maintenance');
    });
    return clone(db().maintenance.find((x) => x.id === id)!);
  },
};

/* ---------------- Inventory ---------------- */
const invView = (s: DemoState, i: InventoryItem): InventoryView => ({ ...clone(i), propertyName: propertyName(s, i.propertyId), lowStock: i.quantity <= i.reorderLevel });

export const mockInventoryService: IInventoryService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const pid = scopeProperty(c, filters.propertyId);
    const s = db();
    return s.inventory.filter((i) => !pid || i.propertyId === pid)
      .filter((i) => !filters.category || i.category === filters.category)
      .map((i) => invView(s, i))
      .filter((i) => !filters.lowStockOnly || i.lowStock)
      .sort((a, b) => Number(b.lowStock) - Number(a.lowStock) || a.name.localeCompare(b.name));
  },
  async transactions(filters = {}) {
    await delay(80);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const pid = scopeProperty(c, filters.propertyId);
    const s = db();
    return s.inventoryTxns.filter((t) => (!pid || t.propertyId === pid) && (!filters.itemId || t.itemId === filters.itemId))
      .map((t) => { const it = s.inventory.find((i) => i.id === t.itemId); return { ...clone(t), itemName: it?.name ?? 'Removed item', unit: it?.unit ?? '' }; })
      .sort((a, b) => b.at.localeCompare(a.at));
  },
  async create(input) {
    await delay(260);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const propertyId = scopeProperty(c, input.propertyId);
    const e: Record<string, string> = {};
    if (!propertyId) e.propertyId = 'Choose a property';
    if (input.name.trim().length < 2) e.name = 'Item name is required';
    if (!input.unit.trim()) e.unit = 'Unit is required';
    if (!(Number.isInteger(input.quantity) && input.quantity >= 0)) e.quantity = 'Opening stock must be a whole number, 0 or more';
    if (!(Number.isInteger(input.reorderLevel) && input.reorderLevel >= 0)) e.reorderLevel = 'Reorder level must be a whole number, 0 or more';
    if (!(input.unitCost >= 0)) e.unitCost = 'Unit cost cannot be negative';
    if (propertyId && db().inventory.some((i) => i.propertyId === propertyId && i.sku.toLowerCase() === input.sku.trim().toLowerCase())) e.sku = 'This SKU already exists at this property';
    if (Object.keys(e).length) throw invalid(e);
    const id = newId('inv');
    mutate((s) => {
      s.inventory.push({ id, propertyId: propertyId!, name: input.name.trim(), sku: input.sku.trim().toUpperCase() || id.toUpperCase(), category: input.category, unit: input.unit.trim(), quantity: input.quantity, reorderLevel: input.reorderLevel, unitCost: input.unitCost, updatedAt: nowISO() });
      logActivity(s, c, 'inventory', `Added inventory item ${input.name.trim()} (${input.quantity} ${input.unit.trim()})`, propertyId, '/manager/inventory');
    });
    return clone(db().inventory.find((i) => i.id === id)!);
  },
  async adjust({ itemId, type, quantity, note }) {
    await delay(220);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const item = db().inventory.find((i) => i.id === itemId);
    if (!item) throw notFound('Inventory item');
    assertPropertyAccess(c, item.propertyId);
    if (!(Number.isInteger(quantity) && quantity > 0)) throw invalid({ quantity: 'Enter a whole number greater than zero' });
    if (type === 'out' && quantity > item.quantity) throw invalid({ quantity: `Only ${item.quantity} ${item.unit} in stock — stock cannot go negative` });
    if (!note.trim()) throw invalid({ note: 'Add a note, e.g. “Issued to Room 204”' });
    mutate((s) => {
      const it = s.inventory.find((i) => i.id === itemId)!;
      const wasLow = it.quantity <= it.reorderLevel;
      it.quantity += type === 'in' ? quantity : -quantity;
      it.updatedAt = nowISO();
      s.inventoryTxns.push({ id: newId('itx'), itemId, propertyId: it.propertyId, type, quantity, note: note.trim(), by: c.user.name, at: nowISO() });
      logActivity(s, c, 'inventory', `Stock ${type === 'in' ? 'in' : 'out'}: ${quantity} ${it.unit} of ${it.name}`, it.propertyId, '/manager/inventory');
      if (!wasLow && it.quantity <= it.reorderLevel && s.settings.notifications.lowStock) {
        notifyStaff(s, it.propertyId, `Low stock: ${it.name}`, `${it.quantity} ${it.unit} left (reorder at ${it.reorderLevel}).`, 'inventory', '/manager/inventory', '/owner/inventory');
      }
    });
    return clone(db().inventory.find((i) => i.id === itemId)!);
  },
};

/* ---------------- Staff ---------------- */
function validateStaff(s: DemoState, input: { name?: string; phone?: string; email?: string }, id?: string) {
  const e: Record<string, string> = {};
  if (input.name !== undefined && input.name.trim().length < 3) e.name = 'Enter the full name';
  if (input.phone !== undefined) {
    if (!isIndianPhone(input.phone)) e.phone = 'Enter a 10-digit Indian mobile number';
    else if (s.staff.some((x) => x.id !== id && normalizePhone(x.phone) === normalizePhone(input.phone!))) e.phone = 'A staff member already uses this number';
  }
  if (input.email !== undefined) {
    if (!isEmail(input.email)) e.email = 'Enter a valid email address';
    else if (s.staff.some((x) => x.id !== id && x.email.toLowerCase() === input.email!.trim().toLowerCase())) e.email = 'A staff member already uses this email';
  }
  if (Object.keys(e).length) throw invalid(e);
}

export const mockStaffService: IStaffService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const pid = scopeProperty(c, filters.propertyId);
    const s = db();
    return s.staff.filter((x) => !pid || x.propertyId === pid)
      .filter((x) => !filters.role || x.role === filters.role)
      .filter((x) => !filters.status || x.status === filters.status)
      .map((x) => ({ ...clone(x), propertyName: x.propertyId ? propertyName(s, x.propertyId) : 'All properties' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async create(input) {
    await delay(300);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const propertyId = c.role === 'manager' ? c.propertyId : input.propertyId || undefined;
    if (c.role === 'manager' && input.role === 'manager') throw invalid({ role: 'Only owners can add property managers' });
    validateStaff(db(), input);
    const id = newId('staff');
    mutate((s) => {
      const m: StaffMember = { id, name: input.name.trim(), role: input.role, propertyId, phone: normalizePhone(input.phone), email: input.email.trim().toLowerCase(), shift: input.shift, status: input.sendInvite ? 'invited' : input.status ?? 'active', joinedOn: nowISO().slice(0, 10) };
      s.staff.push(m);
      if (input.sendInvite) {
        s.invitations.push({ token: `inv-${id}`, name: m.name, email: m.email, role: m.role === 'manager' ? 'manager' : 'staff', propertyId, invitedBy: c.user.name, status: 'pending', expiresAt: `${addDays(nowISO().slice(0, 10), 7)}T23:59:00.000Z` });
      }
      if (m.role === 'manager' && propertyId) {
        const p = s.properties.find((x) => x.id === propertyId);
        if (p && !p.managerStaffId) p.managerStaffId = id;
      }
      logActivity(s, c, 'staff', `${input.sendInvite ? 'Invited' : 'Added'} ${m.name} as ${m.role}${propertyId ? ` at ${propertyName(s, propertyId)}` : ''}`, propertyId, c.role === 'owner' ? '/owner/staff' : '/manager/staff');
    });
    return clone(db().staff.find((x) => x.id === id)!);
  },
  async update(id, input) {
    await delay(240);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const m = db().staff.find((x) => x.id === id);
    if (!m) throw notFound('Staff member');
    if (c.role === 'manager') {
      if (m.propertyId !== c.propertyId) throw new ServiceError('FORBIDDEN', 'You can only edit staff at your property.');
      if (m.role === 'manager' || input.role === 'manager') throw new ServiceError('FORBIDDEN', 'Only owners can change manager records.');
      if (input.propertyId && input.propertyId !== c.propertyId) throw new ServiceError('FORBIDDEN', 'Only owners can move staff between properties.');
    }
    validateStaff(db(), input, id);
    mutate((s) => {
      const x = s.staff.find((y) => y.id === id)!;
      const { sendInvite: _ignored, ...rest } = input;
      void _ignored;
      Object.assign(x, rest, input.phone ? { phone: normalizePhone(input.phone) } : {});
      if ('propertyId' in input && !input.propertyId) x.propertyId = undefined;
      if (x.role === 'manager' && x.propertyId) {
        s.properties.forEach((p) => { if (p.managerStaffId === id && p.id !== x.propertyId) p.managerStaffId = undefined; });
        const p = s.properties.find((pp) => pp.id === x.propertyId);
        if (p) p.managerStaffId = id;
      }
      logActivity(s, c, 'staff', `Updated staff record for ${x.name}`, x.propertyId, c.role === 'owner' ? '/owner/staff' : '/manager/staff');
    });
    return clone(db().staff.find((x) => x.id === id)!);
  },
  async setStatus(id, status) {
    await delay(200);
    const c = ctx();
    requireRole(c, 'owner', 'manager');
    const m = db().staff.find((x) => x.id === id);
    if (!m) throw notFound('Staff member');
    if (c.role === 'manager' && (m.propertyId !== c.propertyId || m.role === 'manager')) throw new ServiceError('FORBIDDEN', 'You can only change status of your property staff.');
    if (c.user.staffId === id) throw new ServiceError('CONFLICT', 'You cannot change your own status.');
    mutate((s) => {
      const x = s.staff.find((y) => y.id === id)!;
      x.status = status;
      logActivity(s, c, 'staff', `Set ${x.name} to ${sentenceCase(status)}`, x.propertyId, c.role === 'owner' ? '/owner/staff' : '/manager/staff');
    });
    return clone(db().staff.find((x) => x.id === id)!);
  },
};
