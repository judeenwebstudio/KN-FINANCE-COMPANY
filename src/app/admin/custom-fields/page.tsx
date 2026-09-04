import { requirePermission } from "@/lib/auth/authorize";
import { getCustomFieldDefinitions } from "@/lib/members/custom-field-service";
import { CustomFieldsClient } from "./custom-fields-client";

export default async function CustomFieldsPage() {
  await requirePermission("members.custom_fields.manage");
  const defs = await getCustomFieldDefinitions(false); // fetch all active and inactive for admin
  return <CustomFieldsClient initialDefs={defs} />;
}
