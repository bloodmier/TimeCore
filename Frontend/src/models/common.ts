export interface ApiUser {
  id: number;
  name: string;
  email: string;
  tenant_id: number;
  role: string;
  is_active: number;
}


export interface ApiMessageResponse {
  message: string;
}
