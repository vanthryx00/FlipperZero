import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { generateComplianceReportPDF, generateComplianceReportText, type ComplianceReportData } from "../security/pdfReportGenerator";
import { storagePut } from "../storage";

export const reportsRouter = router({
  /**
   * Export compliance report as PDF
   * Generates a professional PDF document with all test results and findings
   */
  exportPDF: protectedProcedure
    .input(
      z.object({
        templateName: z.string(),
        templateDescription: z.string(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]),
        completionDate: z.date(),
        totalSteps: z.number().int().positive(),
        completedSteps: z.number().int().nonnegative(),
        overallScore: z.number().min(0).max(100),
        testResults: z.array(
          z.object({
            stepId: z.string(),
            stepNumber: z.number().int().positive(),
            stepTitle: z.string(),
            passed: z.boolean(),
            details: z.string().optional(),
            checks: z.array(
              z.object({
                checkId: z.string(),
                name: z.string(),
                passed: z.boolean(),
                details: z.string().optional(),
              })
            ),
          })
        ),
        securityFindings: z.array(
          z.object({
            severity: z.enum(["critical", "high", "medium", "low"]),
            title: z.string(),
            description: z.string(),
            recommendation: z.string(),
          })
        ),
        complianceStatus: z.object({
          iso21434: z.boolean(),
          autosar: z.boolean(),
          notes: z.array(z.string()),
        }),
        organization: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const reportData: ComplianceReportData = {
        templateName: input.templateName,
        templateDescription: input.templateDescription,
        difficulty: input.difficulty,
        completionDate: input.completionDate,
        totalSteps: input.totalSteps,
        completedSteps: input.completedSteps,
        overallScore: input.overallScore,
        testResults: input.testResults,
        securityFindings: input.securityFindings,
        complianceStatus: input.complianceStatus,
        userInfo: {
          name: ctx.user.name || "Unknown User",
          email: ctx.user.email || "unknown@example.com",
          organization: input.organization,
        },
      };

      // Generate PDF
      const pdfBytes = await generateComplianceReportPDF(reportData);

      // Upload to storage
      const fileName = `compliance-report-${input.templateName}-${Date.now()}.pdf`;
      const { url } = await storagePut(fileName, pdfBytes, "application/pdf");

      // Also generate text version for email/logging
      const textReport = generateComplianceReportText(reportData);

      return {
        success: true,
        pdfUrl: url,
        fileName,
        textReport,
        reportData,
      };
    }),

  /**
   * Export compliance report as text (for email or logging)
   */
  exportText: protectedProcedure
    .input(
      z.object({
        templateName: z.string(),
        templateDescription: z.string(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]),
        completionDate: z.date(),
        totalSteps: z.number().int().positive(),
        completedSteps: z.number().int().nonnegative(),
        overallScore: z.number().min(0).max(100),
        testResults: z.array(
          z.object({
            stepId: z.string(),
            stepNumber: z.number().int().positive(),
            stepTitle: z.string(),
            passed: z.boolean(),
            details: z.string().optional(),
            checks: z.array(
              z.object({
                checkId: z.string(),
                name: z.string(),
                passed: z.boolean(),
                details: z.string().optional(),
              })
            ),
          })
        ),
        securityFindings: z.array(
          z.object({
            severity: z.enum(["critical", "high", "medium", "low"]),
            title: z.string(),
            description: z.string(),
            recommendation: z.string(),
          })
        ),
        complianceStatus: z.object({
          iso21434: z.boolean(),
          autosar: z.boolean(),
          notes: z.array(z.string()),
        }),
        organization: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const reportData: ComplianceReportData = {
        templateName: input.templateName,
        templateDescription: input.templateDescription,
        difficulty: input.difficulty,
        completionDate: input.completionDate,
        totalSteps: input.totalSteps,
        completedSteps: input.completedSteps,
        overallScore: input.overallScore,
        testResults: input.testResults,
        securityFindings: input.securityFindings,
        complianceStatus: input.complianceStatus,
        userInfo: {
          name: "User",
          email: "user@example.com",
          organization: input.organization,
        },
      };

      const textReport = generateComplianceReportText(reportData);

      return {
        success: true,
        textReport,
      };
    }),
});
