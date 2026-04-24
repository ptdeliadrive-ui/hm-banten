import { supabase } from "@/integrations/supabase/client";

const PAYMENT_PROOF_BUCKET = "payment-proofs";
const MAX_PAYMENT_PROOF_SIZE_BYTES = 1 * 1024 * 1024;

export interface UploadedPaymentProof {
  fileId: string;
  fileName: string;
  webViewLink: string;
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
}

function getFileExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName) return fromName;

  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function fileNameWithoutExtension(fileName: string) {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return fileName;
  return fileName.slice(0, idx);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Gagal membaca gambar untuk kompresi"));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Gagal mengompres gambar"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

async function compressImageToFitLimit(file: File, maxBytes: number): Promise<File> {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Browser tidak mendukung kompresi gambar");
  }

  const outputType = file.type === "image/webp" ? "image/webp" : "image/jpeg";
  const outputExt = outputType === "image/webp" ? "webp" : "jpg";
  const baseName = fileNameWithoutExtension(file.name);

  let width = image.naturalWidth;
  let height = image.naturalHeight;
  let quality = 0.9;

  for (let i = 0; i < 10; i += 1) {
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas, outputType, quality);
    if (blob.size <= maxBytes) {
      return new File([blob], `${baseName}.${outputExt}`, {
        type: outputType,
        lastModified: Date.now(),
      });
    }

    quality = Math.max(0.45, quality - 0.08);
    width *= 0.85;
    height *= 0.85;
  }

  throw new Error("Ukuran gambar masih di atas 1MB setelah kompresi. Coba gunakan gambar dengan resolusi lebih kecil.");
}

export async function deletePaymentProofFromStorage(path?: string) {
  if (!path) return;

  const { error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadPaymentProof(file: File, memberName: string, paymentDate: string) {
  let uploadFile = file;

  if (uploadFile.size > MAX_PAYMENT_PROOF_SIZE_BYTES) {
    if (uploadFile.type.startsWith("image/")) {
      uploadFile = await compressImageToFitLimit(uploadFile, MAX_PAYMENT_PROOF_SIZE_BYTES);
    } else {
      throw new Error("Ukuran file maksimal 1MB. File PDF/non-gambar yang lebih besar harus dikecilkan manual.");
    }
  }

  if (uploadFile.size > MAX_PAYMENT_PROOF_SIZE_BYTES) {
    throw new Error("Ukuran file maksimal 1MB.");
  }

  const safeMemberName = sanitizePathSegment(memberName || "anggota") || "anggota";
  const safePaymentDate = paymentDate || new Date().toISOString().slice(0, 10);
  const extension = getFileExtension(uploadFile);
  const path = `${new Date().getFullYear()}/${safePaymentDate}/${safeMemberName}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).upload(path, uploadFile, {
    cacheControl: "3600",
    upsert: false,
    contentType: uploadFile.type || undefined,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(PAYMENT_PROOF_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Gagal mendapatkan URL bukti bayar");
  }

  return {
    fileId: path,
    fileName: uploadFile.name,
    webViewLink: data.publicUrl,
  } satisfies UploadedPaymentProof;
}
