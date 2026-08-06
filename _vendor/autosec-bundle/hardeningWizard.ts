/**
 * Hardening Wizard - Interactive Step-by-Step Secure Code Implementation
 * Guides users through implementing secure code templates with testing and validation
 */

export interface WizardStep {
  id: string;
  templateName: string;
  stepNumber: number;
  title: string;
  description: string;
  instructions: string[];
  codeSnippet: string;
  testingProcedure: TestingProcedure;
  validationChecks: ValidationCheck[];
  resources: Resource[];
  estimatedTime: number; // in minutes
}

export interface TestingProcedure {
  title: string;
  steps: string[];
  expectedOutput: string;
  commonIssues: { issue: string; solution: string }[];
}

export interface ValidationCheck {
  id: string;
  name: string;
  description: string;
  checkFunction: string; // Code to run for validation
  successCriteria: string;
}

export interface Resource {
  title: string;
  url: string;
  type: "documentation" | "standard" | "example" | "tool";
}

export interface WizardProgress {
  userId: string;
  templateName: string;
  currentStep: number;
  completedSteps: number[];
  testResults: { stepId: string; passed: boolean; details: string }[];
  startDate: Date;
  lastUpdated: Date;
  status: "in-progress" | "completed" | "paused";
}

export interface ComplianceReport {
  templateName: string;
  iso21434Compliant: boolean;
  autoSARCompliant: boolean;
  securityScore: number;
  vulnerabilitiesFixed: string[];
  remainingRisks: string[];
  recommendations: string[];
}

/**
 * Rolling Code Implementation Wizard Steps
 */
