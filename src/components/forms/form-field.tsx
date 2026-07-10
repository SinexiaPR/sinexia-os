"use client";

import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { cn } from "@/lib/utils";

type FormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  className?: string;
  render: (
    field: ControllerRenderProps<TFieldValues, TName> & { id: string },
  ) => React.ReactNode;
};

export function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  className,
  render,
}: FormFieldProps<TFieldValues, TName>) {
  const id = `field-${String(name)}`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn("space-y-2", className)}>
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </label>
          {render({ ...field, id })}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
          {fieldState.error ? (
            <p className="text-xs text-destructive">
              {fieldState.error.message}
            </p>
          ) : null}
        </div>
      )}
    />
  );
}
