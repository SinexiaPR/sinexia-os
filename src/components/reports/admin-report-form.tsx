"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createReport } from "@/actions/reports";
import {
  reportActionInitialState,
  type ReportActionState,
} from "@/types/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  REPORT_CATEGORY_META,
  REPORTS_ACCEPT,
  REPORT_CATEGORIES,
} from "@/lib/constants/reports";
import { isAllowedUploadFile } from "@/lib/constants/upload";
import type { Company } from "@/types";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-12 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 sm:h-11 sm:text-sm";

type AdminReportFormProps = {
  companies: Company[];
  initialCompanyId?: string;
};

function assignFileToInput(input: HTMLInputElement | null, file: File) {
  if (!input) return;
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
}

export function AdminReportForm({
  companies,
  initialCompanyId,
}: AdminReportFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submissionInputRef = useRef<HTMLInputElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState<
    ReportActionState,
    FormData
  >(createReport, reportActionInitialState);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    formRef.current?.reset();
    setSelectedFile(null);
    setLocalError(null);
    if (submissionInputRef.current) submissionInputRef.current.value = "";
    if (pickerInputRef.current) pickerInputRef.current.value = "";
  }, [state]);

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    if (!isAllowedUploadFile(file)) {
      setLocalError("Unsupported file type.");
      return;
    }
    setLocalError(null);
    setSelectedFile(file);
    assignFileToInput(submissionInputRef.current, file);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!selectedFile) {
      event.preventDefault();
      setLocalError("Select a report file.");
      return;
    }
    setLocalError(null);
    assignFileToInput(submissionInputRef.current, selectedFile);
  }

  const showError = state.success === false && Boolean(state.error);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-5"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="company_id">Company</Label>
          <select
            id="company_id"
            name="company_id"
            required
            disabled={isPending}
            className={selectClassName}
            defaultValue={initialCompanyId ?? ""}
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            required
            disabled={isPending}
            className={selectClassName}
          >
            <option value="">Select category</option>
            {REPORT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {REPORT_CATEGORY_META[category].adminOptionLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="period">Period</Label>
          <Input
            id="period"
            name="period"
            placeholder="e.g. January 2026"
            required
            disabled={isPending}
            className="h-12 rounded-xl sm:h-11"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Report title</Label>
          <Input
            id="title"
            name="title"
            required
            disabled={isPending}
            className="h-12 rounded-xl sm:h-11"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes for client</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            disabled={isPending}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-xl border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50 sm:text-sm"
            placeholder="Optional message visible to the client"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Report file</Label>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => pickerInputRef.current?.click()}
            className="h-12 w-full rounded-xl sm:h-11"
          >
            {selectedFile ? selectedFile.name : "Choose file"}
          </Button>
          <input
            ref={pickerInputRef}
            type="file"
            accept={REPORTS_ACCEPT}
            className="sr-only"
            disabled={isPending}
            onChange={(event) => handleFileSelect(event.target.files?.[0])}
          />
        </div>
      </div>

      {localError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {localError}
        </p>
      ) : null}

      {showError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.success === true ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Reporte publicado correctamente.
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={isPending || !selectedFile}
        className={cn("h-12 rounded-xl sm:h-11")}
      >
        {isPending ? "Saving…" : "Save report"}
      </Button>
    </form>
  );
}
