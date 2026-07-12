"use server";

import { revalidatePath } from "next/cache";

import {
  isAllowedUploadFile,
  resolveUploadContentType,
  UPLOAD_MAX_BYTES,
} from "@/lib/constants/upload";
import { requireAdmin, requireClient } from "@/lib/auth/session";
import { scheduleInboxDocumentProcessing } from "@/lib/intelligence/processing";
import { isAnalyzableFilename } from "@/lib/intelligence/extraction/utils";
import { createClient } from "@/lib/supabase/server";
import {
  validateDocumentUploadMetadata,
  type DocumentPriority,
} from "@/lib/documents/upload-metadata";
import { DOCUMENT_STATUS_OPTIONS, type DocumentStatus } from "@/types";

export async function uploadDocument(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const profile = await requireClient();

  if (!profile.company_id) {
    return { error: "Su cuenta no está vinculada a una empresa." };
  }

  const documentType = String(formData.get("document_type") ?? "").trim();
  const priority = String(formData.get("priority") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const typeDescription = String(
    formData.get("document_type_description") ?? "",
  ).trim();
  const file = formData.get("file");

  if (!documentType || !priority) {
    return { error: "Complete todos los campos obligatorios." };
  }

  const metadataValidation = validateDocumentUploadMetadata({
    documentType,
    priority,
    comment,
    typeDescription,
  });
  if (metadataValidation.error) {
    return metadataValidation;
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
  const serverDate = new Date().toISOString().slice(0, 10);
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
    supplier: documentType,
    invoice_number: documentId,
    invoice_date: serverDate,
    amount: 0,
    document_type: documentType,
    document_type_description:
      documentType === "Other" ? typeDescription || null : null,
    priority: priority as DocumentPriority,
    comment: comment || null,
    file_url: storagePath,
    status: "received",
  });

  if (insertError) {
    await supabase.storage.from("documents").remove([storagePath]);
    return { error: "No se pudo registrar el documento." };
  }

  // Async SinexIA analysis for analyzable formats only (PDF/Excel/CSV)
  if (isAnalyzableFilename(sanitizedName)) {
    scheduleInboxDocumentProcessing(documentId);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/sia");

  return { success: true };
}

export async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
) {
  await requireAdmin();
  if (!documentId) {
    return { error: "Documento no válido." };
  }

  if (!DOCUMENT_STATUS_OPTIONS.includes(status)) {
    return { error: "Estado no válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ status })
    .eq("id", documentId);

  if (error) {
    console.error("[documents] updateDocumentStatus", error.message);
    return { error: "No se pudo actualizar el estado del documento." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
  return { success: true };
}
