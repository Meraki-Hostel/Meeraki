import type {
  ActivityLog, Announcement, Bed, Complaint, ComplaintCategory, ComplaintStatus, DemoState, DocumentRecord, DocumentType,
  Feedback, FeedbackCategory, HostelEvent, InventoryCategory, InventoryItem, InventoryTransaction, LeaveRequest,
  MaintenanceTicket, MonthlySnapshot, Notification, Payment, PaymentMethod, Priority, RentCharge, Room,
  StudentProfile, User, VisitorRequest,
} from '@/types/domain';
import { addDays, stamp } from '@/lib/clock';
import { createRng } from '@/lib/rng';
import {
  BLOOD_GROUPS, COLLEGES, FEMALE_FIRST, HOMETOWNS, MALE_FIRST, OCCUPANCY_PATTERN, PLANS, PROPERTIES,
  ROOM_LAYOUT, SETTINGS, STAFF, SURNAMES,
} from './catalog';

const BEDS_PER_TYPE = { single: 1, double: 2, triple: 3, quad: 4 } as const;
const BED_LABELS = ['A', 'B', 'C', 'D'];
const UNAVAILABLE_REASONS = ['Mattress replacement pending', 'Seepage repair in progress', 'Reserved for staff stay'];

const pad = (n: number, w = 4) => String(n).padStart(w, '0');
const prefs = { emailDigest: true, smsAlerts: true, compactTables: false };

/**
 * Builds the complete demo dataset deterministically. Never mutate the
 * returned object from pages — the repository clones it on load/reset.
 */
