import type { IPropertyService, PropertyInput, PropertyWithStats } from '../interfaces';
import type { DemoState, Property } from '@/types/domain';
import { invalid, notFound } from '../errors';
import { assertPropertyAccess, clone, ctx, db, delay, logActivity, mutate, newId, propertyStats, requireRole, trimAll } from './base';
import { isIndianPhone, normalizePhone } from '@/lib/validation';
import { todayISO } from '@/lib/clock';

const withStats = (s: DemoState, p: Property): PropertyWithStats => ({ ...clone(p), stats: propertyStats(s, p) });

function validateProperty(s: DemoState, input: Partial<PropertyInput>, id?: string) {
  const e: Record<string, string> = {};
  if (input.name !== undefined && input.name.trim().length < 3) e.name = 'Property name must be at least 3 characters';
  if (input.name && s.properties.some((p) => p.id !== id && p.name.toLowerCase() === input.name!.trim().toLowerCase())) e.name = 'A property with this name already exists';
  if (input.code !== undefined && !/^[A-Z]{2,3}$/.test(input.code.trim().toUpperCase())) e.code = 'Use 2–3 letters, e.g. CR';
  if (input.code && s.properties.some((p) => p.id !== id && p.code === input.code!.trim().toUpperCase())) e.code = 'This code is already used';
  if (input.locality !== undefined && !input.locality.trim()) e.locality = 'Locality is required';
  if (input.city !== undefined && !input.city.trim()) e.city = 'City is required';
  if (input.address !== undefined && input.address.trim().length < 8) e.address = 'Enter the full street address';
  if (input.pincode !== undefined && !/^\d{6}$/.test(input.pincode.trim())) e.pincode = 'Enter a 6-digit PIN code';
  if (input.phone !== undefined && !isIndianPhone(input.phone)) e.phone = 'Enter a 10-digit Indian mobile number';
  if (input.baseRent !== undefined && !(input.baseRent >= 1000)) e.baseRent = 'Base rent must be at least ₹1,000';
  if (Object.keys(e).length) throw invalid(e);
}

export const mockPropertyService: IPropertyService = {
  async list(filters = {}) {
    await delay();
    const c = ctx();
    const s = db();
    const q = filters.search?.trim().toLowerCase();
    return s.properties
      .filter((p) => c.role === 'owner' || p.id === c.propertyId)
      .filter((p) => !filters.status || p.status === filters.status)
      .filter((p) => !filters.type || p.type === filters.type)
      .filter((p) => !q || `${p.name} ${p.locality} ${p.city} ${p.code}`.toLowerCase().includes(q))
      .map((p) => withStats(s, p));
  },
  async get(id) {
    await delay();
    const c = ctx();
    const s = db();
    const p = s.properties.find((x) => x.id === id);
    if (!p) throw notFound('Property');
    assertPropertyAccess(c, id);
    return withStats(s, p);
  },
  async create(input) {
    await delay(300);
    const c = ctx();
    requireRole(c, 'owner');
    const data = trimAll(input);
    validateProperty(db(), data);
    const id = newId('prop');
    mutate((s) => {
      const p: Property = {
        id, name: data.name, code: data.code.toUpperCase(), type: data.type, status: data.status, city: data.city,
        locality: data.locality, address: data.address, pincode: data.pincode, phone: normalizePhone(data.phone),
        baseRent: data.baseRent, amenities: data.amenities, openedOn: todayISO(), imageVariant: s.properties.length % 5,
        managerStaffId: data.managerStaffId || undefined,
      };
      s.properties.push(p);
      logActivity(s, c, 'property', `Added property ${p.name} (${p.status})`, undefined, `/owner/properties/${id}`);
    });
    return clone(db().properties.find((p) => p.id === id)!);
  },
  async update(id, input) {
    await delay(260);
    const c = ctx();
    requireRole(c, 'owner');
    const data = trimAll(input);
    if (!db().properties.some((p) => p.id === id)) throw notFound('Property');
    validateProperty(db(), data, id);
    mutate((s) => {
      const p = s.properties.find((x) => x.id === id)!;
      Object.assign(p, data, data.code ? { code: data.code.toUpperCase() } : {}, data.phone ? { phone: normalizePhone(data.phone) } : {});
      if ('managerStaffId' in data && !data.managerStaffId) p.managerStaffId = undefined;
      logActivity(s, c, 'property', `Updated details for ${p.name}`, p.id, `/owner/properties/${id}`);
    });
    return clone(db().properties.find((p) => p.id === id)!);
  },
  async setStatus(id, status) {
    await delay();
    const c = ctx();
    requireRole(c, 'owner');
    if (!db().properties.some((p) => p.id === id)) throw notFound('Property');
    mutate((s) => {
      const p = s.properties.find((x) => x.id === id)!;
      p.status = status;
      logActivity(s, c, 'property', `Changed ${p.name} status to ${status}`, p.id, `/owner/properties/${id}`);
    });
    return clone(db().properties.find((p) => p.id === id)!);
  },
};
