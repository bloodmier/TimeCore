export interface ApiTenant {
  id: number;
  name: string;
  org_number: string;
}

export type ApiTenantsResponse = ApiTenant[];