export const ROLLING_CODE_WIZARD_STEPS: WizardStep[] = [
  {
    id: "rolling-code-step-1",
    templateName: "ROLLING_CODE_TEMPLATE",
    stepNumber: 1,
    title: "Understanding Rolling Codes",
    description:
      "Learn the fundamentals of rolling code security and why static codes are vulnerable to replay attacks.",
    instructions: [
      "Review the concept of rolling codes as a defense against replay attacks",
      "Understand how AES-128 encryption provides cryptographic security",
      "Learn about counter-based freshness values and their role in preventing replay",
      "Study the difference between static and rolling code implementations",
    ],
    codeSnippet: `
// Static Code (VULNERABLE)
const STATIC_UNLOCK_CODE = 0xDEADBEEF;  // Same every time!

// Rolling Code (SECURE)
// Each transmission generates a unique code
// Code = AES-128(master_key, counter || random_nonce)
    `,
    testingProcedure: {
      title: "Conceptual Understanding Test",
      steps: [
        "Explain why static codes can be replayed",
        "Describe how rolling codes prevent replay attacks",
        "Identify the role of the counter in freshness verification",
      ],
      expectedOutput: "Understanding of rolling code security principles",
      commonIssues: [
        {
          issue: "Confusion between counter and nonce",
          solution:
            "Counter is strictly increasing and shared between sender/receiver. Nonce is random and unique per message.",
        },
      ],
    },
    validationChecks: [
      {
        id: "rolling-code-1-check-1",
        name: "Concept Verification",
        description: "Verify understanding of rolling code principles",
        checkFunction: "verifyRollingCodeConcept()",
        successCriteria: "User can explain rolling code security model",
      },
    ],
    resources: [
      {
        title: "RFC 2898 - PBKDF2",
        url: "https://tools.ietf.org/html/rfc2898",
        type: "standard",
      },
      {
        title: "NIST SP 800-38D - GCTR and GMAC",
        url: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf",
        type: "standard",
      },
    ],
    estimatedTime: 15,
  },

  {
    id: "rolling-code-step-2",
    templateName: "ROLLING_CODE_TEMPLATE",
    stepNumber: 2,
    title: "Setting Up AES-128 Encryption",
    description: "Configure AES-128 cryptographic library and initialize the rolling code context.",
    instructions: [
      "Include AES-128 library in your project",
      "Initialize the RollingCodeContext with a master key",
      "Set up the counter to a known starting value",
      "Configure random number generator for nonce generation",
    ],
    codeSnippet: `
#include "aes.h"
#include "random.h"

// Initialize rolling code context
RollingCodeContext ctx;
memcpy(ctx.master_key, MASTER_KEY, 16);
ctx.counter = 0;

// Verify AES library is working
uint8_t test_plaintext[16] = {0};
uint8_t test_ciphertext[16];
aes_encrypt(ctx.master_key, test_plaintext, test_ciphertext);
    `,
    testingProcedure: {
      title: "AES-128 Initialization Test",
      steps: [
        "Compile code with AES library",
        "Run initialization function",
        "Verify AES encryption produces different output each time (due to nonce)",
        "Check that counter increments correctly",
      ],
      expectedOutput: "AES library initialized, encryption working correctly",
      commonIssues: [
        {
          issue: "Linker errors with AES library",
          solution: "Ensure AES library is linked: -laes or include source files",
        },
        {
          issue: "Encryption output always the same",
          solution: "Verify random nonce is being generated. Check random() function.",
        },
      ],
    },
    validationChecks: [
      {
        id: "rolling-code-2-check-1",
        name: "AES Library Integration",
        description: "Verify AES-128 library is properly integrated",
        checkFunction: "testAESEncryption()",
        successCriteria: "AES encryption produces valid output",
      },
      {
        id: "rolling-code-2-check-2",
        name: "Counter Initialization",
        description: "Verify counter starts at correct value",
        checkFunction: "verifyCounterInit()",
        successCriteria: "Counter initialized to 0",
      },
    ],
    resources: [
      {
        title: "Tiny AES Library",
        url: "https://github.com/kokke/tiny-AES-c",
        type: "tool",
      },
      {
        title: "NIST AES Specification",
        url: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf",
        type: "standard",
      },
    ],
    estimatedTime: 20,
  },

  {
    id: "rolling-code-step-3",
    templateName: "ROLLING_CODE_TEMPLATE",
    stepNumber: 3,
    title: "Implementing Code Generation",
    description: "Implement the rolling code generation function with counter and nonce.",
    instructions: [
      "Implement generate_rolling_code() function",
      "Ensure counter increments on each call",
      "Generate random nonce for each message",
      "Encrypt plaintext (counter + nonce) using AES-128",
      "Return unique code each time",
    ],
    codeSnippet: `
int generate_rolling_code(RollingCodeContext *ctx, uint8_t *output_code) {
    if (!ctx || !output_code) return -1;
    
    // Increment counter (freshness value)
    ctx->counter++;
    
    // Create plaintext: counter + random nonce
    uint8_t plaintext[16];
    memcpy(plaintext, &ctx->counter, 4);
    
    // Fill remaining with random data
    for (int i = 4; i < 16; i++) {
        plaintext[i] = get_random_byte();
    }
    
    // Encrypt using master key
    aes_encrypt(ctx->master_key, plaintext, output_code);
    
    return 0;
}
    `,
    testingProcedure: {
      title: "Code Generation Test",
      steps: [
        "Call generate_rolling_code() multiple times",
        "Verify each output is different",
        "Verify counter increments by 1 each time",
        "Test with known master key and verify encryption",
      ],
      expectedOutput: "Each call produces unique 16-byte code with incrementing counter",
      commonIssues: [
        {
          issue: "Same code generated multiple times",
          solution: "Check that counter is incrementing and random nonce is different",
        },
        {
          issue: "Counter not incrementing",
          solution: "Verify counter is not being reset between calls",
        },
      ],
    },
    validationChecks: [
      {
        id: "rolling-code-3-check-1",
        name: "Unique Code Generation",
        description: "Verify each generated code is unique",
        checkFunction: "testUniqueCodeGeneration()",
        successCriteria: "100 consecutive codes are all different",
      },
      {
        id: "rolling-code-3-check-2",
        name: "Counter Increment",
        description: "Verify counter increments correctly",
        checkFunction: "testCounterIncrement()",
        successCriteria: "Counter increments by exactly 1 each call",
      },
    ],
    resources: [
      {
        title: "Rolling Code Example Implementation",
        url: "https://github.com/example/rolling-code",
        type: "example",
      },
    ],
    estimatedTime: 25,
  },

  {
    id: "rolling-code-step-4",
    templateName: "ROLLING_CODE_TEMPLATE",
    stepNumber: 4,
    title: "Implementing Verification (Receiver Side)",
    description: "Implement the verification function to detect replayed or out-of-sequence codes.",
    instructions: [
      "Implement verify_rolling_code() function",
      "Decrypt received code using master key",
      "Extract counter from decrypted data",
      "Check for replay (counter must be strictly increasing)",
      "Update local counter on successful verification",
    ],
    codeSnippet: `
int verify_rolling_code(RollingCodeContext *ctx, const uint8_t *received_code) {
    if (!ctx || !received_code) return -1;
    
    uint8_t decrypted[16];
    aes_decrypt(ctx->master_key, received_code, decrypted);
    
    // Extract counter
    uint32_t received_counter;
    memcpy(&received_counter, decrypted, 4);
    
    // Check for replay (counter must be strictly increasing)
    if (received_counter <= ctx->counter) {
        return -1;  // Replay detected!
    }
    
    // Update counter
    ctx->counter = received_counter;
    return 0;  // Valid code
}
    `,
    testingProcedure: {
      title: "Verification and Replay Detection Test",
      steps: [
        "Generate a valid rolling code",
        "Verify it passes validation",
        "Try to replay the same code - should fail",
        "Try an old code with lower counter - should fail",
        "Generate new code - should pass",
      ],
      expectedOutput: "Valid codes accepted, replayed codes rejected",
      commonIssues: [
        {
          issue: "Replay detection not working",
          solution: "Ensure counter comparison is using <= not <. Check counter extraction.",
        },
        {
          issue: "Valid codes being rejected",
          solution: "Verify master key is the same on both sides. Check AES decryption.",
        },
      ],
    },
    validationChecks: [
      {
        id: "rolling-code-4-check-1",
        name: "Replay Detection",
        description: "Verify replay attacks are detected",
        checkFunction: "testReplayDetection()",
        successCriteria: "Replayed code is rejected",
      },
      {
        id: "rolling-code-4-check-2",
        name: "Out-of-Sequence Detection",
        description: "Verify out-of-sequence codes are rejected",
        checkFunction: "testOutOfSequenceDetection()",
        successCriteria: "Old codes with lower counter are rejected",
      },
    ],
    resources: [
      {
        title: "Replay Attack Prevention",
        url: "https://owasp.org/www-community/attacks/Replay_attack",
        type: "documentation",
      },
    ],
    estimatedTime: 20,
  },

  {
    id: "rolling-code-step-5",
    templateName: "ROLLING_CODE_TEMPLATE",
    stepNumber: 5,
    title: "Integration and Real-World Testing",
    description: "Integrate rolling codes into your vehicle control system and perform end-to-end testing.",
    instructions: [
      "Integrate generate_rolling_code() into key fob firmware",
      "Integrate verify_rolling_code() into vehicle ECU firmware",
      "Perform range testing (verify codes work at distance)",
      "Test with multiple key fobs (each maintains own counter)",
      "Verify counter synchronization after power cycles",
      "Test security: attempt replay attacks, jamming, etc.",
    ],
    codeSnippet: `
// Key Fob Side
void send_unlock_command() {
    uint8_t rolling_code[16];
    generate_rolling_code(&keyfob_ctx, rolling_code);
    
    // Transmit rolling code to vehicle
    transmit_rf_command(rolling_code, 16);
}

// Vehicle ECU Side
void handle_unlock_command(const uint8_t *received_code) {
    if (verify_rolling_code(&vehicle_ctx, received_code) == 0) {
        unlock_vehicle();
    } else {
        // Reject invalid/replayed code
        log_security_event("Invalid rolling code");
    }
}
    `,
    testingProcedure: {
      title: "End-to-End Integration Test",
      steps: [
        "Program key fob with rolling code firmware",
        "Program vehicle ECU with verification firmware",
        "Test unlock from various distances",
        "Test with multiple key fobs simultaneously",
        "Perform replay attack test (capture and retransmit)",
        "Test counter recovery after power loss",
        "Verify security logs are generated",
      ],
      expectedOutput: "Vehicle unlocks with valid codes, rejects replayed codes",
      commonIssues: [
        {
          issue: "Counter desynchronization between key fob and vehicle",
          solution:
            "Implement counter resynchronization: allow small window of acceptable codes (e.g., counter ± 10)",
        },
        {
          issue: "Replay attacks still successful",
          solution: "Verify RF transmission is not being captured. Check for jamming/replay tools.",
        },
      ],
    },
    validationChecks: [
      {
        id: "rolling-code-5-check-1",
        name: "End-to-End Communication",
        description: "Verify rolling codes work in real-world RF environment",
        checkFunction: "testEndToEndCommunication()",
        successCriteria: "Vehicle responds to valid rolling codes",
      },
      {
        id: "rolling-code-5-check-2",
        name: "Multi-Key Fob Support",
        description: "Verify multiple key fobs work correctly",
        checkFunction: "testMultipleKeyFobs()",
        successCriteria: "Each key fob maintains independent counter",
      },
      {
        id: "rolling-code-5-check-3",
        name: "Replay Attack Resistance",
        description: "Verify system resists replay attacks",
        checkFunction: "testReplayAttackResistance()",
        successCriteria: "Captured and retransmitted codes are rejected",
      },
    ],
    resources: [
      {
        title: "Automotive Security Best Practices",
        url: "https://www.iso.org/standard/70918.html",
        type: "standard",
      },
    ],
    estimatedTime: 45,
  },

  {
    id: "rolling-code-step-6",
    templateName: "ROLLING_CODE_TEMPLATE",
    stepNumber: 6,
    title: "Compliance Verification and Documentation",
    description: "Verify compliance with ISO/SAE 21434 and document the implementation.",
    instructions: [
      "Review ISO/SAE 21434 requirements for key management",
      "Verify secure key storage (HSM or secure enclave)",
      "Document threat model and mitigations",
      "Create security test report",
      "Prepare for third-party security audit",
      "Document counter recovery procedures",
    ],
    codeSnippet: `
// Security Documentation Template
/*
 * ROLLING CODE IMPLEMENTATION SECURITY REPORT
 * 
 * Threat Model:
 * - Static Code Replay: MITIGATED by rolling codes
 * - Brute Force: MITIGATED by AES-128 (2^128 possibilities)
 * - Key Extraction: MITIGATED by HSM storage
 * 
 * Test Results:
 * - Replay Detection: PASSED
 * - Counter Synchronization: PASSED
 * - RF Range: PASSED (50+ meters)
 * 
 * Compliance:
 * - ISO/SAE 21434: COMPLIANT
 * - AUTOSAR: COMPLIANT
 */
    `,
    testingProcedure: {
      title: "Compliance Verification",
      steps: [
        "Review security documentation against ISO/SAE 21434",
        "Verify all threat models are addressed",
        "Review test results and coverage",
        "Prepare audit trail of security decisions",
        "Document any deviations and justifications",
      ],
      expectedOutput: "Compliance report ready for audit",
      commonIssues: [
        {
          issue: "Key storage not secure",
          solution: "Implement HSM or secure enclave for key storage",
        },
        {
          issue: "Insufficient test coverage",
          solution: "Add more test cases for edge cases and attack scenarios",
        },
      ],
    },
    validationChecks: [
      {
        id: "rolling-code-6-check-1",
        name: "ISO/SAE 21434 Compliance",
        description: "Verify compliance with automotive cybersecurity standard",
        checkFunction: "verifyISO21434Compliance()",
        successCriteria: "All requirements addressed",
      },
      {
        id: "rolling-code-6-check-2",
        name: "Documentation Complete",
        description: "Verify security documentation is complete",
        checkFunction: "verifyDocumentation()",
        successCriteria: "All required documents present",
      },
    ],
    resources: [
      {
        title: "ISO/SAE 21434:2021",
        url: "https://www.iso.org/standard/70918.html",
        type: "standard",
      },
      {
        title: "AUTOSAR Security Specification",
        url: "https://www.autosar.org/",
        type: "standard",
      },
    ],
    estimatedTime: 30,
  },
];

