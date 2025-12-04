import type { ApiTenantsResponse } from "../models/tenants";
import { getData } from "./basicservice";


export const TenantService = {
  getTenants: () => getData<ApiTenantsResponse>("/tenants"),
};
