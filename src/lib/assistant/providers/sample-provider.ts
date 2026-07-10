import { assistantConfig } from "@/config/assistant";
import type {
  AssistantContext,
  AssistantProvider,
  AssistantResponse,
} from "@/lib/assistant/types";

function normalizeInput(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export class SampleAssistantProvider implements AssistantProvider {
  async generate(
    input: string,
    context: AssistantContext,
  ): Promise<AssistantResponse> {
    const query = normalizeInput(input);

    let message: string;

    if (
      query.includes("reporte") ||
      query.includes("report") ||
      query.includes("disponible")
    ) {
      message = this.buildReportsAnswer(context);
    } else if (
      query.includes("pendiente") ||
      query.includes("pending") ||
      query.includes("revision") ||
      query.includes("review")
    ) {
      message = this.buildPendingAnswer(context);
    } else if (
      query.includes("subido") ||
      query.includes("subi") ||
      query.includes("upload") ||
      query.includes("inbox") ||
      query.includes("documento") ||
      query.includes("document") ||
      query.includes("archivo") ||
      query.includes("cuantos") ||
      query.includes("cuantas")
    ) {
      message = this.buildUploadsAnswer(context);
    } else {
      message = this.buildSummaryAnswer(context);
    }

    return {
      message,
      disclaimer: assistantConfig.disclaimer,
    };
  }

  private buildUploadsAnswer(context: AssistantContext): string {
    if (context.totalDocuments === 0) {
      return `Aún no consta ningún documento en Documentos para ${context.companyName}. Puede cargar archivos desde Documentos y el equipo de Sinexia los revisará.`;
    }

    if (context.totalDocuments === 1) {
      return `Según su portal, tiene 1 documento cargado en Documentos de ${context.companyName}. Sinexia lo revisará y le informará cuando esté procesado.`;
    }

    return `Según su portal, tiene ${context.totalDocuments} documentos cargados en Documentos de ${context.companyName}. Sinexia los revisa en orden de recepción.`;
  }

  private buildPendingAnswer(context: AssistantContext): string {
    if (context.pendingDocuments === 0) {
      return `No hay documentos pendientes de revisión para ${context.companyName} en este momento. Todos los archivos cargados han sido procesados o están en otra etapa.`;
    }

    if (context.pendingDocuments === 1) {
      return `Tiene 1 documento pendiente de revisión por Sinexia para ${context.companyName}. Le notificaremos cuando el estado cambie.`;
    }

    return `Tiene ${context.pendingDocuments} documentos pendientes de revisión por Sinexia para ${context.companyName}. Puede ver el detalle en Documentos.`;
  }

  private buildReportsAnswer(context: AssistantContext): string {
    if (context.availableReports === 0) {
      return `No hay reportes disponibles aún para ${context.companyName}. Cuando Sinexia finalice el procesamiento de sus documentos, los reportes aparecerán en la sección Reportes.`;
    }

    if (context.latestReportTitle) {
      return `Tiene ${context.availableReports} reporte(s) disponible(s) para ${context.companyName}. El más reciente es «${context.latestReportTitle}». Puede consultarlo en la sección Reportes.`;
    }

    return `Tiene ${context.availableReports} reporte(s) disponible(s) para ${context.companyName}. Puede consultarlos en la sección Reportes.`;
  }

  private buildSummaryAnswer(context: AssistantContext): string {
    return `Resumen para ${context.companyName}: ${context.totalDocuments} documento(s) en Documentos, ${context.pendingDocuments} pendiente(s) de revisión por Sinexia, y ${context.availableReports} reporte(s) disponible(s). Si necesita ayuda específica, puede contactar a Sinexia desde Ayuda o Mi cuenta.`;
  }
}
