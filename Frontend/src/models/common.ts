export interface ApiUser {
  id: number;
  name: string;
  email: string;
  tenant_id: number;
  tenantName:string;
  role: string;
  is_active: number;
  avatarUrl?: string | null;
}


export interface ApiMessageResponse {
  message: string;
}
