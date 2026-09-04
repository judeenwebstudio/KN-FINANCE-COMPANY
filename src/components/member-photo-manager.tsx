"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MemberPhotoManager({ memberId, canManage }: { memberId: string; canManage: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [captured, setCaptured] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [hasPhoto, setHasPhoto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  useEffect(() => () => { stopCamera(); if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const startCamera = async () => {
    setError(null); setCaptured(null); setCameraOpen(true);
    if (!navigator.mediaDevices?.getUserMedia) { setError("Camera is unavailable in this browser or insecure context. Use Upload Photo instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError" ? "Camera permission was denied. Use Upload Photo instead." : name === "NotFoundError" ? "No camera was found." : name === "NotReadableError" ? "The camera is already in use by another application." : "The camera could not be started.");
      stopCamera();
    }
  };

  const takePhoto = () => {
    const video = videoRef.current; if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => { if (!blob) return; setCaptured(blob); const url = URL.createObjectURL(blob); setPreview(url); stopCamera(); }, "image/jpeg", 0.9);
  };

  const upload = async (file: File | Blob) => {
    setBusy(true); setError(null); const form = new FormData(); form.set("memberId", memberId); form.set("file", file, file instanceof File ? file.name : "camera-photo.jpg");
    const response = await fetch("/api/member-photo", { method: "POST", body: form }); const body = await response.json() as { error?: string };
    setBusy(false); if (!response.ok) { setError(body.error || "Photo upload failed."); return; }
    setHasPhoto(true); setPhotoVersion(Date.now()); setCameraOpen(false); setCaptured(null); if (preview) URL.revokeObjectURL(preview); setPreview(null);
  };

  const closeCamera = () => { stopCamera(); setCameraOpen(false); setCaptured(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); };
  const remove = async () => { if (!confirm("Remove this member photo?")) return; setBusy(true); const response = await fetch(`/api/member-photo/${memberId}`, { method: "DELETE" }); setBusy(false); if (response.ok) setHasPhoto(false); else setError("Photo could not be removed."); };

  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        {hasPhoto ? <img src={`/api/member-photo/${memberId}?v=${photoVersion}`} alt="Member profile" className="size-full object-cover" onError={() => setHasPhoto(false)} /> : <UserRound className="size-10 text-slate-400" />}
      </div>
      <div className="flex-1"><h4 className="font-semibold text-slate-900">Member photo</h4><p className="mt-1 text-xs text-slate-500">Private JPEG, PNG, or WebP. Maximum 5 MB.</p>
        {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
        {canManage && <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={startCamera} disabled={busy}><Camera className="mr-1 size-4" />Capture Photo</Button>
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-xs font-semibold"><ImagePlus className="mr-1 size-4" />Upload Photo<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} /></label>
          {hasPhoto && <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={busy}><Trash2 className="mr-1 size-4" />Remove</Button>}
        </div>}
      </div>
    </div>
    {cameraOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-4">
      <div className="flex items-center justify-between"><h3 className="font-semibold">Capture member photo</h3><Button variant="ghost" size="sm" onClick={closeCamera}><X className="size-4" />Cancel</Button></div>
      <div className="mt-4 aspect-video overflow-hidden rounded-xl bg-slate-950">{preview ? <img src={preview} alt="Captured preview" className="size-full object-contain" /> : <video ref={videoRef} muted playsInline className="size-full object-cover" />}</div>
      <div className="mt-4 flex justify-end gap-2">{captured ? <><Button variant="outline" onClick={() => { if (preview) URL.revokeObjectURL(preview); setPreview(null); setCaptured(null); void startCamera(); }}><RotateCcw className="mr-1 size-4" />Retake</Button><Button onClick={() => upload(captured)} disabled={busy}>Use Photo</Button></> : <Button onClick={takePhoto} disabled={!!error}><Camera className="mr-1 size-4" />Take Photo</Button>}</div>
    </div></div>}
  </div>;
}
