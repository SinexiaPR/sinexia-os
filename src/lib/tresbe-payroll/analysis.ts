import { z } from "zod";

// Shape of the weekly "% de nomina sobre venta" analysis Maria computes by
// hand (with Claude Cowork) outside Sinexia OS. Which refunds/tips to
// exclude and how to split tips between businesses is her judgment call,
// with too many week-to-week exceptions for a fixed system rule -- so this
// only validates and stores what she pastes; nothing here recomputes a
// subtotal or a percentage.

const deduccionSchema = z.object({
  concepto: z.string().trim().min(1).max(200),
  importe: z.number().finite(),
  subtotal: z.number().finite(),
});

const negocioCombinadaSchema = z.object({
  negocio: z.string().trim().min(1).max(100),
  nomina_sin_propina: z.number().finite(),
  porcentaje_venta_total_pts: z.number().finite(),
});

const negocioPropiaSchema = z.object({
  negocio: z.string().trim().min(1).max(100),
  venta_propia: z.number().finite(),
  nomina_sin_propina: z.number().finite(),
  porcentaje_propio: z.number().finite(),
});

export const tresbePayrollAnalysisSchema = z
  .object({
    empresa: z.string().trim().max(100).optional(),
    periodo: z
      .object({ desde: z.string(), hasta: z.string() })
      .partial()
      .optional(),
    venta: z.object({
      tresbe_cafe_con_ce: z.number().finite(),
      cafe_con_ce_calle_cerra: z.number().finite(),
      total: z.number().finite(),
    }),
    ajuste_total_nomina: z.object({
      total_nomina_sinexia: z.object({
        importe: z.number().nullable(),
        subtotal: z.number().finite(),
        detalle: z.string().trim().min(1).max(200),
      }),
      deducciones: z.array(deduccionSchema).max(50),
      nomina_sin_propina_semana: z.number().finite(),
    }),
    porcentaje_sobre_venta_combinada: z.object({
      negocios: z.array(negocioCombinadaSchema).min(1).max(20),
      total: z.object({
        nomina_sin_propina: z.number().finite(),
        porcentaje_venta_total: z.number().finite(),
      }),
    }),
    porcentaje_sobre_venta_propia: z.object({
      negocios: z.array(negocioPropiaSchema).min(1).max(20),
    }),
    nota_ajuste_vs_analisis_anterior: z
      .object({ texto: z.string().trim().max(3000) })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export type TresbePayrollAnalysisJson = z.infer<
  typeof tresbePayrollAnalysisSchema
>;

/**
 * Light sanity checks on the numbers Maria pasted -- never blocks saving,
 * just flags a likely typo so she can double-check before printing.
 */
export function checkTresbeAnalysisConsistency(
  data: TresbePayrollAnalysisJson,
): string[] {
  const warnings: string[] = [];
  const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const closeEnough = (a: number, b: number) => Math.abs(a - b) <= 0.02;

  if (
    !closeEnough(
      data.venta.tresbe_cafe_con_ce + data.venta.cafe_con_ce_calle_cerra,
      data.venta.total,
    )
  ) {
    warnings.push(
      `La venta total ($${round2(data.venta.total).toFixed(2)}) no coincide con la suma de los dos negocios ($${round2(data.venta.tresbe_cafe_con_ce + data.venta.cafe_con_ce_calle_cerra).toFixed(2)}).`,
    );
  }

  let running = data.ajuste_total_nomina.total_nomina_sinexia.subtotal;
  for (const item of data.ajuste_total_nomina.deducciones) {
    running = round2(running + item.importe);
    if (!closeEnough(running, item.subtotal)) {
      warnings.push(
        `El subtotal de "${item.concepto}" da $${item.subtotal.toFixed(2)} en el JSON, pero corriendo los importes da $${running.toFixed(2)}.`,
      );
    }
  }
  if (
    !closeEnough(running, data.ajuste_total_nomina.nomina_sin_propina_semana)
  ) {
    warnings.push(
      `"Nómina sin propina de la semana" ($${data.ajuste_total_nomina.nomina_sin_propina_semana.toFixed(2)}) no coincide con el último subtotal de la tabla de ajustes ($${running.toFixed(2)}).`,
    );
  }

  const combinadaSum = data.porcentaje_sobre_venta_combinada.negocios.reduce(
    (sum, n) => sum + n.nomina_sin_propina,
    0,
  );
  if (
    !closeEnough(
      combinadaSum,
      data.porcentaje_sobre_venta_combinada.total.nomina_sin_propina,
    )
  ) {
    warnings.push(
      `La suma de nómina sin propina por negocio ($${round2(combinadaSum).toFixed(2)}) no coincide con el total de la tabla 2 ($${data.porcentaje_sobre_venta_combinada.total.nomina_sin_propina.toFixed(2)}).`,
    );
  }

  return warnings;
}
