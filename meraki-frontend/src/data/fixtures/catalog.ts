import type { OrganizationSettings, Property, RoomType, StaffMember, SubscriptionPlan } from '@/types/domain';

/** Fictional names only. */
export const MALE_FIRST = ['Aarav', 'Vihaan', 'Aditya', 'Arjun', 'Kabir', 'Ishaan', 'Rohan', 'Siddharth', 'Karan', 'Yash', 'Nikhil', 'Harsh', 'Dev', 'Ankit', 'Pranav', 'Tanmay', 'Shivam', 'Ayaan', 'Faiz', 'Manav', 'Kunal', 'Varun', 'Abhinav', 'Saurabh', 'Gaurav', 'Mohit', 'Raghav', 'Utkarsh'];
export const FEMALE_FIRST = ['Ananya', 'Diya', 'Ishita', 'Kavya', 'Meera', 'Riya', 'Saanvi', 'Tanvi', 'Aditi', 'Nandini', 'Pooja', 'Sneha', 'Aisha', 'Zoya', 'Shruti', 'Palak', 'Simran', 'Neha', 'Muskan', 'Khushi'];
export const SURNAMES = ['Verma', 'Gupta', 'Srivastava', 'Mishra', 'Tiwari', 'Pandey', 'Yadav', 'Singh', 'Agarwal', 'Saxena', 'Rastogi', 'Chauhan', 'Shukla', 'Dubey', 'Khan', 'Siddiqui', 'Bajpai', 'Tripathi', 'Awasthi', 'Kapoor', 'Joshi', 'Nigam', 'Rizvi', 'Bhatia'];
export const COLLEGES = [
  { college: 'Lucknow University', courses: ['B.Com', 'B.Sc Physics', 'BA Economics', 'M.Com'] },
  { college: 'Amity University Lucknow', courses: ['B.Tech CSE', 'BBA', 'B.Tech ECE', 'MBA'] },
  { college: 'Integral University', courses: ['B.Pharm', 'B.Tech Civil', 'BCA'] },
  { college: 'BBAU Lucknow', courses: ['B.Sc Biotech', 'LLB', 'M.Sc Chemistry'] },
  { college: 'IET Lucknow', courses: ['B.Tech ME', 'B.Tech CSE', 'B.Tech EE'] },
];
export const HOMETOWNS = ['Kanpur', 'Prayagraj', 'Varanasi', 'Gorakhpur', 'Bareilly', 'Ayodhya', 'Sitapur', 'Hardoi', 'Patna', 'Jhansi', 'Agra', 'Meerut', 'Bahraich', 'Raebareli'];
export const BLOOD_GROUPS = ['A+', 'B+', 'O+', 'AB+', 'O-', 'B-', 'A-'];

export const PLANS: SubscriptionPlan[] = [
  { id: 'plan_starter', tier: 'starter', name: 'Starter', pricePerMonth: 2499, propertyLimit: 2, bedLimit: 120, staffLimit: 10,
    features: ['Rooms, beds & students', 'Rent ledger & receipts', 'Complaints & notices', 'Email support'] },
  { id: 'plan_growth', tier: 'growth', name: 'Growth', pricePerMonth: 6999, propertyLimit: 6, bedLimit: 400, staffLimit: 40,
    features: ['Everything in Starter', 'Leave & visitor management', 'Maintenance & inventory', 'Owner analytics', 'Priority support'] },
  { id: 'plan_portfolio', tier: 'portfolio', name: 'Portfolio', pricePerMonth: 14999, propertyLimit: 25, bedLimit: 2500, staffLimit: 250,
    features: ['Everything in Growth', 'Multi-city portfolio reports', 'Custom roles & approvals', 'Payment gateway integration', 'Dedicated success manager'] },
];

export const SETTINGS: OrganizationSettings = {
  orgName: 'Meraki Living',
  legalName: 'Meraki Living Hospitality Pvt. Ltd.',
  contactEmail: 'hello@merakiliving.example',
  contactPhone: '9415012345',
  address: '3rd Floor, Sahara Ganj Annexe, Shahnajaf Road, Hazratganj, Lucknow 226001',
  gstin: '09AAKCM4821Q1Z6',
  website: 'merakiliving.example',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  rentDueDay: 5,
  lateFeePerDay: 50,
  notifications: { paymentReceived: true, newComplaint: true, leaveRequests: true, lowStock: true, weeklySummary: false },
  security: { twoFactor: false, sessionTimeoutMins: 60 },
};

