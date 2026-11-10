import { http } from './client';
import type {
  IPropertyService, IRoomService, IStudentService,
  PropertyWithStats, PropertyInput, RoomWithBeds, RoomInput, StudentListItem, StudentDetail, StudentInput, StudentSelfUpdate,
} from '../interfaces';
import type { Bed, BedStatus, ID, Property, Room, StudentProfile, PropertyStatus, StudentStatus } from '@/types/domain';

export const httpPropertyService: IPropertyService = {
  list: (filters = {}) => http.get<PropertyWithStats[]>('/properties', filters),
  get: (id: ID) => http.get<PropertyWithStats>(`/properties/${id}`),
  create: (input: PropertyInput) => http.post<Property>('/properties', input),
  update: (id: ID, input: Partial<PropertyInput>) => http.patch<Property>(`/properties/${id}`, input),
  setStatus: (id: ID, status: PropertyStatus) => http.patch<Property>(`/properties/${id}/status`, { status }),
};

export const httpRoomService: IRoomService = {
  list: (filters = {}) => http.get<RoomWithBeds[]>('/rooms', filters),
  create: (input: RoomInput) => http.post<Room>('/rooms', input),
  createBulk: (inputs: RoomInput[]) => http.post<Room[]>('/rooms/bulk', { propertyId: inputs[0]?.propertyId, rooms: inputs }),
  update: (id: ID, input: Partial<RoomInput>) => http.patch<Room>(`/rooms/${id}`, input),
  setBedStatus: (bedId: ID, status: Exclude<BedStatus, 'occupied'>, reason?: string) =>
    http.patch<Bed>(`/beds/${bedId}/status`, { status, reason }),
  assignBed: async (studentId: ID, bedId: ID) => { await http.post('/beds/assign', { studentId, bedId }); },
  vacateBed: async (studentId: ID) => { await http.post('/beds/vacate', { studentId }); },
};

export const httpStudentService: IStudentService = {
  list: (filters = {}) => http.get<StudentListItem[]>('/students', filters),
  get: (id: ID) => http.get<StudentDetail>(`/students/${id}`),
  me: () => http.get<StudentDetail>('/students/me'),
  create: (input: StudentInput) => http.post<StudentProfile>('/students', input),
  update: (id: ID, patch: Partial<StudentInput>) => http.patch<StudentProfile>(`/students/${id}`, patch),
  setStatus: (id: ID, status: StudentStatus) => http.patch<StudentProfile>(`/students/${id}/status`, { status }),
  updateSelf: (patch: StudentSelfUpdate) => http.patch<StudentProfile>('/students/self', patch),
  nextStudentCode: () => http.get<string>('/students/next-code'),
};
