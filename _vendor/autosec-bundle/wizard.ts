import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getWizardSteps,
  calculateProgress,
  generateComplianceReport,
  WizardProgress,
} from "../security/hardeningWizard";
import { storagePut } from "../storage";

export const wizardRouter = router({
  /**
   * Get wizard steps for a specific template
   */
  getSteps: publicProcedure
    .input(
      z.object({
        templateName: z.string(),
      })
    )
    .query(({ input }) => {
      const steps = getWizardSteps(input.templateName);

      return {
        success: true,
        steps: steps.map((step) => ({
          id: step.id,
          stepNumber: step.stepNumber,
          title: step.title,
          description: step.description,
          estimatedTime: step.estimatedTime,
          resources: step.resources,
        })),
        totalSteps: steps.length,
      };
    }),

  /**
   * Get detailed information for a specific step
   */
  getStepDetails: publicProcedure
    .input(
      z.object({
        stepId: z.string(),
        templateName: z.string(),
      })
    )
    .query(({ input }) => {
      const steps = getWizardSteps(input.templateName);
      const step = steps.find((s) => s.id === input.stepId);

      if (!step) {
        throw new Error("Step not found");
      }

      return {
        success: true,
        step: {
          id: step.id,
          stepNumber: step.stepNumber,
          title: step.title,
          description: step.description,
          instructions: step.instructions,
          codeSnippet: step.codeSnippet,
          testingProcedure: step.testingProcedure,
          validationChecks: step.validationChecks,
          resources: step.resources,
          estimatedTime: step.estimatedTime,
        },
      };
    }),

  /**
   * Mark a step as completed
   */
  completeStep: protectedProcedure
    .input(
      z.object({
        templateName: z.string(),
        stepId: z.string(),
        testResults: z.array(
          z.object({
            checkId: z.string(),
            passed: z.boolean(),
            details: z.string().optional().default(""),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // In a real implementation, this would update the database
      // For now, return success
      const allPassed = input.testResults.every((r) => r.passed);

      return {
        success: allPassed,
        message: allPassed
          ? `Step completed successfully`
          : "Some validation checks failed. Please review and try again.",
        testResults: input.testResults,
      };
    }),

  /**
   * Get user's wizard progress
   */
  getProgress: protectedProcedure
    .input(
      z.object({
        templateName: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      // In a real implementation, this would fetch from database
      const mockProgress: WizardProgress = {
        userId: ctx.user.id.toString(),
        templateName: input.templateName,
        currentStep: 1,
        completedSteps: [],
        testResults: [],
        startDate: new Date(),
        lastUpdated: new Date(),
        status: "in-progress",
      };

      const progressPercentage = calculateProgress(mockProgress);

      return {
        success: true,
        progress: mockProgress,
        progressPercentage,
      };
    }),

  /**
   * Generate compliance report
   */
  generateReport: protectedProcedure
    .input(
      z.object({
        templateName: z.string(),
        testResults: z.array(
          z.object({
            stepId: z.string(),
            passed: z.boolean(),
            details: z.string().optional().default(""),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const report = generateComplianceReport(input.templateName, input.testResults);

      // Store report in S3
      const reportKey = `compliance-reports/${ctx.user.id}/${input.templateName}-${Date.now()}.json`;
      const reportJson = JSON.stringify(report);
      await storagePut(reportKey, reportJson, "application/json");

      return {
        success: true,
        report,
        reportUrl: `/manus-storage/${reportKey}`,
      };
    }),

  /**
   * Get wizard statistics
   */
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    // In a real implementation, this would fetch from database
    return {
      success: true,
      statistics: {
        totalWizardsStarted: 0,
        totalWizardsCompleted: 0,
        averageCompletionTime: 0,
        mostPopularTemplate: "ROLLING_CODE_TEMPLATE",
      },
    };
  }),

  /**
   * Get available templates for wizard
   */
  getAvailableTemplates: publicProcedure.query(() => {
    return {
      success: true,
      templates: [
        {
          id: "ROLLING_CODE_TEMPLATE",
          name: "Rolling Code Implementation",
          description: "Replace static codes with cryptographically secure rolling codes",
          difficulty: "intermediate",
          estimatedCompletionTime: 150, // minutes
          steps: 6,
        },
        {
          id: "SECOC_IMPLEMENTATION_TEMPLATE",
          name: "SecOC (Secure Onboard Communication)",
          description: "Add authentication and freshness verification to CAN messages",
          difficulty: "advanced",
          estimatedCompletionTime: 180,
          steps: 5,
        },
        {
          id: "ANTI_TAMPER_TEMPLATE",
          name: "Anti-Tamper Mechanisms",
          description: "Detect and respond to unauthorized debug access",
          difficulty: "advanced",
          estimatedCompletionTime: 120,
          steps: 4,
        },
        {
          id: "SECURE_BOOT_TEMPLATE",
          name: "Secure Boot Implementation",
          description: "Implement cryptographic firmware verification",
          difficulty: "intermediate",
          estimatedCompletionTime: 140,
          steps: 5,
        },
        {
          id: "HSM_INTEGRATION_TEMPLATE",
          name: "Hardware Security Module Integration",
          description: "Secure key storage and cryptographic operations",
          difficulty: "advanced",
          estimatedCompletionTime: 160,
          steps: 6,
        },
        {
          id: "MEMORY_SAFE_CODING_TEMPLATE",
          name: "Memory-Safe Coding Patterns",
          description: "Prevent buffer overflows and memory corruption",
          difficulty: "beginner",
          estimatedCompletionTime: 100,
          steps: 4,
        },
      ],
    };
  }),

  /**
   * Save step progress to draft
   */
  saveDraft: protectedProcedure
    .input(
      z.object({
        templateName: z.string(),
        stepId: z.string(),
        draftContent: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // In a real implementation, this would save to database
      const draftKey = `wizard-drafts/${ctx.user.id}/${input.templateName}/${input.stepId}.txt`;
      await storagePut(draftKey, input.draftContent, "text/plain");

      return {
        success: true,
        message: "Draft saved successfully",
        draftUrl: `/manus-storage/${draftKey}`,
      };
    }),

  /**
   * Load step draft
   */
  loadDraft: protectedProcedure
    .input(
      z.object({
        templateName: z.string(),
        stepId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      // In a real implementation, this would fetch from S3
      // For now, return empty draft
      return {
        success: true,
        draft: "",
      };
    }),

  /**
   * Export wizard progress as PDF report
   */
  exportReport: protectedProcedure
    .input(
      z.object({
        templateName: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // In a real implementation, this would generate a PDF
      return {
        success: true,
        message: "Report exported successfully",
        downloadUrl: `/reports/${ctx.user.id}/${input.templateName}.pdf`,
      };
    }),
});
