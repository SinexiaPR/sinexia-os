"use client";

import { Camera, FileUp, X } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { uploadDocument } from "@/actions/documents";
import { CAMERA_ACCEPT, UPLOAD_ACCEPT } from "@/lib/constants/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CLIENT_DOCUMENT_TYPES,
  DOCUMENT_COMMENT_MAX_LENGTH,
  DOCUMENT_TYPE_DESCRIPTION_MAX_LENGTH,
} from "@/lib/documents/upload-metadata";
import { cn } from "@/lib/utils";

const initialState: { error?: string; success?: boolean } = {};

const selectClassName =
  "flex h-12 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 sm:h-11 sm:text-sm";

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assignFileToInput(input: HTMLInputElement | null, file: File) {
  if (!input) return;
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
}

function clearFileInput(input: HTMLInputElement | null) {
  if (!input) return;
  input.value = "";
}

export function DocumentUploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const submissionInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await uploadDocument(formData);
      if (result.success) {
        formRef.current?.reset();
        setSelectedFile(null);
        setDocumentType("");
        clearFileInput(submissionInputRef.current);
        clearFileInput(cameraInputRef.current);
        clearFileInput(fileInputRef.current);
      }
      return result;
    },
    initialState,
  );

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setLocalError(null);
    setSelectedFile(file);
    assignFileToInput(submissionInputRef.current, file);
  }

  function clearFile() {
    setSelectedFile(null);
    clearFileInput(submissionInputRef.current);
    clearFileInput(cameraInputRef.current);
    clearFileInput(fileInputRef.current);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!selectedFile) {
      event.preventDefault();
      setLocalError("Seleccione o tome una foto del documento.");
      return;
    }

    setLocalError(null);
    assignFileToInput(submissionInputRef.current, selectedFile);
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <input
        ref={submissionInputRef}
        type="file"
        name="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={() => undefined}
      />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="document_type">Tipo de documento</Label>
          <select
            id="document_type"
            name="document_type"
            required
            disabled={isPending}
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className={selectClassName}
          >
            <option value="">Seleccionar</option>
            {CLIENT_DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {documentType === "Other" ? (
          <div className="space-y-2">
            <Label htmlFor="document_type_description">
              Descripción breve{" "}
              <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="document_type_description"
              name="document_type_description"
              maxLength={DOCUMENT_TYPE_DESCRIPTION_MAX_LENGTH}
              disabled={isPending}
              className="h-12 rounded-xl text-base sm:h-11 sm:text-sm"
            />
          </div>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Prioridad</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="border-border bg-muted/20 flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm">
              <input
                type="radio"
                name="priority"
                value="routine"
                defaultChecked
                required
                disabled={isPending}
              />
              Rutina
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.03] px-4 py-3 text-sm text-red-700">
              <input
                type="radio"
                name="priority"
                value="urgent"
                required
                disabled={isPending}
                className="accent-red-600"
              />
              Urgente
            </label>
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="comment">
            Comentario <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <textarea
            id="comment"
            name="comment"
            maxLength={DOCUMENT_COMMENT_MAX_LENGTH}
            rows={4}
            disabled={isPending}
            placeholder="Información útil para el equipo de Sinexia."
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full resize-y rounded-xl border bg-transparent px-3 py-3 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50 sm:text-sm"
          />
          <p className="text-muted-foreground text-xs">
            Máximo 500 caracteres.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base sm:text-sm">Archivo</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => cameraInputRef.current?.click()}
            className="h-14 justify-center gap-2 rounded-xl text-base sm:h-12 sm:text-sm"
          >
            <Camera className="size-5 shrink-0" /> Tomar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
            className="h-14 justify-center gap-2 rounded-xl text-base sm:h-12 sm:text-sm"
          >
            <FileUp className="size-5 shrink-0" /> Elegir archivo
          </Button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept={CAMERA_ACCEPT}
          capture="environment"
          className="sr-only"
          disabled={isPending}
          onChange={(event) => handleFileSelect(event.target.files?.[0])}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="sr-only"
          disabled={isPending}
          onChange={(event) => handleFileSelect(event.target.files?.[0])}
        />
        {selectedFile ? (
          <div className="border-border/80 bg-muted/40 flex items-start gap-3 rounded-xl border p-4">
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">
                {selectedFile.name}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={clearFile}
              disabled={isPending}
              className="text-muted-foreground hover:bg-background hover:text-foreground rounded-lg p-1.5 transition-colors"
              aria-label="Quitar archivo"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Foto con cámara, imagen de galería, PDF, Word o Excel. Máximo 50 MB.
          </p>
        )}
      </div>

      {localError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {localError}
        </p>
      ) : null}

      {state.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Documento recibido por Sinexia.
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={isPending || !selectedFile}
        className={cn(
          "h-14 w-full rounded-xl text-base font-semibold sm:h-12 sm:text-sm",
          "sticky bottom-4 z-10 shadow-md sm:static sm:shadow-none",
        )}
      >
        {isPending ? "Enviando…" : "Enviar documento"}
      </Button>
    </form>
  );
}
