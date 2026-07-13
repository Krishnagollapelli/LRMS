// User & Auth Types
export type UserRole = 'ADMIN' | 'TECHNICIAN' | 'SUPER_ADMIN';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Referring Doctor Types
export interface Doctor {
  id: string;
  name: string;
  qualification: string;
  hospital: string;
  registrationNumber: string;
  phone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateDoctorDTO = Omit<Doctor, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>;
export type UpdateDoctorDTO = Partial<CreateDoctorDTO> & { isActive?: boolean };

// Patient Types
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type AgeUnit = 'YEARS' | 'MONTHS' | 'DAYS';

export interface Patient {
  id: string;
  name: string;
  age: number;
  ageUnit: AgeUnit;
  gender: Gender;
  phone: string;
  remarks?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePatientDTO = Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdatePatientDTO = Partial<CreatePatientDTO>;

// Reusable Units
export interface Unit {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUnitDTO = { name: string; description?: string };

// Parameters & Reference Ranges
export interface ReferenceRange {
  id: string;
  parameterId: string;
  gender: 'MALE' | 'FEMALE' | 'ALL';
  ageMin: number; // in years
  ageMax: number; // in years
  minVal?: number | null;
  maxVal?: number | null;
  displayText: string; // e.g. "13.5 - 17.5"
  condition: string; // "ADULT" | "CHILD" | "PREGNANCY" | "ELDERLY"
}

export type CreateReferenceRangeDTO = Omit<ReferenceRange, 'id' | 'parameterId'>;

export interface Parameter {
  id: string;
  name: string;
  shortCode: string;
  aliases?: string[] | null;
  category: string;
  unitId: string;
  unit?: Unit;
  decimalPrecision: number;
  description?: string | null;
  isActive: boolean;
  referenceRanges?: ReferenceRange[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreateParameterDTO = Omit<Parameter, 'id' | 'isActive' | 'unit' | 'referenceRanges' | 'createdAt' | 'updatedAt'> & {
  referenceRanges?: CreateReferenceRangeDTO[];
};

export type UpdateParameterDTO = Partial<CreateParameterDTO> & { isActive?: boolean };

// Test Templates (Panels)
export interface TestParameter {
  testId: string;
  parameterId: string;
  sortOrder: number;
  parameter?: Parameter;
}

export interface Test {
  id: string;
  name: string;
  shortCode: string;
  category: string;
  isActive: boolean;
  testParameters: TestParameter[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTestDTO {
  name: string;
  shortCode: string;
  category: string;
  parameterIds: { parameterId: string; sortOrder: number }[];
}

export interface UpdateTestDTO {
  name?: string;
  shortCode?: string;
  category?: string;
  isActive?: boolean;
  parameterIds?: { parameterId: string; sortOrder: number }[];
}

// Analyzer / Machine Profiles
export interface AnalyzerProfile {
  id: string;
  name: string;
  model: string;
  connectionType: 'SERIAL' | 'TCP' | 'FILE';
  config: string; // JSON string mapping machine codes to Parameter IDs
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAnalyzerProfileDTO {
  name: string;
  model: string;
  connectionType: 'SERIAL' | 'TCP' | 'FILE';
  config: string;
}

// Report Types
export type ReportStatus = 'PENDING' | 'COMPLETED' | 'PRINTED' | 'CANCELLED';

export interface ReportResult {
  id: string;
  reportId: string;
  parameterId: string;
  parameter?: Parameter;
  value: string;
  unitText: string;
  referenceRangeText: string;
  isAbnormal: boolean;
  remarks?: string | null;
}

export interface ReportTest {
  reportId: string;
  testId: string;
  test?: Test;
}

export interface Report {
  id: string;
  patientId: string;
  patient?: Patient;
  doctorId: string;
  doctor?: Doctor;
  sampleId: string;
  registrationDate: Date;
  status: ReportStatus;
  remarks?: string | null;
  reportTests: ReportTest[];
  results: ReportResult[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportDTO {
  patientId?: string; // Optional if creating a new patient inline
  newPatient?: CreatePatientDTO; // For inline patient creation
  doctorId: string;
  sampleId: string;
  testIds: string[];
  remarks?: string;
}

export interface SaveReportResultsDTO {
  status?: ReportStatus;
  remarks?: string;
  results: {
    parameterId: string;
    value: string;
    unitText: string;
    referenceRangeText: string;
    isAbnormal: boolean;
    remarks?: string;
  }[];
}

// Delivery / Send Logs
export type DeliveryChannel = 'EMAIL' | 'WHATSAPP';
export type DeliveryStatus = 'SENT' | 'FAILED';

export interface DeliveryHistory {
  id: string;
  reportId: string;
  recipient: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  errorMessage?: string | null;
  sentAt: Date;
}

// Lab Configuration / Settings Settings
export interface LabSettings {
  labName: string;
  labAddress: string;
  labPhone: string;
  labEmail: string;
  labLogo?: string; // base64
  labFooter?: string;
  doctorSignature?: string; // base64
  pdfThemeColor: string; // Hex color code
  whatsappEnabled: boolean;
  whatsappApiKey?: string;
  whatsappPhoneId?: string;
  emailEnabled: boolean;
  emailSmtpHost?: string;
  emailSmtpPort?: number;
  emailSmtpUser?: string;
  emailSmtpPass?: string;
  emailSender?: string;
  geminiApiKey?: string;
}

// Dashboard statistics
export interface DashboardStats {
  todayPatientsCount: number;
  pendingReportsCount: number;
  completedReportsCount: number;
  printedReportsCount: number;
  recentReports: {
    id: string;
    patientName: string;
    doctorName: string;
    testsText: string;
    status: ReportStatus;
    createdAt: Date;
  }[];
  mostUsedTests: {
    testName: string;
    count: number;
  }[];
}

// Medical Knowledge Engine Resolve Types
export interface AIResolveResult {
  name: string;
  shortCode: string;
  unit: string;
  category: string;
  aliases: string[];
  description: string;
  referenceRanges: {
    gender: 'MALE' | 'FEMALE' | 'ALL';
    ageMin: number;
    ageMax: number;
    minVal?: number;
    maxVal?: number;
    condition: string;
    displayText: string;
  }[];
}
