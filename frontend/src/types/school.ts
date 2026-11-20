export interface School {
  id: number;
  name: string;
  districtId: number;
  district: {
    id: number;
    name: string;
    regionId: number;
    region: {
      id: number;
      name: string;
    };
  };
  latitude?: number | null;
  longitude?: number | null;
}

export interface MySchool {
  membershipId: number;
  type: "STUDENT" | "TEACHER";
  startDate: string;
  endDate: string | null;
  school: {
    id: number;
    name: string;
    district: {
      id: number;
      name: string;
    };
    region: {
      id: number;
      name: string;
    };
  };
}

export interface CreateSchoolInput {
  name: string;
  districtId: number;
  latitude?: number | null;
  longitude?: number | null;
}

export type CreatedSchool = Pick<School, "id" | "name" | "districtId">;

export interface UpdateSchoolInput {
  name?: string;
  districtId?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SchoolStats {
  students: number;
  teachers: number;
  terminals: number;
  activeTerminals: number;
}

export interface LateSettings {
  minutes: number;
  updatedAt: string | null;
  updatedBy: { login: string; name: string | null; role: string } | null;
}

export interface SchoolRow extends School {
  stats: SchoolStats;
  lateThreshold: LateSettings | null;
}

export interface SchoolsPage {
  data: SchoolRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
