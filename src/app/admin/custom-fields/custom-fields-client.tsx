"use client";

import { useState } from "react";
import { Sliders, Plus, Edit, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomFieldDefinitionDTO } from "@/lib/members/custom-field-service";
import { CustomFieldType } from "@/generated/prisma/client";
import {
  createCustomFieldDefAction,
  updateCustomFieldDefAction,
} from "@/app/admin/members/custom-field-actions";
import { useRouter } from "next/navigation";

export function CustomFieldsClient({ initialDefs }: { initialDefs: CustomFieldDefinitionDTO[] }) {
  const router = useRouter();
  const defs = initialDefs;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<CustomFieldDefinitionDTO | null>(null);

  // Form states
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("TEXT");
  const [optionsStr, setOptionsStr] = useState("");
  const [required, setRequired] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setKey("");
    setLabel("");
    setType("TEXT");
    setOptionsStr("");
    setRequired(false);
    setDisplayOrder(0);
    setError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const options = type === "SELECT" ? optionsStr.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

    const res = await createCustomFieldDefAction({
      key,
      label,
      type,
      options,
      required,
      displayOrder,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to create custom field definition.");
    } else {
      setCreateModalOpen(false);
      resetForm();
      router.refresh();
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDef) return;

    setLoading(true);
    setError(null);

    const options = editingDef.type === "SELECT" ? optionsStr.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

    const res = await updateCustomFieldDefAction(editingDef.id, {
      label,
      options,
      required,
      displayOrder,
    });

    setLoading(false);
    if (!res.success) {
      setError(res.error || "Failed to update custom field definition.");
    } else {
      setEditingDef(null);
      resetForm();
      router.refresh();
    }
  };

  const handleToggleActive = async (def: CustomFieldDefinitionDTO) => {
    setError(null);
    const res = await updateCustomFieldDefAction(def.id, { active: !def.active });
    if (res.success) {
      router.refresh();
    } else {
      setError(res.error || "Failed to toggle status.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="size-5 text-[#275d4f]" /> Member Custom Fields Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure schema-driven custom fields for member profiles with strict data typing and validation.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateModalOpen(true);
          }}
          size="sm"
          className="h-9 gap-1.5 bg-[#275d4f] hover:bg-[#1e483d] text-white text-xs shadow-xs"
        >
          <Plus className="size-3.5" /> Define Custom Field
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <Card className="overflow-hidden border border-slate-200 shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Key Slug</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Required</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {defs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  <Sliders className="mx-auto size-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No custom fields defined</p>
                  <p className="text-xs mt-1 text-slate-400">
                    Define custom fields to capture specialized member attributes.
                  </p>
                </td>
              </tr>
            ) : (
              defs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-600">{d.displayOrder}</td>
                  <td className="px-4 py-3 font-mono font-bold text-[#275d4f]">{d.key}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{d.label}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                      {d.type}
                    </span>
                    {d.type === "SELECT" && d.options.length > 0 && (
                      <span className="block text-[10px] text-slate-400 mt-0.5 truncate max-w-48">
                        Options: {d.options.join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {d.required ? (
                      <span className="text-amber-700 font-semibold text-[11px]">Yes</span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Optional</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {d.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                        <CheckCircle2 className="size-3.5 text-emerald-600" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                        <XCircle className="size-3.5 text-slate-400" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingDef(d);
                          setLabel(d.label);
                          setOptionsStr(d.options.join(", "));
                          setRequired(d.required);
                          setDisplayOrder(d.displayOrder);
                        }}
                        className="h-7 text-xs"
                      >
                        <Edit className="size-3 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(d)}
                        className={`h-7 text-xs ${d.active ? "text-amber-700 hover:bg-amber-50" : "text-emerald-700 hover:bg-emerald-50"}`}
                      >
                        {d.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Define New Custom Field
            </h2>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Key Slug (Immutable)</label>
                <input
                  type="text"
                  required
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="e.g. tax_identification_number"
                  className="w-full rounded-md border border-slate-300 p-2 font-mono text-xs focus:border-[#275d4f] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Display Label</label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Tax Identification Number"
                  className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#275d4f] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Data Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CustomFieldType)}
                    className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#275d4f] focus:outline-none bg-white"
                  >
                    <option value="TEXT">TEXT</option>
                    <option value="NUMBER">NUMBER</option>
                    <option value="DATE">DATE</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="SELECT">SELECT</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#275d4f] focus:outline-none"
                  />
                </div>
              </div>

              {type === "SELECT" && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Select Options (Comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    value={optionsStr}
                    onChange={(e) => setOptionsStr(e.target.value)}
                    placeholder="Salaried, Self-Employed, Retired"
                    className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#275d4f] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="req-check"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="rounded text-[#275d4f]"
                />
                <label htmlFor="req-check" className="font-medium text-slate-700">
                  Required field for member registration
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#275d4f] hover:bg-[#1e483d] text-white"
                >
                  {loading ? "Creating..." : "Create Definition"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {editingDef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-white p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Edit Custom Field Definition ({editingDef.key})
            </h2>

            <form onSubmit={handleUpdateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Display Label</label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#275d4f] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#275d4f] focus:outline-none"
                />
              </div>

              {editingDef.type === "SELECT" && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Select Options (Comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    value={optionsStr}
                    onChange={(e) => setOptionsStr(e.target.value)}
                    className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#275d4f] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="req-edit-check"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="rounded text-[#275d4f]"
                />
                <label htmlFor="req-edit-check" className="font-medium text-slate-700">
                  Required field
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => setEditingDef(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-[#275d4f] hover:bg-[#1e483d] text-white"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
