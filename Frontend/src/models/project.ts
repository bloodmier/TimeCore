export interface Project {
  id: number;
  customer_id: number;
  projectname: string;
  last_active: string;
  deleted_at: string | null;
  archived_at: string | null;
  status: string;
}
