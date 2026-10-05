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
}

export type CreatedSchool = Pick<School, "id" | "name" | "districtId">;

export interface UpdateSchoolInput {
  name?: string;
  districtId?: number;
}