export const PROPERTIES: Property[] = [
  { id: 'prop_crown', name: 'Crown Boys Residence', code: 'CR', type: 'boys', status: 'active', city: 'Lucknow', locality: 'Aliganj',
    address: 'B-142, Sector K, Aliganj, Lucknow', pincode: '226024', phone: '9415023401', managerStaffId: 'staff_anita', baseRent: 9500,
    amenities: ['Wi-Fi', 'Mess', 'Laundry', 'CCTV', 'Power backup', 'Study room'], openedOn: '2019-07-01', imageVariant: 0 },
  { id: 'prop_hsd', name: 'HSD Loyal Girls Hostel', code: 'HL', type: 'girls', status: 'active', city: 'Lucknow', locality: 'Indira Nagar',
    address: 'C-27, Bhootnath Market Road, Indira Nagar, Lucknow', pincode: '226016', phone: '9415023402', managerStaffId: 'staff_kavita', baseRent: 10500,
    amenities: ['Wi-Fi', 'Mess', 'Biometric entry', 'CCTV', 'Gym'], openedOn: '2020-06-15', imageVariant: 1 },
  { id: 'prop_globus', name: 'Globus Boys PG', code: 'GB', type: 'boys', status: 'active', city: 'Lucknow', locality: 'Gomti Nagar',
    address: '4/118, Vibhuti Khand, Gomti Nagar, Lucknow', pincode: '226010', phone: '9415023403', managerStaffId: 'staff_suresh', baseRent: 8500,
    amenities: ['Wi-Fi', 'Mess', 'Parking', 'Laundry'], openedOn: '2021-01-10', imageVariant: 2 },
  { id: 'prop_sunny', name: 'Sunny Boys Hostel', code: 'SB', type: 'boys', status: 'active', city: 'Lucknow', locality: 'Hazratganj',
    address: '17, Rana Pratap Marg, Hazratganj, Lucknow', pincode: '226001', phone: '9415023404', managerStaffId: 'staff_imran', baseRent: 11000,
    amenities: ['Wi-Fi', 'Mess', 'AC rooms', 'CCTV', 'Power backup'], openedOn: '2018-08-01', imageVariant: 3 },
  { id: 'prop_cosmo', name: 'Cosmo House', code: 'CH', type: 'coed', status: 'onboarding', city: 'Lucknow', locality: 'Kapoorthala',
    address: '9, Kapoorthala Complex Road, Aliganj, Lucknow', pincode: '226024', phone: '9415023405', managerStaffId: 'staff_neha', baseRent: 12000,
    amenities: ['Wi-Fi', 'Co-working lounge', 'Mess', 'CCTV'], openedOn: '2026-08-01', imageVariant: 4 },
];

/** Room layout per property: [number, floor, type, rent, ac]. */
export const ROOM_LAYOUT: Record<string, Array<[string, number, RoomType, number, boolean]>> = {
  prop_crown: [
    ['101', 1, 'double', 9500, false], ['102', 1, 'triple', 8500, false], ['103', 1, 'single', 13000, true],
    ['201', 2, 'double', 9500, false], ['202', 2, 'triple', 8500, false], ['203', 2, 'double', 10500, true],
    ['204', 2, 'double', 10500, true], ['301', 3, 'quad', 7500, false],
  ],
  prop_hsd: [
    ['G01', 0, 'double', 10500, true], ['G02', 0, 'triple', 9500, false], ['101', 1, 'double', 10500, true],
    ['102', 1, 'single', 14000, true], ['103', 1, 'triple', 9500, false], ['201', 2, 'double', 10500, true],
  ],
  prop_globus: [
    ['101', 1, 'triple', 8000, false], ['102', 1, 'double', 8500, false], ['103', 1, 'quad', 7000, false],
    ['201', 2, 'double', 9500, true], ['202', 2, 'triple', 8000, false],
  ],
  prop_sunny: [
    ['A1', 1, 'double', 11000, true], ['A2', 1, 'double', 11000, true], ['A3', 1, 'single', 15500, true],
    ['B1', 2, 'triple', 9500, true], ['B2', 2, 'double', 11000, true], ['B3', 2, 'triple', 9500, true],
  ],
  prop_cosmo: [
    ['1A', 1, 'single', 16000, true], ['1B', 1, 'double', 12000, true], ['2A', 2, 'double', 12000, true],
    ['2B', 2, 'triple', 10500, true], ['3A', 3, 'quad', 9000, false],
  ],
};

