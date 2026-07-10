"use server";

import { revalidatePath } from "next/cache";

import {
  isAllowedUploadFile,
  resolveUploadContentType,
  UPLOAD_MAX_BYTES,
} from "@/lib/constants/upload";
import { requireClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENT_TYPE_OPTIONS } from "@/types";

export async function uploadDocument(formData: FormData) {
  const profile = await requireClient();

  if (!profile.company_id) {
    return { error: "Su cuenta no está vinculada a una empresa." };
  }

  const supplier = String(formData.get("supplier") ?? "").trim();
  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim();
  const invoiceDate = String(formData.get("invoice_date") ?? "").trim();
  const dueDateRaw = String(formData.get("due_date") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const documentType = String(formData.get("document_type") ?? "").trim();
  const file = formData.get("file");

  if (
    !supplier ||
    !invoiceNumber ||
    !invoiceDate ||
    !amountRaw ||
    !documentType
  ) {
    return { error: "Complete todos los campos obligatorios." };
  }

  if (
    !DOCUMENT_TYPE_OPTIONS.includes(
      documentType as (typeof DOCUMENT_TYPE_OPTIONS)[number],
    )
  ) {
    return { error: "Tipo de documento no válido." };
  }

  const amount = Number(amountRaw);
  if (Number.isNaN(amount) || amount < 0) {
    return { error: "El monto debe ser un número válido." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Seleccione o tome una foto del documento." };
  }

  if (file.size > UPLOAD_MAX_BYTES) {
    return { error: "El archivo supera el límite de 50 MB." };
  }

  if (!isAllowedUploadFile(file)) {
    return {
      error: "Formato no admitido. Use foto, PDF, Word o Excel.",
    };
  }

  const supabase = await createClient();
  const documentId = crypto.randomUUID();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${profile.company_id}/${documentId}/${sanitizedName}`;
  const contentType = resolveUploadContentType(file);

  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return { error: "No se pudo enviar el archivo. Intente de nuevo." };
  }

  const { error: insertError } = await supabase.from("documents").insert({
    id: documentId,
    company_id: profile.company_id,
    uploaded_by: profile.id,
    supplier,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    due_date: dueDateRaw || null,
    amount,
    document_type: documentType,
    file_url: storagePath,
    status: "received",
  });

  if (insertError) {
    await supabase.storage.from("documents").remove([storagePath]);
    return { error: "No se pudo registrar el documento." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");

  return { success: true };
}
