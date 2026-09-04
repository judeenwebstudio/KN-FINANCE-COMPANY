"use client";

import { useState, useEffect } from "react";
import { FileText, Upload, Trash2, AlertCircle, ShieldCheck, Download, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocumentCategory } from "@/generated/prisma/client";
import {
  getMemberDocumentsAction,
  uploadMemberDocumentAction,
  deleteMemberDocumentAction,
} from "@/app/admin/members/document-actions";
import { MemberDocumentDTO } from "@/lib/members/document-service";

export function MemberDocumentsSection({
  memberId,
  canManage = false,
}: {
  memberId: string;
  canManage?: boolean;
}) {
  const [documents, setDocuments] = useState<MemberDocumentDTO[]>([]);
  const [isStorageConfigured, setIsStorageConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<DocumentCategory>("IDENTITY");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    let mounted = true;
    getMemberDocumentsAction(memberId).then((res) => {
      if (mounted) {
        setLoading(false);
        if (res.success && res.data) {
          setDocuments(res.data);
          setIsStorageConfigured(Boolean(res.isStorageConfigured));
        } else {
          setError(res.error || "Failed to load member documents.");
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [memberId]);

  const fetchDocs = async () => {
    setLoading(true);
    setError(null);
    const res = await getMemberDocumentsAction(memberId);
    setLoading(false);
    if (res.success && res.data) {
      setDocuments(res.data);
      setIsStorageConfigured(Boolean(res.isStorageConfigured));
    } else {
      setError(res.error || "Failed to load member documents.");
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    const res = await uploadMemberDocumentAction({
      memberId,
      category,
      fileName: selectedFile.name,
      mimeType: selectedFile.type,
      sizeBytes: selectedFile.size,
    });

    setUploading(false);
    if (!res.success) {
      setError(res.error || "Upload failed.");
    } else {
      setSelectedFile(null);
      fetchDocs();
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to remove this document metadata record?")) return;
    setError(null);
    const res = await deleteMemberDocumentAction(docId);
    if (res.success) {
      fetchDocs();
    } else {
      setError(res.error || "Failed to delete document.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="size-4 text-[#275d4f]" /> KYC & Identity Documents
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified proof of identity, address, and supporting membership records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isStorageConfigured && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 border border-amber-200">
              <AlertCircle className="size-3.5 text-amber-600 shrink-0" />
              Storage Provider Unconfigured
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Upload Form */}
      {canManage && (
        <Card className="p-4 bg-slate-50/70 border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Upload Document Record
          </h4>
          <form onSubmit={handleUploadSubmit} className="flex flex-wrap items-center gap-3">
            <div className="w-44">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#275d4f] focus:outline-none"
              >
                <option value="IDENTITY">IDENTITY (Passport / ID)</option>
                <option value="ADDRESS_PROOF">ADDRESS PROOF (Utility Bill)</option>
                <option value="OTHER">OTHER (Supporting File)</option>
              </select>
            </div>

            <div className="flex-1 min-w-48">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-100 cursor-pointer"
              />
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={!selectedFile || uploading}
              className="h-8 gap-1.5 bg-[#275d4f] hover:bg-[#1e483d] text-white text-xs shadow-xs"
            >
              <Upload className="size-3.5" />
              {uploading ? "Uploading..." : "Upload Document"}
            </Button>
          </form>

          {!isStorageConfigured && (
            <p className="text-[11px] text-amber-700 italic">
              Note: Production object storage provider is currently unconfigured. Upload attempts will validate metadata and report storage readiness status truthfully.
            </p>
          )}
        </Card>
      )}

      {/* Documents List */}
      <Card className="overflow-hidden border border-slate-200 shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-1">
            <FileCheck className="mx-auto size-8 text-slate-300" />
            <p className="font-semibold text-xs text-slate-700">No documents uploaded</p>
            <p className="text-[11px] text-slate-400">
              Identity documents and proof of address will appear here once verified.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Document Name</th>
                <th className="px-4 py-2.5">Size / Type</th>
                <th className="px-4 py-2.5">Uploaded By</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-bold">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                        doc.category === "IDENTITY"
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          : doc.category === "ADDRESS_PROOF"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <ShieldCheck className="size-3" />
                      {doc.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{doc.fileName}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                    {(doc.sizeBytes / 1024).toFixed(1)} KB • {doc.mimeType.split("/")[1]?.toUpperCase()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{doc.uploadedByName}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isStorageConfigured ? (
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-slate-600 hover:text-slate-900">
                          <Download className="size-3.5" /> View
                        </Button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic mr-2">Storage pending</span>
                      )}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(doc.id)}
                          className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
