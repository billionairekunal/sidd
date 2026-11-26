"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, ScanText, RefreshCw } from "lucide-react";
import { api } from "../lib/api";

const MAX_SIDE = 1600; // px — plenty for handwriting, keeps uploads small and fast

// Shrinks the photo in the browser and returns base64 JPEG (no "data:" prefix).
async function toJpegBase64(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("This file isn't a photo the browser can open. Please use a JPG or PNG."));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { base64: dataUrl.split(",")[1], preview: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** "Scan LR photo" card: take/upload a photo, read it, hand the result to onResult. */
export default function ScanLR({ onResult }) {
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const { base64, preview } = await toJpegBase64(file);
      setPreview(preview);
      const result = await api.lrs.scan({ image: base64, mimeType: "image/jpeg" });
      onResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const pick = (ref) => !busy && ref.current?.click();

  return (
    <section className="rounded-xl border border-dashed border-primary/50 bg-primary-container/40 p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {preview ? (
          <img
            src={preview}
            alt="Scanned LR"
            className="w-full sm:w-24 h-40 sm:h-24 object-cover rounded-lg border border-hairline bg-white shrink-0"
          />
        ) : (
          <div className="hidden sm:flex w-12 h-12 rounded-lg bg-primary text-white items-center justify-center shrink-0">
            <ScanText className="w-6 h-6" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-ink-secondary">Scan LR photo</h2>
          <p className="text-[13px] text-ink-mute mt-0.5">
            {busy
              ? "Reading your LR… this takes a few seconds."
              : preview
                ? "Done — check the highlighted fields below and fix anything wrong."
                : "Take a photo of the handwritten LR or upload one. The form fills itself — you can edit everything."}
          </p>
          {error && <p className="text-[13px] font-medium text-[#b91c1c] mt-1.5">{error}</p>}
        </div>

        <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => pick(cameraRef)}
            disabled={busy}
            className="h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md bg-primary hover:bg-primary-press text-white text-[14px] font-semibold disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : preview ? <RefreshCw className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            {busy ? "Reading…" : preview ? "Retake" : "Take photo"}
          </button>
          <button
            type="button"
            onClick={() => pick(uploadRef)}
            disabled={busy}
            className="h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border border-primary/60 bg-white text-primary hover:bg-primary-container text-[14px] font-semibold disabled:opacity-60"
          >
            <ImageUp className="w-4 h-4" /> Upload
          </button>
        </div>
      </div>

      {/* capture="environment" opens the back camera on phones; on computers it acts like Upload */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </section>
  );
}