/**
 * Bed occupancy pattern per property in bed order: o = occupied, a = available, u = unavailable.
 * Distinct per property so dashboards show different occupancy.
 */
export const OCCUPANCY_PATTERN: Record<string, string> = {
  prop_crown: 'oo ooo o oa ooa oo oo oooa',
  prop_hsd: 'oo oao oo o ooo oa',
  prop_globus: 'ooa oa ooou ou oao',
  prop_sunny: 'oo oo o ooo oo ooa',
  prop_cosmo: 'o oa aa aoa ouaa',
};

export const STAFF: StaffMember[] = [
  { id: 'staff_anita', name: 'Anita Desai', role: 'manager', propertyId: 'prop_crown', phone: '9839011201', email: 'anita.desai@merakiliving.example', shift: 'general', status: 'active', joinedOn: '2021-04-12' },
  { id: 'staff_kavita', name: 'Kavita Rao', role: 'manager', propertyId: 'prop_hsd', phone: '9839011202', email: 'kavita.rao@merakiliving.example', shift: 'general', status: 'active', joinedOn: '2020-06-01' },
  { id: 'staff_suresh', name: 'Suresh Yadav', role: 'manager', propertyId: 'prop_globus', phone: '9839011203', email: 'suresh.yadav@merakiliving.example', shift: 'general', status: 'active', joinedOn: '2021-01-05' },
  { id: 'staff_imran', name: 'Imran Qureshi', role: 'manager', propertyId: 'prop_sunny', phone: '9839011204', email: 'imran.qureshi@merakiliving.example', shift: 'general', status: 'on_leave', joinedOn: '2018-07-20' },
  { id: 'staff_neha', name: 'Neha Kapoor', role: 'manager', propertyId: 'prop_cosmo', phone: '9839011205', email: 'neha.kapoor@merakiliving.example', shift: 'general', status: 'invited', joinedOn: '2026-10-10' },
  { id: 'staff_ramesh', name: 'Ramesh Pal', role: 'security', propertyId: 'prop_crown', phone: '9839011206', email: 'ramesh.pal@merakiliving.example', shift: 'night', status: 'active', joinedOn: '2022-02-01' },
  { id: 'staff_sunita', name: 'Sunita Devi', role: 'housekeeping', propertyId: 'prop_crown', phone: '9839011207', email: 'sunita.devi@merakiliving.example', shift: 'morning', status: 'active', joinedOn: '2020-11-15' },
  { id: 'staff_mohan', name: 'Mohan Lal', role: 'cook', propertyId: 'prop_crown', phone: '9839011208', email: 'mohan.lal@merakiliving.example', shift: 'morning', status: 'active', joinedOn: '2019-07-01' },
  { id: 'staff_deepak', name: 'Deepak Verma', role: 'maintenance', propertyId: 'prop_crown', phone: '9839011209', email: 'deepak.verma@merakiliving.example', shift: 'general', status: 'active', joinedOn: '2023-03-10' },
  { id: 'staff_rekha', name: 'Rekha Bisht', role: 'warden', propertyId: 'prop_hsd', phone: '9839011210', email: 'rekha.bisht@merakiliving.example', shift: 'evening', status: 'active', joinedOn: '2022-08-01' },
  { id: 'staff_ajay', name: 'Ajay Rawat', role: 'maintenance', propertyId: 'prop_globus', phone: '9839011211', email: 'ajay.rawat@merakiliving.example', shift: 'general', status: 'active', joinedOn: '2022-05-18' },
  { id: 'staff_salim', name: 'Salim Ahmed', role: 'security', propertyId: 'prop_sunny', phone: '9839011212', email: 'salim.ahmed@merakiliving.example', shift: 'night', status: 'active', joinedOn: '2019-01-11' },
  { id: 'staff_pooja', name: 'Pooja Mehra', role: 'accountant', phone: '9839011213', email: 'pooja.mehra@merakiliving.example', shift: 'general', status: 'active', joinedOn: '2020-02-03' },
  { id: 'staff_gopal', name: 'Gopal Prasad', role: 'housekeeping', propertyId: 'prop_crown', phone: '9839011214', email: 'gopal.prasad@merakiliving.example', shift: 'evening', status: 'inactive', joinedOn: '2021-09-01' },
];
