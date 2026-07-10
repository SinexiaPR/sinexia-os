"use client";

import { Camera, FileUp, X } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { uploadDocument } from "@/actions/documents";
import {
  CAMERA_ACCEPT,
  UPLOAD_ACCEPT,
} from "@/lib/constants/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_OPTIONS } from "@/types";
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
  const [localError, setLocalError] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await uploadDocument(formData);
      if (result.success) {
        formRef.current?.reset();
        setSelectedFile(null);
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

      {/* Mobile-first: file picker first */}
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
            <Camera className="size-5 shrink-0" />
            Tomar foto
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
            className="h-14 justify-center gap-2 rounded-xl text-base sm:h-12 sm:text-sm"
          >
            <FileUp className="size-5 shrink-0" />
            Elegir archivo
          </Button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept={CAMERA_ACCEPT}
          capture="environment"
          className="sr-only"
          disabled={isPending}
          onChange={(event) =>
            handleFileSelect(event.target.files?.[0])
          }
        />

        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="sr-only"
          disabled={isPending}
          onChange={(event) =>
            handleFileSelect(event.target.files?.[0])
          }
        />

        {selectedFile ? (
          <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/40 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {selectedFile.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={clearFile}
              disabled={isPending}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="Quitar archivo"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Foto con cámara, imagen de galería, PDF, Word o Excel. Máximo 50 MB.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="supplier">Proveedor</Label>
          <Input
            id="supplier"
            name="supplier"
            required
            disabled={isPending}
            className="h-12 rounded-xl text-base sm:h-11 sm:text-sm"
            autoComplete="organization"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoice_number">Número de factura</Label>
          <Input
            id="invoice_number"
            name="invoice_number"
            required
            disabled={isPending}
            className="h-12 rounded-xl text-base sm:h-11 sm:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoice_date">Fecha de factura</Label>
          <Input
            id="invoice_date"
            name="invoice_date"
            type="date"
            required
            disabled={isPending}
            className="h-12 rounded-xl text-base sm:h-11 sm:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date">Fecha de vencimiento</Label>
          <Input
            id="due_date"
            name="due_date"
            type="date"
            disabled={isPending}
            className="h-12 rounded-xl text-base sm:h-11 sm:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Monto</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            required
            disabled={isPending}
            className="h-12 rounded-xl text-base sm:h-11 sm:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="document_type">Tipo de documento</Label>
          <select
            id="document_type"
            name="document_type"
            required
            disabled={isPending}
            className={selectClassName}
          >
            <option value="">Seleccionar</option>
            {DOCUMENT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {localError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {localError}
        </p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          Documento enviado correctamente. Sinexia lo recibió y lo revisará
          pronto.
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={isPending || !selectedFile}
        className={cn(
          "h-14 w-full rounded-xl text-base font-semibold sm:h-12 sm:text-sm",
          "sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-10 shadow-md md:static md:bottom-auto md:shadow-none",
        )}
      >
        {isPending ? "Enviando…" : "Enviar documento"}
      </Button>
    </form>
  );
}
