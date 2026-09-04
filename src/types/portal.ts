export type PortalUserDTO = {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions?: string[];
  hasGlobalBranchAccess?: boolean;
};

export type BranchDTO = {
  id: string;
  name: string;
  code: string;
};

export type PortalKind = "Admin" | "Member";
