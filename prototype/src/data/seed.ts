import type {
  Activity, Announcement, AppData, Bed, Complaint, ComplaintCategory, ComplaintStatus, Due, Expense,
  Feedback, FeedbackCategory, HostelEvent, InventoryItem, LeaveRequest, MaintenanceTask, PaymentMethod,
  Priority, Property, Room, Staff, StaffRequirement, Student, StudentNotification, Transaction, Visitor,
} from '../lib/types'
import { FEEDBACK_CATEGORIES } from '../lib/types'
import { DEMO_TODAY, addDays, isoDate, mulberry32 } from '../lib/utils'

export const DATA_VERSION = 3

let rand = mulberry32(20260925)
const r = () => rand()
const ri = (a: number, b: number) => Math.floor(r() * (b - a + 1)) + a
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]!
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
const TODAY = new Date(`${DEMO_TODAY}T00:00:00`)
/** ISO datetime `days` from demo today at hh:mm */
function at(days: number, hh = 10, mm = 0) {
  const d = addDays(TODAY, days)
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}
function dateOn(y: number, m: number, d: number, hh = 11, mm = 0) {
  return new Date(y, m - 1, d, hh, mm).toISOString()
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

interface PropertyConfig {
  property: Property
  floors: number
  beds: number
  occupied: number
  reserved: number
  maintenance: number
  rentMult: number
  genders: ('M' | 'F')[] // per building
  foodMean: number
  mood: number
}

const CONFIGS: PropertyConfig[] = [
  {
    property: {
      id: 'p1', name: 'Shanti Residency', city: 'Indore', area: 'Vijay Nagar',
      address: '14, Scheme No. 54, Vijay Nagar, Indore 452010', plan: 'Professional',
      managerName: 'Anita Desai', managerPhone: '9826041573', buildings: ['Block A', 'Block B'],
      colleges: ['Vindhya Institute of Technology', 'Malwa College of Commerce', 'Narmada Medical College', 'Ahilya School of Management'],
      established: 2019,
    },
    floors: 4, beds: 250, occupied: 218, reserved: 3, maintenance: 2, rentMult: 1, genders: ['M', 'F'], foodMean: 3.4, mood: 0,
  },
  {
    property: {
      id: 'p2', name: 'Gyan Kutir Hostel', city: 'Jaipur', area: 'Malviya Nagar',
      address: 'Plot 22, Sector 7, Malviya Nagar, Jaipur 302017', plan: 'Starter',
      managerName: 'Rakesh Choudhary', managerPhone: '9414027788', buildings: ['Main Block'],
      colleges: ['Rajputana Institute of Engineering', 'Aravali Commerce College', 'Pink City School of Design'],
      established: 2021,
    },
    floors: 5, beds: 180, occupied: 157, reserved: 2, maintenance: 1, rentMult: 0.85, genders: ['M'], foodMean: 3.8, mood: 0.1,
  },
  {
    property: {
      id: 'p3', name: 'Aarambh Living', city: 'Pune', area: 'Hinjewadi Phase 1',
      address: 'Survey 118, Hinjewadi Phase 1, Pune 411057', plan: 'Professional',
      managerName: 'Sunita Kulkarni', managerPhone: '9823015566', buildings: ['Tower 1', 'Tower 2'],
      colleges: ['Sahyadri Engineering College', 'Deccan School of Management', 'Indrayani Institute of IT'],
      established: 2018,
    },
    floors: 5, beds: 300, occupied: 285, reserved: 4, maintenance: 1, rentMult: 1.15, genders: ['M', 'F'], foodMean: 3.9, mood: 0.25,
  },
  {
    property: {
      id: 'p4', name: 'Saraswati Girls Hostel', city: 'Bhopal', area: 'MP Nagar',
      address: 'Zone II, MP Nagar, Bhopal 462011', plan: 'Starter',
      managerName: 'Meena Tiwari', managerPhone: '9755312480', buildings: ['Main Block'],
      colleges: ['Bhoj Institute of Pharmacy', 'Upper Lake College of Arts', 'Vindhyachal Law College'],
      established: 2020,
    },
    floors: 4, beds: 220, occupied: 181, reserved: 3, maintenance: 3, rentMult: 0.8, genders: ['F'], foodMean: 3.6, mood: -0.1,
  },
  {
    property: {
      id: 'p5', name: 'Nest Co-Living', city: 'Bengaluru', area: 'Koramangala 5th Block',
      address: '41, 17th Main, Koramangala 5th Block, Bengaluru 560095', plan: 'Enterprise',
      managerName: 'Arvind Rao', managerPhone: '9845067721', buildings: ['East Wing', 'West Wing'],
      colleges: ['Cauvery Institute of Design', 'Nandi Hills Business School', 'Garden City Institute of Technology'],
      established: 2022,
    },
    floors: 5, beds: 300, occupied: 239, reserved: 5, maintenance: 2, rentMult: 1.35, genders: ['M', 'F'], foodMean: 3.2, mood: -0.2,
  },
]

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

const MALE_FIRST = ['Abhishek', 'Akash', 'Amit', 'Anurag', 'Ashish', 'Deepak', 'Gaurav', 'Himanshu', 'Kunal', 'Manish', 'Mohit', 'Nitin', 'Pankaj', 'Prateek', 'Rajat', 'Sachin', 'Saurabh', 'Shubham', 'Varun', 'Vivek', 'Tushar', 'Ayush', 'Devansh', 'Kartik', 'Lakshay', 'Parth', 'Pranav', 'Ritesh', 'Sahil', 'Tarun', 'Uday', 'Vaibhav', 'Yuvraj', 'Farhan', 'Imran', 'Dhruv', 'Ishaan', 'Omkar', 'Rohan', 'Aarav', 'Kabir', 'Naveen', 'Suraj', 'Aniket', 'Chirag', 'Jatin']
const FEMALE_FIRST = ['Aishwarya', 'Ananya', 'Bhavna', 'Deepika', 'Divya', 'Garima', 'Isha', 'Jyoti', 'Khushi', 'Komal', 'Kritika', 'Mansi', 'Nandini', 'Nidhi', 'Pallavi', 'Payal', 'Radhika', 'Rashmi', 'Sakshi', 'Simran', 'Sonal', 'Swati', 'Tanya', 'Vaishnavi', 'Yamini', 'Zoya', 'Aarohi', 'Muskan', 'Shruti', 'Diya', 'Sana', 'Lavanya', 'Harini', 'Megha', 'Aditi', 'Charu', 'Gauri', 'Ira', 'Juhi']
const LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Mishra', 'Yadav', 'Patel', 'Jain', 'Agarwal', 'Joshi', 'Tiwari', 'Pandey', 'Chauhan', 'Rathore', 'Mehta', 'Shah', 'Nair', 'Iyer', 'Reddy', 'Kulkarni', 'Deshmukh', 'Patil', 'Rao', 'Menon', 'Bhat', 'Saxena', 'Srivastava', 'Dubey', 'Chaudhary', 'Malhotra', 'Kapoor', 'Bansal', 'Khan', 'Qureshi', 'Das', 'Banerjee', 'Sen', 'Ghosh', 'Thakur', 'Soni', 'Rawat']
const GUARDIAN_FIRST = ['Rajesh', 'Suresh', 'Mahesh', 'Dinesh', 'Anil', 'Sunil', 'Vinod', 'Manoj', 'Sanjay', 'Ashok', 'Pradeep', 'Rakesh', 'Vijay', 'Mukesh', 'Alok', 'Arun', 'Satish', 'Naresh', 'Kishore', 'Ravi']
const COURSES = ['B.Tech CSE', 'B.Tech ECE', 'B.Tech Mechanical', 'BBA', 'B.Com', 'MBA', 'B.Pharm', 'MBBS', 'B.Des', 'BCA', 'M.Tech', 'BA LLB', 'B.Sc Nursing']
const HOMETOWNS = ['Ujjain, MP', 'Dewas, MP', 'Ratlam, MP', 'Gwalior, MP', 'Jabalpur, MP', 'Kota, Rajasthan', 'Ajmer, Rajasthan', 'Udaipur, Rajasthan', 'Nagpur, Maharashtra', 'Nashik, Maharashtra', 'Lucknow, UP', 'Kanpur, UP', 'Patna, Bihar', 'Ranchi, Jharkhand', 'Raipur, Chhattisgarh', 'Surat, Gujarat', 'Vadodara, Gujarat', 'Mysuru, Karnataka', 'Hubballi, Karnataka', 'Kochi, Kerala', 'Varanasi, UP', 'Bhilai, Chhattisgarh']
const BLOOD = ['O+', 'B+', 'A+', 'AB+', 'O-', 'B-', 'A-']

const CURATED_M = ['Ankit Gupta', 'Rahul Verma', 'Aman Verma', 'Karan Mehta', 'Vikram Rathore', 'Rohit Patel', 'Siddharth Nair', 'Arjun Reddy', 'Yash Malhotra', 'Nikhil Bansal', 'Aditya Chauhan']
const CURATED_F = ['Priya Singh', 'Neha Mishra', 'Sneha Iyer', 'Pooja Yadav', 'Ishita Jain', 'Aditi Kulkarni', 'Tanvi Joshi', 'Kavya Menon', 'Anjali Dubey', 'Shreya Pandey', 'Meera Saxena']

const RESERVED_NAMES = ['Rahul Sharma', 'Aman Kumar', 'Harsh Agarwal', 'Riya Kapoor', ...CURATED_M, ...CURATED_F]
let usedNames = new Set<string>(RESERVED_NAMES)
function randomName(g: 'M' | 'F') {
  for (let i = 0; i < 50; i++) {
    const n = `${pick(g === 'M' ? MALE_FIRST : FEMALE_FIRST)} ${pick(LAST)}`
    if (!usedNames.has(n)) {
      usedNames.add(n)
      return n
    }
  }
  return `${pick(g === 'M' ? MALE_FIRST : FEMALE_FIRST)} ${pick(LAST)}`
}
function phone() {
  return `${pick(['9', '8', '7', '6'])}${Array.from({ length: 9 }, () => ri(0, 9)).join('')}`
}
function emailFor(name: string) {
  const [f, l] = name.toLowerCase().split(' ')
  return `${f}.${l}${ri(1, 99)}@${pick(['gmail.com', 'gmail.com', 'outlook.com', 'yahoo.in'])}`
}

// ---------------------------------------------------------------------------
// Rooms & beds
// ---------------------------------------------------------------------------

const CAP_PATTERN = [4, 3, 4, 2, 3, 4, 1, 3, 4, 2, 3, 4]
const TYPE_BY_CAP = { 1: 'Single', 2: 'Double', 3: 'Triple', 4: 'Quad' } as const
const BASE_RENT = { Single: 12000, Double: 9500, Triple: 8500, Quad: 8000 }
const AMENITY_POOL = ['Attached washroom', 'Study table', 'Wardrobe', 'Balcony', 'AC', 'Geyser', 'Window-side']

function buildRooms(cfg: PropertyConfig) {
  const p = cfg.property
  const rooms: Room[] = []
  const beds: Bed[] = []
  const segments = p.buildings.length * cfg.floors
  const base = Math.floor(cfg.beds / segments)
  let remainder = cfg.beds - base * segments
  p.buildings.forEach((building, bi) => {
    for (let floor = 1; floor <= cfg.floors; floor++) {
      let target = base + (remainder > 0 ? 1 : 0)
      if (remainder > 0) remainder--
      let i = 1
      while (target > 0) {
        let cap = CAP_PATTERN[(i + floor * 3 + bi * 5) % CAP_PATTERN.length]!
        if (p.id === 'p1' && bi === 0 && floor === 2 && i === 4) cap = 4 // Room 204
        cap = Math.min(cap, target)
        target -= cap
        const type = TYPE_BY_CAP[cap as 1 | 2 | 3 | 4]
        const number = `${floor}${(i + bi * 50).toString().padStart(2, '0')}`
        const id = `${p.id}-r${number}`
        const amenities = ['Study table', 'Wardrobe', ...shuffle(AMENITY_POOL.filter((a) => a !== 'Study table' && a !== 'Wardrobe')).slice(0, ri(1, 3))]
        rooms.push({
          id, propertyId: p.id, building, floor, number, type,
          rent: Math.round((BASE_RENT[type] * cfg.rentMult) / 500) * 500,
          amenities,
        })
        for (let b = 0; b < cap; b++) {
          beds.push({ id: `${id}-${'ABCD'[b]}`, roomId: id, propertyId: p.id, label: 'ABCD'[b]!, status: 'vacant', studentId: null })
        }
        i++
      }
    }
  })
  return { rooms, beds }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function createSeedData(): AppData {
  rand = mulberry32(20260925)
  usedNames = new Set<string>(RESERVED_NAMES)
  const properties: Property[] = CONFIGS.map((c) => c.property)
  const rooms: Room[] = []
  const beds: Bed[] = []
  const students: Student[] = []
  const dues: Due[] = []
  const transactions: Transaction[] = []
  let receipt = 1001

  const roomById = new Map<string, Room>()

  for (const cfg of CONFIGS) {
    const p = cfg.property
    const built = buildRooms(cfg)
    built.rooms.forEach((rm) => roomById.set(rm.id, rm))
    rooms.push(...built.rooms)
    beds.push(...built.beds)

    const forced = p.id === 'p1' ? new Set(['p1-r204-A', 'p1-r204-B', 'p1-r204-C', 'p1-r204-D']) : new Set<string>()
    const pool = shuffle(built.beds.filter((b) => !forced.has(b.id)))
    const occupiedTarget = cfg.occupied - (p.id === 'p1' ? 2 : 0)
    const occBeds = pool.slice(0, occupiedTarget)
    pool.slice(occupiedTarget, occupiedTarget + cfg.reserved).forEach((b) => (b.status = 'reserved'))
    pool.slice(occupiedTarget + cfg.reserved, occupiedTarget + cfg.reserved + cfg.maintenance).forEach((b) => (b.status = 'maintenance'))

    const assign: { bed: Bed; name?: string; id?: string }[] = []
    if (p.id === 'p1') {
      assign.push({ bed: built.beds.find((b) => b.id === 'p1-r204-B')!, name: 'Rahul Sharma', id: 's-rahul' })
      assign.push({ bed: built.beds.find((b) => b.id === 'p1-r204-A')!, name: 'Aman Kumar', id: 's-aman' })
    }
    const curM = p.id === 'p1' ? [...CURATED_M] : []
    const curF = p.id === 'p1' ? [...CURATED_F] : []
    // Sort so curated names land on low room numbers (easy to find in demo)
    const sortedOcc = [...occBeds].sort((a, b) => a.id.localeCompare(b.id))
    for (const bed of sortedOcc) {
      const rm = roomById.get(bed.roomId)!
      const g = cfg.genders[p.buildings.indexOf(rm.building)]!
      const cur = g === 'M' ? curM : curF
      const name = cur.length && r() < 0.35 ? cur.shift()! : undefined
      assign.push({ bed, name })
    }
    // Any curated names not yet placed: put them on remaining beds
    for (const bed of sortedOcc) {
      const a = assign.find((x) => x.bed === bed)!
      if (a.name) continue
      const rm = roomById.get(bed.roomId)!
      const g = cfg.genders[p.buildings.indexOf(rm.building)]!
      const cur = g === 'M' ? curM : curF
      if (cur.length) a.name = cur.shift()
    }

    let sIdx = 0
    for (const a of assign) {
      const rm = roomById.get(a.bed.roomId)!
      const g = cfg.genders[p.buildings.indexOf(rm.building)]!
      const name = a.name ?? randomName(g)
      const id = a.id ?? `s-${p.id}-${(++sIdx).toString().padStart(3, '0')}`
      const join = a.id === 's-rahul' ? '2025-07-15' : a.id === 's-aman' ? '2025-07-18' : randomJoin()
      const last = name.split(' ')[1]!
      const student: Student = {
        id, propertyId: p.id, name, gender: name === 'Rahul Sharma' || name === 'Aman Kumar' ? 'M' : g,
        phone: a.id === 's-rahul' ? '9827312456' : phone(),
        email: a.id === 's-rahul' ? 'rahul.sharma21@gmail.com' : emailFor(name),
        guardianName: a.id === 's-rahul' ? 'Rajesh Sharma' : `${pick(GUARDIAN_FIRST)} ${last}`,
        guardianPhone: phone(), college: a.id === 's-rahul' ? p.colleges[0]! : pick(p.colleges),
        course: a.id === 's-rahul' ? 'B.Tech CSE' : pick(COURSES),
        idNumber: `XXXX XXXX ${ri(1000, 9999)}`, bedId: a.bed.id, status: 'active', joinDate: join,
        monthlyRent: rm.rent, deposit: Math.round((rm.rent * 1.5) / 1000) * 1000,
        bloodGroup: pick(BLOOD), hometown: a.id === 's-rahul' ? 'Ujjain, MP' : pick(HOMETOWNS),
      }
      a.bed.status = 'occupied'
      a.bed.studentId = id
      students.push(student)
    }

    // Students awaiting allocation / checked out (manager demo cases)
    if (p.id === 'p1') {
      students.push(extraStudent('s-harsh', p, 'Harsh Agarwal', 'M', 9000, '2026-09-24'))
      students.push(extraStudent('s-riya', p, 'Riya Kapoor', 'F', 9000, '2026-09-24'))
      for (let k = 0; k < 3; k++) {
        const g = k === 1 ? 'F' : 'M'
        const s = extraStudent(`s-p1-out-${k}`, p, randomName(g), g, 8500, '2025-07-10')
        s.status = 'checked-out'
        s.checkoutDate = `2026-08-${(10 + k * 6).toString()}`
        students.push(s)
      }
    }

    // Dues & payments
    const cycles = p.id === 'p1' ? ['2026-07', '2026-08', '2026-09', '2026-10'] : ['2026-09', '2026-10']
    for (const s of students.filter((x) => x.propertyId === p.id && x.bedId)) {
      for (const cycle of cycles) {
        const dueDate = `${cycle}-05`
        if (s.joinDate >= dueDate) continue
        const due: Due = { id: `d-${s.id}-${cycle}`, studentId: s.id, propertyId: p.id, cycle, amount: s.monthlyRent, paid: 0, dueDate }
        const roll = r()
        const [y, m] = cycle.split('-').map(Number) as [number, number]
        let payDay = 0
        let payMonth = m
        if (cycle === '2026-10') {
          if (s.id !== 's-rahul' && roll < 0.14) {
            payMonth = 9
            payDay = ri(15, 25)
            due.paid = due.amount
          }
        } else if (cycle === '2026-09') {
          if (s.id === 's-rahul') {
            payDay = 3
            due.paid = due.amount
          } else if (roll < 0.022) {
            // unpaid → overdue
          } else if (roll < 0.045) {
            payDay = ri(3, 12)
            due.paid = Math.round(due.amount / 2 / 500) * 500
          } else {
            payDay = r() < 0.85 ? ri(1, 7) : ri(8, 20)
            due.paid = due.amount
          }
        } else {
          payDay = ri(1, 8)
          due.paid = due.amount
        }
        dues.push(due)
        if (due.paid > 0) {
          const method: PaymentMethod = pickWeighted<PaymentMethod>([['UPI', 55], ['Online (UPI)', 15], ['Bank Transfer', 18], ['Cash', 12]])
          transactions.push({
            id: `t-${due.id}`, receiptNo: `REC-${receipt++}`, dueId: due.id, studentId: s.id, propertyId: p.id,
            amount: due.paid, method, reference: method === 'Cash' ? undefined : `UTR${ri(100000000, 999999999)}`,
            date: dateOn(y, payMonth, payDay, ri(9, 20), ri(0, 59)),
            recordedBy: method.startsWith('Online') ? 'Student app' : p.managerName,
          })
        }
      }
    }
  }

  const byProp = (pid: string) => students.filter((s) => s.propertyId === pid && s.status === 'active' && s.bedId)
  const roomOf = (s: Student) => (s.bedId ? beds.find((b) => b.id === s.bedId)!.roomId : null)

  // -------------------------------------------------------------------------
  // Staff
  // -------------------------------------------------------------------------
  const staff: Staff[] = []
  const P_ALL = ['Students', 'Rooms', 'Payments', 'Complaints', 'Visitors', 'Inventory', 'Reports']
  const p1Staff: [string, Staff['role'], Staff['shift'], Staff['attendance'], number, string[]][] = [
    ['Anita Desai', 'Manager', 'General', 'present', 32000, P_ALL],
    ['Ramesh Patil', 'Maintenance', 'Morning', 'present', 16000, ['Complaints', 'Inventory']],
    ['Suresh Yadav', 'Security', 'Morning', 'present', 14000, ['Visitors']],
    ['Deepak Solanki', 'Security', 'Night', 'present', 14500, ['Visitors']],
    ['Kamla Bai', 'Cleaner', 'Morning', 'present', 11000, ['Complaints']],
    ['Lakshmi Nair', 'Housekeeping', 'Morning', 'leave', 11500, ['Complaints']],
    ['Geeta Sharma', 'Cook', 'Morning', 'present', 15000, ['Inventory']],
    ['Mahesh Verma', 'Electrician', 'General', 'present', 17000, ['Complaints', 'Inventory']],
    ['Sunil Gehlot', 'Plumber', 'General', 'absent', 16500, ['Complaints']],
    ['Farhan Sheikh', 'Housekeeping', 'Evening', 'present', 11000, ['Complaints']],
    ['Pooja Rathore', 'Warden', 'Evening', 'present', 22000, ['Students', 'Rooms', 'Complaints', 'Visitors']],
  ]
  p1Staff.forEach(([name, role, shift, attendance, salary, permissions], i) =>
    staff.push({ id: `st-p1-${i}`, propertyId: 'p1', name, role, shift, attendance, salary, permissions, phone: phone(), joinedOn: `20${ri(19, 25)}-0${ri(1, 9)}-1${ri(0, 9)}` }),
  )
  const OTHER_STAFF: Staff['role'][] = ['Warden', 'Maintenance', 'Security', 'Security', 'Cleaner', 'Cook', 'Electrician', 'Housekeeping']
  for (const cfg of CONFIGS.slice(1)) {
    const p = cfg.property
    staff.push({ id: `st-${p.id}-0`, propertyId: p.id, name: p.managerName, role: 'Manager', shift: 'General', attendance: 'present', salary: 30000, permissions: P_ALL, phone: p.managerPhone, joinedOn: `${p.established}-04-01` })
    OTHER_STAFF.forEach((role, i) => {
      const g = role === 'Cook' || role === 'Housekeeping' ? 'F' : 'M'
      staff.push({
        id: `st-${p.id}-${i + 1}`, propertyId: p.id, name: randomName(g), role,
        shift: role === 'Security' ? (i % 2 ? 'Night' : 'Morning') : pick(['Morning', 'General', 'Evening'] as const),
        attendance: r() < 0.88 ? 'present' : r() < 0.5 ? 'absent' : 'leave',
        salary: ri(11, 20) * 1000, permissions: role === 'Security' ? ['Visitors'] : role === 'Warden' ? ['Students', 'Rooms', 'Complaints', 'Visitors'] : ['Complaints'],
        phone: phone(), joinedOn: `20${ri(20, 25)}-0${ri(1, 9)}-0${ri(1, 9)}`,
      })
    })
  }
  const staffOf = (pid: string, role?: Staff['role']) => staff.filter((s) => s.propertyId === pid && (!role || s.role === role))

  const requirements: StaffRequirement[] = [
    { id: 'rq1', propertyId: 'p1', title: 'Night security guard', openings: 1, note: 'Block B gate, 10 PM – 6 AM', createdAt: at(-6) },
    { id: 'rq2', propertyId: 'p1', title: 'Mess helper', openings: 2, note: 'Needed before Navratri rush', createdAt: at(-3) },
    { id: 'rq3', propertyId: 'p5', title: 'Housekeeping staff', openings: 2, note: 'West Wing', createdAt: at(-9) },
  ]

  // -------------------------------------------------------------------------
  // Complaints
  // -------------------------------------------------------------------------
  const TEMPLATES: [string, ComplaintCategory, Priority, string][] = [
    ['WiFi keeps disconnecting', 'WiFi', 'medium', 'Internet drops every 10–15 minutes in the evening. Unable to attend online classes.'],
    ['Water leakage in washroom', 'Plumbing', 'high', 'Water is leaking from the pipe below the wash basin and the floor stays wet.'],
    ['Tube light flickering', 'Electrical', 'low', 'The tube light near the study table flickers continuously.'],
    ['Room not cleaned for 2 days', 'Cleaning', 'medium', 'Housekeeping has not visited our room since Tuesday.'],
    ['Dinner quality was poor', 'Food', 'medium', 'Dal was undercooked and rotis were cold at dinner yesterday.'],
    ['Broken chair', 'Room', 'low', 'One leg of the study chair is broken and it is unsafe to sit on.'],
    ['Geyser not heating', 'Electrical', 'high', 'No hot water in the morning for the last two days.'],
    ['Washroom tap broken', 'Plumbing', 'medium', 'The tap handle came off and water keeps dripping.'],
    ['Cupboard lock jammed', 'Room', 'medium', 'Cannot open my wardrobe — the lock is stuck.'],
    ['Low water pressure', 'Plumbing', 'low', 'Very low water pressure in the shower during mornings.'],
    ['WiFi slow on 3rd floor', 'WiFi', 'medium', 'Speed is below 2 Mbps on the entire 3rd floor after 8 PM.'],
    ['Mosquito problem in corridor', 'Cleaning', 'medium', 'Lots of mosquitoes near the corridor — fogging needed.'],
    ['Breakfast served late', 'Food', 'low', 'Breakfast started at 8:40 today, we have classes at 9.'],
    ['Window glass cracked', 'Room', 'medium', 'The window glass has a large crack, rain water enters.'],
    ['Switchboard sparking', 'Electrical', 'high', 'Sparks from the switchboard when the charger is plugged in.'],
  ]
  const RESOLVED_TEMPLATES: [string, ComplaintCategory, Priority, string][] = [
    ['WiFi password not working', 'WiFi', 'medium', 'The new WiFi password shared on the notice board does not work.'],
    ['Bathroom drain blocked', 'Plumbing', 'high', 'Water is not draining in the bathroom.'],
    ['Mattress torn', 'Room', 'low', 'Mattress is torn from one side.'],
    ['Fan regulator broken', 'Electrical', 'medium', 'Regulator stuck at speed 1.'],
    ['Dustbin not emptied', 'Cleaning', 'low', 'Corridor dustbin is overflowing.'],
    ['Water cooler not cooling', 'Other', 'medium', 'The 2nd floor water cooler gives warm water.'],
    ['Extra blanket request', 'Room', 'low', 'Need an extra blanket, it gets cold at night.'],
    ['Milk was sour', 'Food', 'high', 'The milk served at breakfast was sour.'],
  ]
  const complaints: Complaint[] = []
  let cNum = 101
  function mkComplaint(pid: string, s: Student | null, t: [string, ComplaintCategory, Priority, string], status: ComplaintStatus, ageDays: number, assignee: Staff | null): Complaint {
    const created = at(-ageDays, ri(8, 21), ri(0, 59))
    const history: Complaint['history'] = [{ at: created, status: 'created', note: 'Complaint submitted', by: s?.name ?? 'Manager' }]
    let updated = created
    if (assignee && status !== 'open') {
      updated = new Date(new Date(created).getTime() + ri(1, 6) * 3600e3).toISOString()
      history.push({ at: updated, status: 'in-progress', note: `Assigned to ${assignee.name}. Work started.`, by: CONFIGS.find((c) => c.property.id === pid)!.property.managerName })
    } else if (assignee) {
      history.push({ at: created, status: 'assigned', note: `Assigned to ${assignee.name}`, by: CONFIGS.find((c) => c.property.id === pid)!.property.managerName })
    }
    if (status === 'resolved') {
      updated = new Date(new Date(updated).getTime() + ri(4, 30) * 3600e3).toISOString()
      history.push({ at: updated, status: 'resolved', note: 'Issue fixed and verified with the student.', by: CONFIGS.find((c) => c.property.id === pid)!.property.managerName })
    }
    return {
      id: `c${cNum}`, number: cNum++, propertyId: pid, studentId: s?.id ?? null, roomId: s ? roomOf(s) : null,
      category: t[1], title: t[0], description: t[3], priority: t[2], status, assignedTo: assignee?.id ?? null,
      hasImage: r() < 0.3, createdAt: created, updatedAt: updated, history,
    }
  }
  const rahul = students.find((s) => s.id === 's-rahul')!
  const ramesh = staff.find((s) => s.name === 'Ramesh Patil')!
  const assigneeFor = (pid: string, cat: ComplaintCategory) => {
    const role: Staff['role'] = cat === 'Electrical' ? 'Electrician' : cat === 'Plumbing' ? 'Plumber' : cat === 'Cleaning' ? 'Cleaner' : cat === 'Food' ? 'Cook' : 'Maintenance'
    return staffOf(pid, role)[0] ?? staffOf(pid, 'Maintenance')[0] ?? null
  }
  // Rahul: older resolved + current in-progress fan complaint
  complaints.push(mkComplaint('p1', rahul, RESOLVED_TEMPLATES[0]!, 'resolved', 15, staffOf('p1', 'Maintenance')[0]!))
  const fan = mkComplaint('p1', rahul, ['Fan not working', 'Electrical', 'high', 'The ceiling fan in Room 204 stopped working last night. It makes a humming sound but does not spin.'], 'in-progress', 1, ramesh)
  complaints.push(fan)
  const usedP1 = new Set<string>(['s-rahul'])
  const takeStudent = (list: Student[], used: Set<string>) => {
    for (let i = 0; i < 30; i++) {
      const s = pick(list)
      if (!used.has(s.id)) {
        used.add(s.id)
        return s
      }
    }
    return pick(list)
  }
  const unresolvedCount: Record<string, number> = { p1: 13, p2: 5, p3: 6, p4: 4, p5: 3 }
  for (const cfg of CONFIGS) {
    const pid = cfg.property.id
    const list = byProp(pid)
    const used = pid === 'p1' ? usedP1 : new Set<string>()
    const temps = shuffle(TEMPLATES).slice(0, unresolvedCount[pid])
    temps.forEach((t, i) => {
      const status: ComplaintStatus = i % 3 === 1 ? 'in-progress' : 'open'
      const assignee = status === 'in-progress' || (i % 4 === 0) ? assigneeFor(pid, t[1]) : null
      complaints.push(mkComplaint(pid, takeStudent(list, used), t, status, ri(0, 5), status === 'open' && i % 4 !== 0 ? null : assignee))
    })
    const res = shuffle(RESOLVED_TEMPLATES).slice(0, pid === 'p1' ? 7 : 4)
    res.forEach((t) => complaints.push(mkComplaint(pid, takeStudent(list, used), t, 'resolved', ri(3, 25), assigneeFor(pid, t[1]))))
  }
  complaints.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // -------------------------------------------------------------------------
  // Leave requests
  // -------------------------------------------------------------------------
  const leaves: LeaveRequest[] = []
  const REASONS = ['Home visit', 'Family function', 'Sister’s wedding', 'Medical check-up at home', 'Festival at home', 'College trip', 'Internship interview', 'Outing with classmates', 'Visiting relatives', 'Diwali shopping']
  leaves.push({ id: 'lv-rahul', studentId: 's-rahul', propertyId: 'p1', type: 'Leave', from: at(1, 9, 0), to: at(2, 20, 0), reason: 'Home visit — Ujjain', status: 'pending', createdAt: at(-1, 21, 12) })
  leaves.push({ id: 'lv-rahul-old', studentId: 's-rahul', propertyId: 'p1', type: 'Leave', from: dateOn(2026, 8, 14, 8), to: dateOn(2026, 8, 17, 19), reason: 'Independence Day long weekend at home', status: 'approved', createdAt: dateOn(2026, 8, 10, 18), decidedAt: dateOn(2026, 8, 11, 10) })
  for (const cfg of CONFIGS) {
    const pid = cfg.property.id
    const list = byProp(pid)
    const used = new Set<string>(['s-rahul'])
    const plan: [LeaveRequest['status'], number, number][] = pid === 'p1'
      ? [['pending', 1, 3], ['pending', 2, 4], ['pending', 0, 0], ['pending', 3, 6], ['pending', 1, 2], ['pending', 4, 5], ['approved', -2, 3], ['approved', -1, 2], ['approved', 2, 5], ['approved', -12, -9], ['approved', -20, -17], ['rejected', 1, 8], ['rejected', -6, -4]]
      : [['pending', 1, 3], ['pending', 2, 4], ['approved', -1, 2], ['approved', -10, -8], ['rejected', 3, 5]]
    for (const [status, fromD, toD] of plan) {
      const s = takeStudent(list, used)
      const outing = fromD === toD
      leaves.push({
        id: `lv-${pid}-${leaves.length}`, studentId: s.id, propertyId: pid, type: outing ? 'Outing' : 'Leave',
        from: at(fromD, outing ? 16 : ri(7, 10), 0), to: at(toD, outing ? 21 : ri(17, 21), outing ? 30 : 0),
        reason: outing ? 'Outing with classmates' : pick(REASONS), status,
        createdAt: at(Math.min(fromD, 0) - ri(1, 3), ri(9, 22), ri(0, 59)),
        decidedAt: status !== 'pending' ? at(Math.min(fromD, 0) - 1, 11, 0) : undefined,
        decisionNote: status === 'rejected' ? 'Mid-semester exams scheduled — please reapply after exams.' : undefined,
      })
    }
  }

  // -------------------------------------------------------------------------
  // Visitors
  // -------------------------------------------------------------------------
  const visitors: Visitor[] = []
  const VISITOR_FIRST = ['Sunita', 'Rekha', 'Anil', 'Manoj', 'Kavita', 'Rohan', 'Priyanka', 'Ajay', 'Seema', 'Vikas', 'Nisha', 'Sandeep']
  const RELATIONS: [string, string][] = [['Mother', 'Family visit'], ['Father', 'Dropping essentials'], ['Brother', 'Family visit'], ['Sister', 'Birthday visit'], ['Uncle', 'Family visit'], ['Friend', 'Project discussion'], ['Cousin', 'Family visit']]
  visitors.push({ id: 'v-rahul-1', studentId: 's-rahul', propertyId: 'p1', name: 'Sunita Sharma', phone: phone(), relation: 'Mother', purpose: 'Dropping winter clothes', expectedAt: at(2, 11, 0), status: 'approved', createdAt: at(-1, 19, 0) })
  visitors.push({ id: 'v-rahul-2', studentId: 's-rahul', propertyId: 'p1', name: 'Rajesh Sharma', phone: phone(), relation: 'Father', purpose: 'Family visit', expectedAt: at(-18, 16, 0), status: 'checked-out', checkInAt: at(-18, 16, 10), checkOutAt: at(-18, 18, 5), createdAt: at(-19, 20, 0) })
  for (const cfg of CONFIGS) {
    const pid = cfg.property.id
    const list = byProp(pid)
    const plan: [Visitor['status'], number, number][] = pid === 'p1'
      ? [['checked-out', 0, 10], ['checked-in', 0, 12], ['approved', 0, 16], ['approved', 0, 18], ['pending', 0, 17], ['pending', 1, 11], ['approved', 1, 15], ['approved', 3, 12], ['checked-out', -1, 15], ['checked-out', -2, 11], ['checked-out', -3, 17], ['checked-out', -5, 12], ['rejected', -2, 21], ['checked-out', -7, 14]]
      : [['checked-in', 0, 11], ['approved', 0, 17], ['pending', 1, 12], ['checked-out', -1, 15], ['checked-out', -4, 12]]
    for (const [status, day, hh] of plan) {
      const s = pick(list)
      const [relation, purpose] = pick(RELATIONS)
      const last = relation === 'Friend' ? pick(LAST) : s.name.split(' ')[1]
      const expectedAt = at(day, hh, pick([0, 15, 30]))
      visitors.push({
        id: `v-${pid}-${visitors.length}`, studentId: s.id, propertyId: pid, name: `${pick(VISITOR_FIRST)} ${last}`, phone: phone(),
        relation, purpose, expectedAt, status, createdAt: at(day - 1, 20, 0),
        checkInAt: status === 'checked-in' || status === 'checked-out' ? at(day, hh, 10) : undefined,
        checkOutAt: status === 'checked-out' ? at(day, hh + 1, 40) : undefined,
      })
    }
  }

  // -------------------------------------------------------------------------
  // Maintenance
  // -------------------------------------------------------------------------
  const maintenance: MaintenanceTask[] = []
  const p1staff = (role: Staff['role']) => staffOf('p1', role)[0]!.id
  const tapComplaint = complaints.find((c) => c.propertyId === 'p1' && c.title === 'Washroom tap broken')
  maintenance.push(
    { id: 'm1', propertyId: 'p1', title: 'Fan replacement', roomId: 'p1-r204', complaintId: fan.id, assignedTo: ramesh.id, priority: 'high', cost: 1200, status: 'in-progress', createdAt: at(-1, 10) },
    { id: 'm2', propertyId: 'p1', title: 'Washroom tap repair', roomId: tapComplaint?.roomId ?? null, complaintId: tapComplaint?.id ?? null, assignedTo: p1staff('Plumber'), priority: 'medium', cost: 450, status: 'in-progress', createdAt: at(-2, 12) },
    { id: 'm3', propertyId: 'p1', title: 'Overhead water tank cleaning', roomId: null, complaintId: null, assignedTo: p1staff('Plumber'), priority: 'medium', cost: 3500, status: 'open', createdAt: at(-1, 9) },
    { id: 'm4', propertyId: 'p1', title: 'Repaint common room', roomId: null, complaintId: null, assignedTo: null, priority: 'low', cost: 12000, status: 'open', createdAt: at(-4, 15) },
    { id: 'm5', propertyId: 'p1', title: 'Replace corridor lights — Floor 3', roomId: null, complaintId: null, assignedTo: p1staff('Electrician'), priority: 'medium', cost: 2400, status: 'open', createdAt: at(-3, 11) },
    { id: 'm6', propertyId: 'p1', title: 'CCTV camera repair — main gate', roomId: null, complaintId: null, assignedTo: p1staff('Electrician'), priority: 'high', cost: 1800, status: 'done', createdAt: at(-7, 10), completedAt: at(-5, 17) },
    { id: 'm7', propertyId: 'p1', title: 'RO purifier service', roomId: null, complaintId: null, assignedTo: ramesh.id, priority: 'medium', cost: 2200, status: 'done', createdAt: at(-12, 10), completedAt: at(-10, 14) },
    { id: 'm8', propertyId: 'p1', title: 'Mattress replacement', roomId: 'p1-r103', complaintId: null, assignedTo: p1staff('Housekeeping'), priority: 'low', cost: 3200, status: 'done', createdAt: at(-16, 10), completedAt: at(-15, 13) },
  )
  const M_TEMPLATES: [string, number][] = [['Lift servicing', 6500], ['Generator maintenance', 4800], ['Terrace waterproofing', 18000], ['Pest control — all floors', 5500], ['Geyser replacement', 7200], ['Door lock replacement', 900]]
  for (const cfg of CONFIGS.slice(1)) {
    const pid = cfg.property.id
    shuffle(M_TEMPLATES).slice(0, 4).forEach(([title, cost], i) => {
      const status = (['open', 'in-progress', 'done', 'done'] as const)[i]!
      maintenance.push({ id: `m-${pid}-${i}`, propertyId: pid, title, roomId: null, complaintId: null, assignedTo: staffOf(pid, 'Maintenance')[0]?.id ?? null, priority: pick(['low', 'medium', 'high'] as const), cost, status, createdAt: at(-ri(2, 14), 10), completedAt: status === 'done' ? at(-ri(0, 2), 16) : undefined })
    })
  }

  // -------------------------------------------------------------------------
  // Inventory
  // -------------------------------------------------------------------------
  const inventory: InventoryItem[] = []
  const ITEMS: [string, InventoryItem['category'], number, number, string, number][] = [
    ['Mattresses', 'Bedding', 42, 15, 'pcs', 3200],
    ['Chairs', 'Furniture', 18, 10, 'pcs', 1400],
    ['Ceiling fans', 'Electrical', 7, 10, 'pcs', 1850],
    ['Buckets', 'Cleaning', 32, 20, 'pcs', 180],
    ['LED tube lights', 'Electrical', 24, 15, 'pcs', 320],
    ['Bedsheets', 'Bedding', 120, 60, 'pcs', 450],
    ['Pillows', 'Bedding', 64, 40, 'pcs', 350],
    ['Study tables', 'Furniture', 6, 5, 'pcs', 3800],
    ['RO filter cartridges', 'Kitchen', 3, 4, 'pcs', 900],
    ['Phenyl (5L can)', 'Cleaning', 12, 8, 'cans', 420],
    ['Door locks', 'Hardware', 9, 10, 'pcs', 380],
    ['Gas cylinders (commercial)', 'Kitchen', 5, 3, 'pcs', 1950],
  ]
  for (const cfg of CONFIGS) {
    const pid = cfg.property.id
    ITEMS.forEach(([name, category, stock, min, unit, unitCost], i) => {
      const scale = cfg.beds / 250
      const st = pid === 'p1' ? stock : Math.max(0, Math.round(stock * scale * (0.5 + r())))
      const mn = pid === 'p1' ? min : Math.max(2, Math.round(min * scale))
      inventory.push({
        id: `inv-${pid}-${i}`, propertyId: pid, name, category, stock: st, min: mn, unit, unitCost,
        log: pid === 'p1' && name === 'Ceiling fans'
          ? [
              { id: 'l1', delta: -1, kind: 'damaged', note: 'Motor burnt — Room 118', date: at(-3, 12) },
              { id: 'l2', delta: -2, kind: 'issued', note: 'Issued to Room 207 & 311', date: at(-8, 11) },
              { id: 'l3', delta: 10, kind: 'purchased', note: 'Purchased from Sharma Electricals', date: at(-20, 15) },
            ]
          : [
              { id: `l-${pid}-${i}-1`, delta: -ri(1, 4), kind: 'issued', note: 'Issued for room replacement', date: at(-ri(1, 9), 12) },
              { id: `l-${pid}-${i}-2`, delta: ri(5, 20), kind: 'purchased', note: 'Monthly restock', date: at(-ri(12, 24), 15) },
            ],
      })
    })
  }

  // -------------------------------------------------------------------------
  // Announcements & events
  // -------------------------------------------------------------------------
  const announcements: Announcement[] = [
    { id: 'an1', propertyId: 'p1', title: 'Water maintenance today', message: 'Water supply will be unavailable from 2 PM to 4 PM today due to overhead tank cleaning. Please store water in advance.', category: 'Maintenance', audience: 'all', pinned: true, createdAt: at(0, 8, 30), author: 'Anita Desai' },
    { id: 'an2', propertyId: 'p1', title: 'October rent due by 5 Oct', message: 'Monthly rent for October is due on 5 October. A late fee of ₹50/day applies after the due date. Pay from the app to get an instant receipt.', category: 'Important', audience: 'all', pinned: false, createdAt: at(-1, 10, 0), author: 'Anita Desai' },
    { id: 'an3', propertyId: 'p1', title: 'Freshers Party on 5 October', message: 'Join us in the Block A lawn at 7 PM for the Freshers Party. Dinner, DJ and fun games. Register at the reception by 2 Oct.', category: 'Event', audience: 'all', pinned: false, createdAt: at(-2, 17, 0), author: 'Pooja Rathore' },
    { id: 'an4', propertyId: 'p1', title: 'WiFi router upgrade — Floor 2', message: 'New WiFi routers will be installed on Floor 2 tomorrow between 11 AM and 1 PM. Expect short interruptions.', category: 'Maintenance', audience: 'floor', audienceValue: '2', pinned: false, createdAt: at(-2, 12, 0), author: 'Anita Desai' },
    { id: 'an5', propertyId: 'p1', title: 'Fire safety drill on 29 Sep', message: 'A mandatory fire safety drill will be conducted at 6 PM on 29 September. Assemble at the main gate when the alarm sounds.', category: 'Important', audience: 'all', pinned: false, createdAt: at(-4, 9, 0), author: 'Anita Desai' },
    { id: 'an6', propertyId: 'p1', title: 'Navratri special mess menu', message: 'Fasting (vrat) thali will be available on request during Navratri. Inform the mess by 9 PM the previous day.', category: 'General', audience: 'all', pinned: false, createdAt: at(-6, 18, 0), author: 'Geeta Sharma' },
  ]
  for (const cfg of CONFIGS.slice(1)) {
    const p = cfg.property
    announcements.push(
      { id: `an-${p.id}-1`, propertyId: p.id, title: 'October rent due by 5 Oct', message: 'Monthly rent for October is due on 5 October.', category: 'Important', audience: 'all', pinned: false, createdAt: at(-1, 10), author: p.managerName },
      { id: `an-${p.id}-2`, propertyId: p.id, title: 'Pest control this Sunday', message: 'Pest control will be done floor-wise on Sunday from 10 AM. Keep food items sealed.', category: 'Maintenance', audience: 'all', pinned: false, createdAt: at(-3, 11), author: p.managerName },
    )
  }
  const events: HostelEvent[] = [
    { id: 'e1', propertyId: 'p1', name: 'Freshers Party', date: '2026-10-05', location: 'Block A lawn', description: 'Welcome evening for the new batch with dinner, DJ and games.', participants: 180, budget: 30000, status: 'Planning', rsvps: [] },
    { id: 'e2', propertyId: 'p1', name: 'Garba Night', date: '2026-10-17', location: 'Terrace, Block B', description: 'Navratri garba and dandiya with live dhol.', participants: 150, budget: 25000, status: 'Planning', rsvps: [] },
    { id: 'e3', propertyId: 'p1', name: 'Diwali Dinner', date: '2026-11-07', location: 'Mess hall', description: 'Festive dinner and rangoli competition before the Diwali break.', participants: 200, budget: 40000, status: 'Planning', rsvps: [] },
    { id: 'e4', propertyId: 'p1', name: 'Ganesh Chaturthi Celebration', date: '2026-09-14', location: 'Reception hall', description: 'Aarti, prasad and cultural evening.', participants: 170, budget: 18000, status: 'Completed', rsvps: [] },
    { id: 'e5', propertyId: 'p1', name: 'Independence Day', date: '2026-08-15', location: 'Main gate', description: 'Flag hoisting and breakfast.', participants: 120, budget: 8000, status: 'Completed', rsvps: [] },
    { id: 'e6', propertyId: 'p1', name: 'Inter-hostel Cricket Cup', date: '2026-07-26', location: 'City sports ground', description: 'T10 tournament with 6 teams.', participants: 60, budget: 12000, status: 'Completed', rsvps: [] },
    { id: 'e7', propertyId: 'p2', name: 'Freshers Welcome', date: '2026-10-03', location: 'Common room', description: 'Welcome evening.', participants: 120, budget: 18000, status: 'Confirmed', rsvps: [] },
    { id: 'e8', propertyId: 'p3', name: 'Hackathon Night', date: '2026-10-10', location: 'Tower 1 co-working', description: '12-hour hackathon with prizes.', participants: 90, budget: 35000, status: 'Planning', rsvps: [] },
    { id: 'e9', propertyId: 'p4', name: 'Navratri Garba', date: '2026-10-15', location: 'Terrace', description: 'Garba night.', participants: 140, budget: 20000, status: 'Planning', rsvps: [] },
    { id: 'e10', propertyId: 'p5', name: 'Open Mic Evening', date: '2026-09-12', location: 'Rooftop café', description: 'Music, poetry and stand-up.', participants: 70, budget: 15000, status: 'Completed', rsvps: [] },
  ]

  // -------------------------------------------------------------------------
  // Feedback
  // -------------------------------------------------------------------------
  const feedback: Feedback[] = []
  const COMMENTS = ['Food has improved this month.', 'WiFi is very slow at night.', 'Housekeeping staff is very polite.', 'Please add more variety in breakfast.', 'Security guards are always alert — feels safe.', 'Washrooms need more frequent cleaning.', 'Maintenance requests are resolved quickly now.', 'Mess timings should be extended on weekends.', 'Gym equipment would be great.', '']
  for (const cfg of CONFIGS) {
    const pid = cfg.property.id
    const list = byProp(pid).filter((s) => s.id !== 's-rahul')
    const means: Record<FeedbackCategory, number> = {
      cleanliness: 4.0 + cfg.mood, food: cfg.foodMean, maintenance: 3.7 + cfg.mood, staff: 4.2 + cfg.mood, safety: 4.4 + cfg.mood / 2, wifi: 3.2 + cfg.mood,
    }
    for (const [month, share, lift] of [['2026-08', 0.55, -0.15], ['2026-09', 0.5, 0]] as const) {
      const n = Math.round(list.length * (pid === 'p1' ? share : share * 0.35))
      shuffle(list).slice(0, n).forEach((s, i) => {
        const ratings = {} as Record<FeedbackCategory, number>
        for (const c of FEEDBACK_CATEGORIES) ratings[c] = Math.max(1, Math.min(5, Math.round(means[c] + lift + (r() - 0.5) * 2.2)))
        feedback.push({ id: `fb-${pid}-${month}-${i}`, studentId: s.id, propertyId: pid, month, ratings, comment: r() < 0.25 ? pick(COMMENTS) : '', createdAt: month === '2026-09' ? at(-ri(0, 10), 20) : dateOn(2026, 8, ri(22, 31), 20) })
      })
    }
  }

  // -------------------------------------------------------------------------
  // Expenses (current month; history is synthesized in analytics)
  // -------------------------------------------------------------------------
  const expenses: Expense[] = []
  for (const cfg of CONFIGS) {
    const pid = cfg.property.id
    const occ = cfg.occupied
    const salaries = staffOf(pid).reduce((a, s) => a + s.salary, 0)
    const rows: [Expense['category'], number, string, number][] = [
      ['Salaries', salaries, 'Staff salaries — August payroll', 1],
      ['Electricity', Math.round(cfg.beds * 340 * cfg.rentMult), 'MPEB / state electricity bill', 8],
      ['Water', Math.round(cfg.beds * 55), 'Municipal water + tanker', 9],
      ['Groceries', Math.round(occ * 1150 * cfg.rentMult), 'Mess groceries — first half', 3],
      ['Groceries', Math.round(occ * 1050 * cfg.rentMult), 'Mess groceries — second half', 18],
      ['Internet', ri(15, 28) * 1000, 'Leased line + WiFi AMC', 5],
      ['Supplies', ri(18, 30) * 1000, 'Housekeeping & cleaning supplies', 12],
    ]
    rows.forEach(([category, amount, description, day], i) =>
      expenses.push({ id: `ex-${pid}-${i}`, propertyId: pid, category, amount, description, date: `2026-09-${day.toString().padStart(2, '0')}` }),
    )
  }
  for (const m of maintenance.filter((x) => x.status === 'done')) {
    expenses.push({ id: `ex-${m.id}`, propertyId: m.propertyId, category: 'Maintenance', amount: m.cost, description: m.title, date: isoDate(new Date(m.completedAt!)) })
  }
  expenses.push({ id: 'ex-ev-e4', propertyId: 'p1', category: 'Events', amount: 18000, description: 'Ganesh Chaturthi Celebration', date: '2026-09-14' })

  // -------------------------------------------------------------------------
  // Activity
  // -------------------------------------------------------------------------
  const activity: Activity[] = []
  const priya = students.find((s) => s.name === 'Priya Singh')
  const ankit = students.find((s) => s.name === 'Ankit Gupta')
  const p1Recent = complaints.filter((c) => c.propertyId === 'p1' && c.status !== 'resolved').slice(0, 3)
  const nm = (id: string | null) => students.find((s) => s.id === id)?.name ?? 'A student'
  activity.push(
    { id: 'a1', propertyId: 'p1', kind: 'announcement', message: 'Announcement published: Water maintenance today', at: at(0, 8, 30), actor: 'Anita Desai' },
    { id: 'a2', propertyId: 'p1', kind: 'complaint', message: `${nm(p1Recent[0]?.studentId ?? null)} submitted a complaint: ${p1Recent[0]?.title}`, at: p1Recent[0]?.createdAt ?? at(0, 7), actor: nm(p1Recent[0]?.studentId ?? null) },
    { id: 'a3', propertyId: 'p1', kind: 'payment', message: 'Aman Kumar paid ₹8,000 for October', at: at(-1, 18, 42), actor: 'Aman Kumar', studentId: 's-aman' },
    { id: 'a4', propertyId: 'p1', kind: 'leave', message: 'Rahul Sharma requested leave for 26 Sep – 27 Sep', at: at(-1, 21, 12), actor: 'Rahul Sharma', studentId: 's-rahul' },
    { id: 'a5', propertyId: 'p1', kind: 'complaint', message: 'Complaint #' + fan.number + ' "Fan not working" assigned to Ramesh Patil', at: fan.history[1]?.at ?? at(-1), actor: 'Anita Desai', roomId: 'p1-r204' },
    { id: 'a6', propertyId: 'p1', kind: 'complaint', message: 'Rahul Sharma submitted a complaint: Fan not working', at: fan.createdAt, actor: 'Rahul Sharma', studentId: 's-rahul', roomId: 'p1-r204' },
    { id: 'a7', propertyId: 'p1', kind: 'student', message: 'Harsh Agarwal and Riya Kapoor admitted — awaiting bed allocation', at: at(-1, 12, 5), actor: 'Anita Desai' },
    { id: 'a8', propertyId: 'p1', kind: 'inventory', message: 'Ceiling fans: 1 marked damaged (Room 118)', at: at(-3, 12), actor: 'Ramesh Patil' },
    { id: 'a9', propertyId: 'p1', kind: 'maintenance', message: 'CCTV camera repair — main gate completed (₹1,800)', at: at(-5, 17), actor: 'Mahesh Verma' },
    { id: 'a10', propertyId: 'p1', kind: 'visitor', message: 'Visitor checked in at the main gate', at: at(0, 12, 10), actor: 'Suresh Yadav' },
    { id: 'a11', propertyId: 'p1', kind: 'room', message: 'Aman Kumar assigned to Room 204-A', at: '2025-07-18T10:00:00.000Z', actor: 'Anita Desai', studentId: 's-aman', roomId: 'p1-r204' },
    { id: 'a12', propertyId: 'p1', kind: 'room', message: 'Rahul Sharma assigned to Room 204-B', at: '2025-07-15T10:00:00.000Z', actor: 'Anita Desai', studentId: 's-rahul', roomId: 'p1-r204' },
    { id: 'a13', propertyId: 'p1', kind: 'room', message: 'Room 204: Bed C vacated (checkout)', at: '2026-05-30T11:00:00.000Z', actor: 'Anita Desai', roomId: 'p1-r204' },
  )
  if (priya) activity.push({ id: 'a14', propertyId: 'p1', kind: 'payment', message: 'Priya Singh paid ₹' + priya.monthlyRent.toLocaleString('en-IN') + ' for October', at: at(-2, 11, 20), actor: 'Priya Singh', studentId: priya.id })
  if (ankit) activity.push({ id: 'a15', propertyId: 'p1', kind: 'visitor', message: 'Ankit Gupta registered a visitor', at: at(-2, 20, 5), actor: 'Ankit Gupta', studentId: ankit.id })
  for (const cfg of CONFIGS.slice(1)) {
    const p = cfg.property
    activity.push(
      { id: `a-${p.id}-1`, propertyId: p.id, kind: 'payment', message: `${pick(byProp(p.id)).name} paid rent for October`, at: at(-ri(0, 1), ri(9, 20)), actor: p.managerName },
      { id: `a-${p.id}-2`, propertyId: p.id, kind: 'complaint', message: `New complaint: ${pick(TEMPLATES)[0]}`, at: at(-ri(0, 2), ri(9, 20)), actor: p.managerName },
      { id: `a-${p.id}-3`, propertyId: p.id, kind: 'announcement', message: 'Announcement published: October rent due by 5 Oct', at: at(-1, 10), actor: p.managerName },
    )
  }
  activity.sort((a, b) => b.at.localeCompare(a.at))

  // Also make the seeded p1 Aman payment consistent with his October due
  const amanOct = dues.find((d) => d.id === 'd-s-aman-2026-10')
  if (amanOct && amanOct.paid === 0) {
    amanOct.paid = amanOct.amount
    transactions.push({ id: 't-aman-oct', receiptNo: `REC-${receipt++}`, dueId: amanOct.id, studentId: 's-aman', propertyId: 'p1', amount: amanOct.amount, method: 'UPI', reference: 'UTR582019374', date: at(-1, 18, 42), recordedBy: 'Anita Desai' })
  }

  const rahulSep = transactions.find((t) => t.dueId === 'd-s-rahul-2026-09')
  const studentNotifications: StudentNotification[] = [
    { id: 'sn1', studentId: 's-rahul', title: 'Complaint in progress', body: `Ramesh Patil has been assigned to “Fan not working” (#${fan.number}).`, link: '/student/complaints', at: fan.history[1]?.at ?? at(-1), read: false },
    { id: 'sn2', studentId: 's-rahul', title: 'New announcement', body: 'Water maintenance today, 2 PM – 4 PM.', link: '/student/notices', at: at(0, 8, 30), read: false },
    { id: 'sn3', studentId: 's-rahul', title: 'Payment received', body: `Receipt ${rahulSep?.receiptNo ?? ''} for September rent is available.`, link: '/student/rent', at: rahulSep?.date ?? at(-22), read: true },
  ]

  return {
    version: DATA_VERSION,
    properties, rooms, beds, students, dues, transactions, complaints, leaves, visitors, staff, requirements,
    maintenance, inventory, announcements, events, feedback, expenses, activity, alerts: [], studentNotifications,
    documents: [{ id: 'doc1', studentId: 's-rahul', name: 'College ID card.pdf', kind: 'ID Proof', size: '412 KB', uploadedAt: '2025-07-15T10:30:00.000Z' }],
    settings: { orgName: 'StayPookie Hostels Pvt. Ltd.', gstin: '23AAKCM4821Q1Z5', lateFeePerDay: 50, rentDueDay: 5, notifyOverdue: true, notifyEmergency: true, notifyWeeklyDigest: false },
    counters: { receipt, complaint: cNum },
  }
}

function randomJoin() {
  // Most students join around July/August (academic year start)
  const year = r() < 0.55 ? 2025 : 2026
  const month = year === 2026 ? pick([1, 3, 6, 7, 7, 8, 8]) : pick([6, 7, 7, 8, 8, 9, 11])
  const day = ri(1, month === 8 && year === 2026 ? 20 : 28)
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

function extraStudent(id: string, p: Property, name: string, gender: 'M' | 'F', rent: number, join: string): Student {
  return {
    id, propertyId: p.id, name, gender, phone: phone(), email: emailFor(name),
    guardianName: `${pick(GUARDIAN_FIRST)} ${name.split(' ')[1]}`, guardianPhone: phone(), college: pick(p.colleges), course: pick(COURSES),
    idNumber: `XXXX XXXX ${ri(1000, 9999)}`, bedId: null, status: 'active', joinDate: join, monthlyRent: rent, deposit: 12000,
    bloodGroup: pick(BLOOD), hometown: pick(HOMETOWNS),
  }
}

function pickWeighted<T>(items: [T, number][]): T {
  const total = items.reduce((a, [, w]) => a + w, 0)
  let x = r() * total
  for (const [v, w] of items) {
    x -= w
    if (x <= 0) return v
  }
  return items[0]![0]
}
