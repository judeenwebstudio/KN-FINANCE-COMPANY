export type BranchDirectoryDTO = {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  currency: "INR";
  status: "ACTIVE" | "INACTIVE";
  userCount: number;
  memberCount: number;
  accountCount: number;
  loanCount: number;
};

export type BranchStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function canAccessBranchDirectory(permissionCodes: Iterable<string>, hasGlobalBranchAccess: boolean) {
  return hasGlobalBranchAccess && new Set(permissionCodes).has("settings.branch.manage");
}

export function filterBranchDirectory(
  branches: BranchDirectoryDTO[],
  search: string,
  status: BranchStatusFilter,
) {
  const query = search.trim().toLocaleLowerCase("en-IN");
  return branches.filter((branch) => {
    const matchesStatus = status === "ALL" || branch.status === status;
    const searchable = [branch.name, branch.code, branch.email, branch.phone].join(" ").toLocaleLowerCase("en-IN");
    return matchesStatus && (!query || searchable.includes(query));
  });
}

export function paginateBranchDirectory(branches: BranchDirectoryDTO[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(branches.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return { page: safePage, totalPages, rows: branches.slice((safePage - 1) * pageSize, safePage * pageSize) };
}