export function buildSeed(): DemoState {
  const rng = createRng(20261018);
  const rooms: Room[] = [];
  const beds: Bed[] = [];
  const students: StudentProfile[] = [];
  const usedNames = new Set<string>(['Rahul Sharma']);
  let studentSeq = 0;

  const uniqueName = (gender: 'male' | 'female') => {
    for (;;) {
      const first = rng.pick(gender === 'male' ? MALE_FIRST : FEMALE_FIRST);
      const name = `${first} ${rng.pick(SURNAMES)}`;
      if (!usedNames.has(name)) { usedNames.add(name); return name; }
    }
  };

  for (const property of PROPERTIES) {
    const layout = ROOM_LAYOUT[property.id]!;
    const groups = OCCUPANCY_PATTERN[property.id]!.split(' ');
    if (groups.length !== layout.length) throw new Error(`Seed pattern mismatch for ${property.id}`);
    let unavailableIdx = 0;

    layout.forEach(([number, floor, type, rent, ac], i) => {
      const room: Room = {
        id: `room_${property.code.toLowerCase()}_${number.toLowerCase()}`,
        propertyId: property.id, number, floor, type, rent, ac,
        attachedBath: ac || type === 'single', status: 'active',
      };
      rooms.push(room);
      const pattern = groups[i]!;
      if (pattern.length !== BEDS_PER_TYPE[type]) throw new Error(`Bed count mismatch ${room.id}`);

      for (let b = 0; b < pattern.length; b++) {
        const bed: Bed = { id: `${room.id}_${BED_LABELS[b]!.toLowerCase()}`, roomId: room.id, propertyId: property.id, label: BED_LABELS[b]!, status: 'available' };
        const state = pattern[b];
        if (state === 'u') {
          bed.status = 'unavailable';
          bed.unavailableReason = UNAVAILABLE_REASONS[unavailableIdx++ % UNAVAILABLE_REASONS.length];
        } else if (state === 'o') {
          const isRahul = property.id === 'prop_crown' && number === '204' && b === 1;
          const gender = property.type === 'girls' ? 'female' : property.type === 'boys' ? 'male' : rng.chance(0.5) ? 'male' : 'female';
          studentSeq++;
          const name = isRahul ? 'Rahul Sharma' : uniqueName(gender);
          const id = isRahul ? 'stu_rahul' : `stu_${pad(studentSeq, 3)}`;
          const college = rng.pick(COLLEGES);
          const joinMonth = rng.pick(['2025-07', '2025-08', '2026-01', '2026-07', '2026-08']);
          const surname = name.split(' ')[1]!;
          const guardianFirst = rng.pick(['Rajesh', 'Sanjay', 'Anil', 'Manoj', 'Rakesh', 'Sunil', 'Vinod', 'Arvind', 'Shabana', 'Rekha']);
          const student: StudentProfile = {
            id,
            studentCode: `MHM-${property.code}-${pad(isRahul ? 12 : studentSeq + 20, 4)}`,
            name,
            email: `${name.toLowerCase().replace(/\s+/g, '.')}@student.example`,
            phone: isRahul ? '9876543210' : `9${rng.int(5, 9)}${pad(rng.int(10000000, 99999999), 8)}`,
            gender: isRahul ? 'male' : gender,
            dob: `${rng.int(2003, 2007)}-${pad(rng.int(1, 12), 2)}-${pad(rng.int(1, 28), 2)}`,
            college: isRahul ? 'Amity University Lucknow' : college.college,
            course: isRahul ? 'B.Tech CSE' : rng.pick(college.courses),
            year: isRahul ? 3 : rng.int(1, 4),
            propertyId: property.id,
            roomId: room.id,
            bedId: bed.id,
            status: isRahul ? 'active' : rng.chance(0.08) ? 'notice' : 'active',
            joinedOn: isRahul ? '2025-07-14' : `${joinMonth}-${pad(rng.int(1, 20), 2)}`,
            monthlyRent: rent,
            address: `${rng.int(1, 240)}, ${rng.pick(['Civil Lines', 'Station Road', 'Nehru Nagar', 'Gandhi Colony', 'Shastri Puram'])}, ${isRahul ? 'Kanpur' : rng.pick(HOMETOWNS)}, Uttar Pradesh`,
            bloodGroup: isRahul ? 'B+' : rng.pick(BLOOD_GROUPS),
            guardianName: isRahul ? 'Rajesh Sharma' : `${guardianFirst} ${surname}`,
            guardianRelation: isRahul ? 'Father' : rng.pick(['Father', 'Mother', 'Uncle']),
            guardianPhone: isRahul ? '9415567890' : `94${pad(rng.int(10000000, 99999999), 8)}`,
            emergencyName: isRahul ? 'Sunita Sharma' : `${rng.pick(['Meena', 'Kiran', 'Asha', 'Usha', 'Vijay'])} ${surname}`,
            emergencyPhone: isRahul ? '9415567891' : `98${pad(rng.int(10000000, 99999999), 8)}`,
          };
          students.push(student);
          bed.status = 'occupied';
          bed.studentId = id;
        }
        beds.push(bed);
      }
    });
  }

  // A pending (not yet allotted) applicant at Crown to demo the assign flow.
  students.push({
    id: 'stu_pending_01', studentCode: 'MHM-CR-0099', name: 'Harshit Bajpai', email: 'harshit.bajpai@student.example', phone: '9721456610',
    gender: 'male', dob: '2006-03-14', college: 'Lucknow University', course: 'BBA', year: 1, propertyId: 'prop_crown',
    status: 'pending', joinedOn: '2026-10-20', monthlyRent: 9500, address: '44, Station Road, Sitapur, Uttar Pradesh', bloodGroup: 'O+',
    guardianName: 'Anil Bajpai', guardianRelation: 'Father', guardianPhone: '9415778812', emergencyName: 'Asha Bajpai', emergencyPhone: '9415778813',
  });

  /* ---------- Rent charges & payments ---------- */
  const charges: RentCharge[] = [];
  const payments: Payment[] = [];
  let receiptSeq = 0;
  const methods: PaymentMethod[] = ['upi', 'upi', 'upi', 'bank_transfer', 'cash', 'card'];
  const periods = ['2026-08', '2026-09', '2026-10'];
  const managerName = (propertyId: string) => STAFF.find((s) => s.propertyId === propertyId && s.role === 'manager')?.name ?? 'Accounts';

  for (const s of students) {
    if (s.status === 'pending') continue;
    const dueDay = s.id === 'stu_rahul' ? 20 : rng.chance(0.3) ? 20 : 5;
    for (const period of periods) {
      if (s.joinedOn.slice(0, 7) > period) continue;
      const charge: RentCharge = {
        id: `chg_${s.id}_${period.replace('-', '')}`,
        studentId: s.id, propertyId: s.propertyId, period, amount: s.monthlyRent,
        dueDate: `${period}-${pad(dueDay, 2)}`, description: 'Monthly rent',
      };
      charges.push(charge);
      let paidRatio: number;
      if (s.id === 'stu_rahul') paidRatio = period === '2026-10' ? 0 : 1;
      else if (period === '2026-08') paidRatio = 1;
      else if (period === '2026-09') paidRatio = rng.chance(0.9) ? 1 : 0.5;
      else {
        const roll = rng.next();
        const collectBias = s.propertyId === 'prop_sunny' ? 0.15 : s.propertyId === 'prop_globus' ? -0.15 : 0;
        paidRatio = roll < 0.55 + collectBias ? 1 : roll < 0.68 + collectBias ? 0.5 : 0;
      }
      if (paidRatio > 0) {
        receiptSeq++;
        const paidOn = addDays(charge.dueDate, rng.int(-3, period === '2026-10' ? 4 : 9));
        payments.push({
          id: `pay_${pad(receiptSeq)}`, chargeId: charge.id, studentId: s.id, propertyId: s.propertyId,
          amount: Math.round(charge.amount * paidRatio), method: rng.pick(methods),
          paidOn: paidOn > '2026-10-18' ? '2026-10-17' : paidOn,
          reference: `UTR${rng.int(100000000, 999999999)}`, receiptNo: `RCPT-2026-${pad(receiptSeq)}`, recordedBy: managerName(s.propertyId),
        });
      }
    }
  }

  /* ---------- Users ---------- */
  const users: User[] = [
    { id: 'user_owner', name: 'Pawan Kushwah', email: 'pawan@merakiliving.example', phone: '9415000001', role: 'owner', title: 'Owner', preferences: { ...prefs } },
    { id: 'user_khan', name: 'Mr. Arif Khan', email: 'arif.khan@merakiliving.example', phone: '9415000002', role: 'owner', title: 'Co-owner', preferences: { ...prefs } },
    { id: 'user_anita', name: 'Anita Desai', email: 'anita.desai@merakiliving.example', phone: '9839011201', role: 'manager', title: 'Manager · Crown Boys Residence', propertyId: 'prop_crown', staffId: 'staff_anita', preferences: { ...prefs } },
    { id: 'user_kavita', name: 'Kavita Rao', email: 'kavita.rao@merakiliving.example', phone: '9839011202', role: 'manager', title: 'Manager · HSD Loyal Girls Hostel', propertyId: 'prop_hsd', staffId: 'staff_kavita', preferences: { ...prefs } },
    { id: 'user_rahul', name: 'Rahul Sharma', email: 'rahul.sharma@student.example', phone: '9876543210', role: 'student', title: 'Resident · Room 204', propertyId: 'prop_crown', studentId: 'stu_rahul', preferences: { ...prefs } },
  ];

  /* ---------- Complaints ---------- */
  const crownStudents = students.filter((s) => s.propertyId === 'prop_crown' && s.status !== 'pending');
  const complaintTemplates: Array<[ComplaintCategory, string, string, Priority]> = [
    ['electrical', 'Ceiling fan making grinding noise', 'The fan in my room makes a loud grinding sound at high speed and wobbles. Hard to sleep at night.', 'medium'],
    ['plumbing', 'Bathroom tap leaking continuously', 'Hot water tap in the attached bathroom drips all day even when fully closed.', 'medium'],
    ['internet', 'Wi-Fi drops every evening', 'Wi-Fi disconnects between 8 pm and 11 pm on the 2nd floor. Speed under 1 Mbps.', 'high'],
    ['food', 'Dinner served cold on weekdays', 'Dinner after 9 pm is cold. Requesting a warmer or later batch for students with evening classes.', 'low'],
    ['cleaning', 'Corridor not cleaned for two days', 'Third-floor corridor and washroom have not been cleaned since Thursday.', 'high'],
    ['furniture', 'Study chair broken', 'The backrest of my study chair snapped. Need a replacement.', 'low'],
    ['security', 'Main gate left open after 11 pm', 'Noticed the main gate open after curfew twice this week without a guard present.', 'urgent'],
    ['electrical', 'Power socket sparking near bed', 'The socket near bed C sparks when a charger is plugged in.', 'urgent'],
    ['plumbing', 'Low water pressure in shower', 'Very low pressure in the common shower during mornings.', 'medium'],
    ['internet', 'Cannot log in to hostel Wi-Fi portal', 'Portal says my device limit is reached but I only use one phone and one laptop.', 'low'],
  ];
  const statusCycle: ComplaintStatus[] = ['open', 'in_progress', 'resolved', 'open', 'closed', 'in_progress', 'open', 'resolved'];
  const complaints: Complaint[] = [];
  let ticketSeq = 0;
  const makeComplaint = (studentId: string, idx: number, status: ComplaintStatus, daysAgo: number, assignee?: string): Complaint => {
    const s = students.find((x) => x.id === studentId)!;
    const [category, title, description, priority] = complaintTemplates[idx % complaintTemplates.length]!;
    ticketSeq++;
    const created = stamp(addDays('2026-10-18', -daysAgo), `${pad(9 + (ticketSeq % 9), 2)}:${pad((ticketSeq * 7) % 60, 2)}`);
    const mgr = managerName(s.propertyId);
    const history: Complaint['history'] = [{ id: `ch_${ticketSeq}_1`, status: 'open', changedBy: s.name, at: created }];
    const comments: Complaint['comments'] = [];
    if (status !== 'open') {
      const t2 = stamp(addDays('2026-10-18', -Math.max(daysAgo - 1, 0)), '11:30');
      history.push({ id: `ch_${ticketSeq}_2`, status: 'in_progress', changedBy: mgr, note: 'Assigned to maintenance team', at: t2 });
      comments.push({ id: `cc_${ticketSeq}_1`, authorName: mgr, authorRole: 'manager', body: 'Thanks for reporting. Our technician will visit today between 4 and 6 pm.', internal: false, createdAt: t2 });
    }
    if (status === 'resolved' || status === 'closed') {
      const t3 = stamp(addDays('2026-10-18', -Math.max(daysAgo - 2, 0)), '17:10');
      history.push({ id: `ch_${ticketSeq}_3`, status: 'resolved', changedBy: mgr, note: 'Issue fixed and verified with resident', at: t3 });
      if (status === 'closed') history.push({ id: `ch_${ticketSeq}_4`, status: 'closed', changedBy: s.name, at: t3 });
    }
    return {
      id: `cmp_${pad(ticketSeq)}`, ticketNo: `CMP-${pad(1040 + ticketSeq)}`, propertyId: s.propertyId, studentId, roomId: s.roomId,
      category, title, description, priority, status, assigneeStaffId: status === 'open' ? undefined : assignee,
      attachments: idx === 0 ? ['fan-noise.mp4'] : [], comments, history, createdAt: created, updatedAt: history[history.length - 1]!.at,
    };
  };
  complaints.push(makeComplaint('stu_rahul', 0, 'in_progress', 2, 'staff_deepak'));
  complaints.push(makeComplaint('stu_rahul', 5, 'resolved', 21, 'staff_deepak'));
  crownStudents.filter((s) => s.id !== 'stu_rahul').slice(0, 8).forEach((s, i) => {
    complaints.push(makeComplaint(s.id, i + 1, statusCycle[i % statusCycle.length]!, i * 2 + 1, i % 2 ? 'staff_deepak' : 'staff_sunita'));
  });
  for (const pid of ['prop_hsd', 'prop_globus', 'prop_sunny', 'prop_cosmo']) {
    const ps = students.filter((s) => s.propertyId === pid);
    ps.slice(0, pid === 'prop_globus' ? 4 : 2).forEach((s, i) => {
      complaints.push(makeComplaint(s.id, i + 2 + pid.length, statusCycle[(i + pid.length) % statusCycle.length]!, i * 3 + 2,
        STAFF.find((x) => x.propertyId === pid && x.role !== 'manager')?.id));
    });
  }

  /* ---------- Leave ---------- */
  const leaves: LeaveRequest[] = [];
  const leaveData: Array<[string, string, string, LeaveRequest['status'], string, string]> = [
    ['stu_rahul', '2026-09-26', '2026-09-29', 'approved', 'Kanpur', 'Cousin’s wedding'],
  ];
  crownStudents.filter((s) => s.id !== 'stu_rahul').slice(0, 6).forEach((s, i) => {
    const st: LeaveRequest['status'][] = ['pending', 'pending', 'approved', 'rejected', 'approved', 'pending'];
    const from = addDays('2026-10-18', [2, 4, -1, 1, 6, 9][i]!);
    leaveData.push([s.id, from, addDays(from, [3, 2, 4, 1, 5, 2][i]!), st[i]!, s.address.split(', ')[2] ?? 'Home', ['Diwali at home', 'Family function', 'Medical check-up', 'Hackathon in Noida', 'Diwali at home', 'Sister’s engagement'][i]!]);
  });
  ['prop_hsd', 'prop_globus', 'prop_sunny'].forEach((pid, i) => {
    const s = students.find((x) => x.propertyId === pid)!;
    leaveData.push([s.id, addDays('2026-10-18', i + 3), addDays('2026-10-18', i + 7), i === 1 ? 'approved' : 'pending', 'Varanasi', 'Diwali at home']);
  });
  leaveData.forEach(([sid, from, to, status, dest, reason], i) => {
    const s = students.find((x) => x.id === sid)!;
    leaves.push({
      id: `lv_${pad(i + 1)}`, studentId: sid, propertyId: s.propertyId, from, to, destination: dest, contactPhone: s.guardianPhone, reason, status,
      decisionReason: status === 'rejected' ? 'Overlaps with internal exam schedule shared by college.' : undefined,
      decidedBy: status === 'approved' || status === 'rejected' ? managerName(s.propertyId) : undefined,
      decidedAt: status === 'approved' || status === 'rejected' ? stamp(addDays(from, -2), '18:00') : undefined,
      createdAt: stamp(addDays(from, -4), '20:15'),
    });
  });

  /* ---------- Visitors ---------- */
  const visitors: VisitorRequest[] = [];
  const visitorSpecs: Array<[string, string, string, string, number, string, VisitorRequest['status'], VisitorRequest['source']]> = [
    ['stu_rahul', 'Rajesh Sharma', '9415567890', 'Father', 0, '16:30', 'approved', 'request'],
    ['stu_rahul', 'Ankit Mishra', '9935512233', 'Friend', -9, '18:00', 'checked_out', 'request'],
  ];
  crownStudents.filter((s) => s.id !== 'stu_rahul').slice(0, 7).forEach((s, i) => {
    const st: VisitorRequest['status'][] = ['pending', 'approved', 'checked_in', 'checked_out', 'rejected', 'pending', 'checked_out'];
    visitorSpecs.push([s.id, `${['Sanjay', 'Meena', 'Vivek', 'Farhan', 'Ritu', 'Alok', 'Nisha'][i]} ${s.name.split(' ')[1]}`, `98${pad(37000000 + i * 1111111, 8)}`,
      ['Father', 'Mother', 'Brother', 'Friend', 'Cousin', 'Uncle', 'Sister'][i]!, [0, 0, 0, -2, -1, 1, -5][i]!, ['11:00', '15:00', '12:30', '17:00', '19:30', '10:30', '16:00'][i]!, st[i]!, i === 2 ? 'walk_in' : 'request']);
  });
  ['prop_hsd', 'prop_sunny', 'prop_globus'].forEach((pid, i) => {
    const s = students.find((x) => x.propertyId === pid)!;
    visitorSpecs.push([s.id, `Parent of ${s.name.split(' ')[0]}`, `941500${pad(1000 + i, 4)}`, 'Mother', i - 1, '14:00', i === 0 ? 'checked_out' : 'approved', 'request']);
  });
  visitorSpecs.forEach(([sid, vname, vphone, rel, dayOffset, time, status, source], i) => {
    const s = students.find((x) => x.id === sid)!;
    const date = addDays('2026-10-18', dayOffset);
    visitors.push({
      id: `vis_${pad(i + 1)}`, studentId: sid, propertyId: s.propertyId, source, visitorName: vname, visitorPhone: vphone, relation: rel,
      visitDate: date, visitTime: time, purpose: rel === 'Friend' ? 'Project discussion' : 'Family visit', status,
      decisionReason: status === 'rejected' ? 'Visit requested after visiting hours (7 pm).' : undefined,
      checkInAt: status === 'checked_in' || status === 'checked_out' ? stamp(date, time) : undefined,
      checkOutAt: status === 'checked_out' ? stamp(date, `${pad(Number(time.slice(0, 2)) + 1, 2)}:${time.slice(3)}`) : undefined,
      createdAt: stamp(addDays(date, -1), '21:00'),
    });
  });

  /* ---------- Maintenance ---------- */
  const mt: Array<[string, string, MaintenanceTicket['category'], string, Priority, MaintenanceTicket['status'], string | undefined, string | undefined, number, number | undefined, number]> = [
    ['prop_crown', 'Replace fan regulator, Room 204', 'electrical', 'Room 204', 'medium', 'in_progress', 'staff_deepak', undefined, 650, undefined, 2],
    ['prop_crown', 'Overhead tank cleaning', 'plumbing', 'Terrace', 'high', 'assigned', 'staff_deepak', 'Lucknow Aqua Services', 4500, undefined, 4],
    ['prop_crown', 'Repaint 3rd floor corridor', 'painting', '3rd floor corridor', 'low', 'open', undefined, undefined, 18000, undefined, 6],
    ['prop_crown', 'Geyser not heating, Room 103', 'appliance', 'Room 103', 'high', 'completed', 'staff_deepak', 'Sharma Electricals', 2200, 1850, 12],
    ['prop_crown', 'Termite treatment for study room', 'pest_control', 'Study room', 'medium', 'on_hold', undefined, 'PestFree Lucknow', 6500, undefined, 9],
    ['prop_crown', 'Fix seepage in Room 301', 'civil', 'Room 301', 'medium', 'in_progress', 'staff_deepak', 'Verma Constructions', 9000, undefined, 5],
    ['prop_hsd', 'Biometric reader offline', 'electrical', 'Main entrance', 'urgent', 'assigned', 'staff_rekha', 'SecureTech', 3000, undefined, 1],
    ['prop_globus', 'Broken window pane, Room 102', 'carpentry', 'Room 102', 'medium', 'open', undefined, undefined, 1200, undefined, 3],
    ['prop_globus', 'Kitchen exhaust replacement', 'appliance', 'Mess kitchen', 'high', 'in_progress', 'staff_ajay', 'Kitchen Pro', 7800, undefined, 7],
    ['prop_sunny', 'AC servicing — all rooms', 'appliance', 'All rooms', 'medium', 'completed', undefined, 'CoolCare Services', 14000, 13200, 20],
    ['prop_cosmo', 'Install co-working lounge lights', 'electrical', 'Ground floor lounge', 'low', 'assigned', undefined, 'BrightLine Electric', 8500, undefined, 4],
  ];
  const maintenance: MaintenanceTicket[] = mt.map(([pid, title, category, location, priority, status, assignee, vendor, est, actual, daysAgo], i) => ({
    id: `mnt_${pad(i + 1)}`, ticketNo: `MNT-${pad(210 + i)}`, propertyId: pid, title,
    description: `${title}. Logged during routine inspection; resident impact noted.`, category, location, priority, status,
    assigneeStaffId: assignee, vendor, estimatedCost: est, actualCost: actual,
    createdAt: stamp(addDays('2026-10-18', -daysAgo), '10:20'), updatedAt: stamp(addDays('2026-10-18', -Math.max(daysAgo - 1, 0)), '15:45'),
  }));

  /* ---------- Inventory ---------- */
  const invTemplates: Array<[string, InventoryCategory, string, number, number, number]> = [
    ['Bedsheet set (single)', 'linen', 'sets', 48, 20, 450], ['Pillow covers', 'linen', 'pcs', 12, 25, 90],
    ['Mattress (6 in)', 'furniture', 'pcs', 4, 3, 3800], ['Study chair', 'furniture', 'pcs', 2, 4, 1600],
    ['LED tube light 20W', 'electrical', 'pcs', 18, 10, 240], ['Floor cleaner (5 L)', 'cleaning', 'cans', 3, 6, 520],
    ['Rice (25 kg bag)', 'kitchen', 'bags', 9, 5, 1450], ['Cooking oil (15 L tin)', 'kitchen', 'tins', 2, 3, 2350],
    ['Fire extinguisher refill', 'safety', 'units', 6, 4, 900], ['Register books', 'stationery', 'pcs', 15, 5, 120],
  ];
  const inventory: InventoryItem[] = [];
  const inventoryTxns: InventoryTransaction[] = [];
  PROPERTIES.forEach((p, pi) => {
    invTemplates.forEach(([name, category, unit, qty, reorder, cost], i) => {
      if (p.id === 'prop_cosmo' && i > 6) return;
      const quantity = Math.max(0, qty + ((pi * 3 + i * 5) % 9) - 4 - (p.id === 'prop_globus' && i % 3 === 0 ? 6 : 0));
      const id = `inv_${p.code.toLowerCase()}_${pad(i + 1, 2)}`;
      inventory.push({ id, propertyId: p.id, name, sku: `${p.code}-${category.slice(0, 3).toUpperCase()}-${pad(i + 1, 3)}`, category, unit, quantity, reorderLevel: reorder, unitCost: cost, updatedAt: stamp(addDays('2026-10-18', -(i % 6)), '12:00') });
      if (i < 4) {
        inventoryTxns.push({ id: `itx_${p.code.toLowerCase()}_${i}a`, itemId: id, propertyId: p.id, type: 'in', quantity: 10 + i * 2, note: 'Monthly purchase', by: managerName(p.id), at: stamp(addDays('2026-10-18', -14 - i), '11:00') });
        inventoryTxns.push({ id: `itx_${p.code.toLowerCase()}_${i}b`, itemId: id, propertyId: p.id, type: 'out', quantity: 3 + i, note: 'Issued to rooms', by: managerName(p.id), at: stamp(addDays('2026-10-18', -3 - i), '16:00') });
      }
    });
  });

  /* ---------- Announcements ---------- */
  const ann: Array<[string, string, string, Announcement['category'], Announcement['audience'], Announcement['status'], number, string]> = [
    ['prop_crown', 'Diwali mess menu and timings', 'Special Diwali dinner on 8 Nov at 8 pm on the terrace. Mess closes at 10 pm that night. Sweets will be distributed at the reception from 6 pm.', 'mess', { type: 'all', values: [] }, 'published', 1, 'Anita Desai'],
    ['prop_crown', 'Water supply interruption — Tuesday', 'Overhead tank cleaning on Tue, 20 Oct from 10 am to 2 pm. Please store water in advance. Ground floor taps will remain on.', 'maintenance', { type: 'all', values: [] }, 'published', 2, 'Anita Desai'],
    ['prop_crown', 'Fire drill for 2nd floor', 'A short fire drill for 2nd floor residents on Sat, 24 Oct at 7:30 am. Assemble near the main gate when the alarm sounds.', 'urgent', { type: 'floors', values: ['2'] }, 'published', 3, 'Anita Desai'],
    ['prop_crown', 'Rent for October due', 'October rent is due as per your billing date. Pay via UPI at the reception or ask for a receipt from the accounts desk.', 'general', { type: 'all', values: [] }, 'published', 12, 'Anita Desai'],
    ['prop_crown', 'Inter-hostel cricket trials', 'Trials for the inter-hostel cricket cup on Sunday morning at the Aliganj ground. Register with the warden.', 'event', { type: 'all', values: [] }, 'archived', 30, 'Anita Desai'],
    ['prop_crown', 'Laundry pickup schedule update', 'From November, laundry pickup will be on Monday and Thursday mornings.', 'general', { type: 'all', values: [] }, 'draft', 0, 'Anita Desai'],
    ['prop_hsd', 'Gym timings extended', 'The gym is now open until 9:30 pm on weekdays.', 'general', { type: 'all', values: [] }, 'published', 4, 'Kavita Rao'],
    ['prop_globus', 'Pest control this Friday', 'Pest control in all rooms this Friday. Keep food sealed and cupboards open.', 'maintenance', { type: 'all', values: [] }, 'published', 2, 'Suresh Yadav'],
    ['prop_sunny', 'AC filter cleaning complete', 'AC servicing is complete across all rooms. Report any issue at the front desk.', 'maintenance', { type: 'all', values: [] }, 'published', 6, 'Imran Qureshi'],
  ];
  const announcements: Announcement[] = ann.map(([pid, title, body, category, audience, status, daysAgo, author], i) => ({
    id: `ann_${pad(i + 1)}`, propertyId: pid, title, body, category, audience, status, author,
    createdAt: stamp(addDays('2026-10-18', -daysAgo - 1), '09:30'),
    publishedAt: status !== 'draft' ? stamp(addDays('2026-10-18', -daysAgo), '10:00') : undefined,
    readBy: i === 3 ? ['stu_rahul'] : [],
  }));

  /* ---------- Events ---------- */
  const ev: Array<[string, string, string, HostelEvent['category'], number, string, string, string, number, number, HostelEvent['status']]> = [
    ['prop_crown', 'Diwali night on the terrace', 'Diyas, rangoli competition and a special dinner. Guests are not permitted.', 'festival', 21, '19:00', '22:00', 'Terrace', 80, 62, 'scheduled'],
    ['prop_crown', 'Resume and LinkedIn workshop', 'A one-hour session by alumni from Amity placement cell.', 'workshop', 6, '17:30', '18:30', 'Study room', 35, 22, 'scheduled'],
    ['prop_crown', 'Free health check-up camp', 'Basic health check-up with Aliganj Community Clinic. Bring your ID card.', 'health', 3, '10:00', '13:00', 'Reception lounge', 60, 41, 'scheduled'],
    ['prop_crown', 'Monthly residents meeting', 'Discuss mess menu, Wi-Fi upgrade and house rules.', 'meeting', -7, '20:00', '21:00', 'Mess hall', 70, 48, 'completed'],
    ['prop_hsd', 'Navratri garba evening', 'Garba and dandiya night with live dhol.', 'cultural', -6, '19:00', '22:00', 'Courtyard', 90, 74, 'completed'],
    ['prop_globus', 'Badminton doubles league', 'Sign up in pairs. Finals on Sunday.', 'sports', 9, '07:00', '10:00', 'Community court', 32, 18, 'scheduled'],
    ['prop_sunny', 'Fire safety awareness session', 'Short session with the local fire station team.', 'workshop', 12, '18:00', '19:00', 'Common room', 50, 30, 'scheduled'],
    ['prop_cosmo', 'Open house for new residents', 'Tour of Cosmo House for prospective residents and parents.', 'meeting', 5, '11:00', '14:00', 'Lounge', 40, 15, 'cancelled'],
  ];
  const events: HostelEvent[] = ev.map(([pid, title, description, category, offset, st, et, loc, cap, exp, status], i) => ({
    id: `evt_${pad(i + 1)}`, propertyId: pid, title, description, category, date: addDays('2026-10-18', offset), startTime: st, endTime: et,
    location: loc, capacity: cap, expectedAttendance: exp, status, createdBy: managerName(pid),
  }));

  /* ---------- Feedback ---------- */
  const fbCats: FeedbackCategory[] = ['food', 'cleanliness', 'staff', 'facilities', 'security', 'internet', 'food'];
  const fbComments: Record<FeedbackCategory, string[]> = {
    food: ['Breakfast variety has improved a lot.', 'Dal is too watery most days.', 'Sunday special was great.'],
    cleanliness: ['Rooms are cleaned on time.', 'Washrooms need cleaning twice a day.'],
    staff: ['Warden is very responsive.', 'Security guard is polite and helpful.'],
    facilities: ['Study room needs more charging points.', 'Laundry turnaround is quick.'],
    security: ['Feel safe with CCTV in corridors.', 'Night entry register is not checked properly.'],
    internet: ['Wi-Fi is slow in the evening.', 'Speed is fine after the router upgrade.'],
    other: ['Overall a good place to stay.'],
  };
  const feedback: Feedback[] = [];
  students.filter((s) => s.status !== 'pending').slice(0, 34).forEach((s, i) => {
    const category = fbCats[i % fbCats.length]!;
    const comment = fbComments[category][i % fbComments[category].length]!;
    const rating = (/slow|watery|not checked|need/.test(comment) ? rng.int(2, 3) : rng.int(4, 5)) as Feedback['rating'];
    feedback.push({ id: `fb_${pad(i + 1)}`, propertyId: s.propertyId, studentId: s.id, category, rating, comment, anonymous: i % 4 === 0, createdAt: stamp(addDays('2026-10-18', -((i * 3) % 40)), '21:00') });
  });

  /* ---------- Documents ---------- */
  const docTypes: DocumentType[] = ['id_proof', 'admission_letter', 'photo', 'police_verification', 'rent_agreement', 'medical'];
  const documents: DocumentRecord[] = [];
  for (const s of students) {
    docTypes.forEach((type, i) => {
      let status: DocumentRecord['status'];
      if (s.id === 'stu_rahul') status = (['verified', 'verified', 'verified', 'uploaded', 'missing', 'rejected'] as const)[i]!;
      else if (s.status === 'pending') status = i < 2 ? 'uploaded' : 'missing';
      else status = rng.chance(0.75) ? 'verified' : rng.chance(0.5) ? 'uploaded' : 'missing';
      documents.push({
        id: `doc_${s.id}_${type}`, studentId: s.id, type, status,
        fileName: status === 'missing' ? undefined : `${type.replace(/_/g, '-')}.pdf`,
        fileSizeKb: status === 'missing' ? undefined : rng.int(120, 1800),
        uploadedAt: status === 'missing' ? undefined : stamp(s.joinedOn, '12:00'),
        note: status === 'rejected' ? 'Image is blurry. Please upload a clearer scan.' : undefined,
      });
    });
  }

  /* ---------- Notifications ---------- */
  const n = (id: string, user: string, title: string, body: string, category: Notification['category'], link: string, hoursAgo: number, read = false): Notification =>
    ({ id, recipientUserId: user, title, body, category, link, read, createdAt: new Date(new Date(stamp('2026-10-18', '18:00')).getTime() - hoursAgo * 3_600_000).toISOString() });
  const notifications: Notification[] = [
    n('ntf_01', 'user_owner', 'Collection update for October', 'Crown Boys Residence crossed 70% of expected October rent.', 'payment', '/owner/finance', 3),
    n('ntf_02', 'user_owner', 'Urgent complaint at Crown Boys', 'Main gate left open after 11 pm reported by a resident.', 'complaint', '/owner/complaints', 6),
    n('ntf_03', 'user_owner', 'Low stock across properties', '9 inventory items are at or below reorder level.', 'inventory', '/owner/inventory', 20),
    n('ntf_04', 'user_owner', 'Manager invitation pending', 'Neha Kapoor has not yet accepted the invitation for Cosmo House.', 'system', '/owner/staff', 30, true),
    n('ntf_05', 'user_khan', 'Weekly portfolio summary ready', 'Occupancy steady at 80%+ across active properties.', 'system', '/owner/analytics', 10),
    n('ntf_06', 'user_anita', 'New leave requests', '3 leave requests are waiting for your decision.', 'leave', '/manager/leave', 2),
    n('ntf_07', 'user_anita', 'Visitor expected today', 'Rajesh Sharma visiting Rahul Sharma at 4:30 pm.', 'visitor', '/manager/visitors', 4),
    n('ntf_08', 'user_anita', 'Low stock: Pillow covers', 'Only a few pillow covers left. Reorder level is 25.', 'inventory', '/manager/inventory', 12),
    n('ntf_09', 'user_anita', 'Complaint marked urgent', 'Power socket sparking near bed — needs immediate attention.', 'complaint', '/manager/complaints', 26, true),
    n('ntf_10', 'user_kavita', 'Biometric reader offline', 'Maintenance ticket MNT-216 assigned to Rekha Bisht.', 'maintenance', '/manager/maintenance', 5),
    n('ntf_11', 'user_rahul', 'Complaint update', 'Your complaint “Ceiling fan making grinding noise” is in progress.', 'complaint', '/student/complaints', 5),
    n('ntf_12', 'user_rahul', 'Visitor approved', 'Your father’s visit today at 4:30 pm is approved.', 'visitor', '/student/visitors', 8),
    n('ntf_13', 'user_rahul', 'Rent due on 20 Oct', 'October rent of ₹10,500 is due on 20 Oct 2026.', 'payment', '/student/rent', 22),
    n('ntf_14', 'user_rahul', 'New notice: Diwali mess menu', 'Special dinner on 8 Nov at 8 pm.', 'notice', '/student/notices', 28, true),
  ];

  /* ---------- Activity ---------- */
  const act = (i: number, pid: string | undefined, actor: string, role: ActivityLog['actorRole'], category: ActivityLog['category'], message: string, hoursAgo: number, link?: string): ActivityLog =>
    ({ id: `act_${pad(i)}`, propertyId: pid, actorName: actor, actorRole: role, category, message, link, createdAt: new Date(new Date(stamp('2026-10-18', '18:00')).getTime() - hoursAgo * 3_600_000).toISOString() });
  const activity: ActivityLog[] = [
    act(1, 'prop_crown', 'Anita Desai', 'manager', 'payment', 'Recorded ₹9,500 UPI payment from a resident of Room 101', 1, '/manager/payments'),
    act(2, 'prop_crown', 'Anita Desai', 'manager', 'visitor', 'Approved visit of Rajesh Sharma for Rahul Sharma', 4, '/manager/visitors'),
    act(3, 'prop_crown', 'Rahul Sharma', 'student', 'complaint', 'Raised complaint CMP-1041: Ceiling fan making grinding noise', 46, '/manager/complaints'),
    act(4, 'prop_crown', 'Anita Desai', 'manager', 'announcement', 'Published “Diwali mess menu and timings”', 24, '/manager/announcements'),
    act(5, 'prop_crown', 'Deepak Verma', 'manager', 'maintenance', 'Moved MNT-210 to In progress', 30, '/manager/maintenance'),
    act(6, 'prop_crown', 'Anita Desai', 'manager', 'inventory', 'Issued 3 bedsheet sets to rooms', 52, '/manager/inventory'),
    act(7, 'prop_crown', 'Anita Desai', 'manager', 'leave', 'Approved leave for a resident (Diwali at home)', 60, '/manager/leave'),
    act(8, 'prop_crown', 'System', 'system', 'payment', 'Generated October rent charges for 17 residents', 400, '/manager/payments'),
    act(9, 'prop_hsd', 'Kavita Rao', 'manager', 'maintenance', 'Raised urgent ticket: Biometric reader offline', 22),
    act(10, 'prop_globus', 'Suresh Yadav', 'manager', 'announcement', 'Published “Pest control this Friday”', 48),
    act(11, 'prop_sunny', 'Imran Qureshi', 'manager', 'payment', 'Recorded 4 payments totalling ₹44,000', 70),
    act(12, undefined, 'Pawan Kushwah', 'owner', 'property', 'Added property Cosmo House (onboarding)', 1500, '/owner/properties/prop_cosmo'),
    act(13, undefined, 'Pawan Kushwah', 'owner', 'staff', 'Invited Neha Kapoor as manager of Cosmo House', 200, '/owner/staff'),
    act(14, 'prop_crown', 'Anita Desai', 'manager', 'room', 'Marked Bed 301-D unavailable (mattress replacement)', 120, '/manager/rooms'),
    act(15, 'prop_crown', 'Anita Desai', 'manager', 'event', 'Scheduled “Diwali night on the terrace”', 90, '/manager/events'),
    act(16, 'prop_crown', 'Anita Desai', 'manager', 'student', 'Added applicant Harshit Bajpai (awaiting bed)', 140, '/manager/students'),
  ];

  /* ---------- Analytics history (Apr–Sep) ---------- */
  const history: MonthlySnapshot[] = [];
  const histPeriods = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const occBase: Record<string, number> = { prop_crown: 80, prop_hsd: 78, prop_globus: 66, prop_sunny: 86, prop_cosmo: 0 };
  const rentBase: Record<string, number> = { prop_crown: 152000, prop_hsd: 116000, prop_globus: 88000, prop_sunny: 139000, prop_cosmo: 0 };
  for (const p of PROPERTIES) {
    histPeriods.forEach((period, i) => {
      if (p.id === 'prop_cosmo' && period < '2026-08') return;
      const occ = p.id === 'prop_cosmo' ? 30 + i * 6 : Math.min(98, occBase[p.id]! + (i % 3) * 2 + (i > 2 ? 3 : -1));
      const expected = p.id === 'prop_cosmo' ? 40000 + i * 6000 : rentBase[p.id]! + i * 2500;
      const rate = p.id === 'prop_globus' ? 0.78 + (i % 2) * 0.05 : 0.86 + (i % 3) * 0.04;
      history.push({ propertyId: p.id, period, occupancyPct: occ, expected, collected: Math.round(expected * Math.min(rate, 0.99)), complaints: 2 + ((i + p.code.charCodeAt(0)) % 6) });
    });
  }

  return {
    organization: { id: 'org_meraki', name: 'Meraki Living', planId: 'plan_growth' },
    settings: structuredClone(SETTINGS),
    plans: structuredClone(PLANS),
    users,
    invitations: [
      { token: 'demo-invite-2026', name: 'Neha Kapoor', email: 'neha.kapoor@merakiliving.example', role: 'manager', propertyId: 'prop_cosmo', invitedBy: 'Pawan Kushwah', status: 'pending', expiresAt: stamp('2026-10-25', '23:59') },
      { token: 'expired-invite', name: 'Vikas Tandon', email: 'vikas.tandon@merakiliving.example', role: 'staff', propertyId: 'prop_globus', invitedBy: 'Suresh Yadav', status: 'expired', expiresAt: stamp('2026-09-30', '23:59') },
    ],
    session: null,
    properties: structuredClone(PROPERTIES),
    rooms, beds, students,
    staff: structuredClone(STAFF),
    charges, payments, complaints, leaves, visitors, maintenance, inventory, inventoryTxns,
    announcements, events, feedback, documents, notifications, activity, history,
    counters: { receipt: receiptSeq, complaint: ticketSeq + 1040, maintenance: 210 + mt.length, student: 200 },
  };
}