/**
 * Get wizard steps for a specific template
 */
export function getWizardSteps(templateName: string): WizardStep[] {
  const stepsMap: Record<string, WizardStep[]> = {
    ROLLING_CODE_TEMPLATE: ROLLING_CODE_WIZARD_STEPS,
    // Additional templates can be added here
  };

  return stepsMap[templateName] || [];
}

/**
 * Calculate completion percentage
 */
export function calculateProgress(progress: WizardProgress): number {
  const totalSteps = 6; // Assuming 6 steps per template
  return Math.round((progress.completedSteps.length / totalSteps) * 100);
}

/**
 * Generate compliance report
 */
export function generateComplianceReport(
  templateName: string,
  testResults: { stepId: string; passed: boolean; details: string }[]
): ComplianceReport {
  const allPassed = testResults.every((r) => r.passed);

  return {
    templateName,
    iso21434Compliant: allPassed,
    autoSARCompliant: allPassed,
    securityScore: allPassed ? 95 : 60,
    vulnerabilitiesFixed: allPassed ? ["Static Code Replay", "Brute Force Attacks"] : [],
    remainingRisks: allPassed
      ? ["Key Extraction (mitigated by HSM)", "Side-Channel Attacks"]
      : ["Implementation Vulnerabilities", "Incomplete Testing"],
    recommendations: allPassed
      ? [
          "Implement Hardware Security Module for key storage",
          "Conduct third-party security audit",
          "Monitor for emerging attacks and update accordingly",
        ]
      : ["Complete all wizard steps", "Pass all validation tests", "Review security documentation"],
  };
}
