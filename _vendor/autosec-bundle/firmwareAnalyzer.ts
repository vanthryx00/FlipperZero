/**
 * Firmware Vulnerability Analysis Engine
 * Scans automotive firmware for common security weaknesses and provides hardening recommendations
 */

export interface VulnerabilityFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  location?: string;
  recommendation: string;
  cveReference?: string;
  hardneningTemplate?: string;
}

export interface FirmwareAnalysisReport {
  firmwareHash: string;
  analysisDate: Date;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: VulnerabilityFinding[];
  overallSecurityScore: number; // 0-100
  complianceStatus: {
    iso21434: boolean;
    autosar: boolean;
    secoc: boolean;
  };
}

export class FirmwareAnalyzer {
  /**
   * Analyze firmware binary for security vulnerabilities
   */
  async analyzeFirmware(firmwareData: Uint8Array): Promise<FirmwareAnalysisReport> {
    const findings: VulnerabilityFinding[] = [];

    // Perform multiple analysis passes
    findings.push(...this.detectStaticCodes(firmwareData));
    findings.push(...this.detectWeakCryptography(firmwareData));
    findings.push(...this.detectMissingAuthentication(firmwareData));
    findings.push(...this.detectDebugInterfaces(firmwareData));
    findings.push(...this.detectHardcodedSecrets(firmwareData));
    findings.push(...this.detectMissingSecureBoot(firmwareData));
    findings.push(...this.detectCANBusVulnerabilities(firmwareData));
    findings.push(...this.detectMemorySafetyIssues(firmwareData));

    // Calculate security score
    const securityScore = this.calculateSecurityScore(findings);

    // Check compliance
    const complianceStatus = this.checkCompliance(findings);

    // Generate report
    const report: FirmwareAnalysisReport = {
      firmwareHash: this.hashFirmware(firmwareData),
      analysisDate: new Date(),
      totalFindings: findings.length,
      criticalCount: findings.filter((f) => f.severity === "critical").length,
      highCount: findings.filter((f) => f.severity === "high").length,
      mediumCount: findings.filter((f) => f.severity === "medium").length,
      lowCount: findings.filter((f) => f.severity === "low").length,
      findings: findings.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      overallSecurityScore: securityScore,
      complianceStatus,
    };

    return report;
  }

  /**
   * Detect static codes (non-rolling codes) in firmware
   */
  private detectStaticCodes(firmwareData: Uint8Array): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = [];

    // Look for patterns that indicate static codes
    const staticCodePatterns = [
      /0x[0-9A-Fa-f]{8}.*0x[0-9A-Fa-f]{8}.*0x[0-9A-Fa-f]{8}/g, // Repeated hex patterns
      /const.*=.*0x[0-9A-Fa-f]{16}/g, // Long static constants
    ];

    const firmwareString = this.bufferToString(firmwareData);

    staticCodePatterns.forEach((pattern) => {
      if (pattern.test(firmwareString)) {
        findings.push({
          id: "static-codes-001",
          severity: "critical",
          category: "Cryptographic Weakness",
          title: "Static Codes Detected",
          description:
            "Firmware appears to use static codes for vehicle access control. This is a critical vulnerability as attackers can capture and replay these codes indefinitely.",
          recommendation:
            "Implement rolling codes using cryptographic challenge-response mechanisms (AES-128 or ECC). Each transmission should generate a unique code bound to the vehicle and key.",
          cveReference: "CVE-2015-3622",
          hardneningTemplate: "rolling-codes-aes128",
        });
      }
    });

    return findings;
  }

  /**
   * Detect weak cryptography implementations
   */
  private detectWeakCryptography(firmwareData: Uint8Array): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = [];
    const firmwareString = this.bufferToString(firmwareData);

    // Check for weak algorithms
    const weakAlgorithms = [
      { pattern: /MD5|md5/g, name: "MD5", severity: "critical" as const },
      { pattern: /SHA1|sha1/g, name: "SHA-1", severity: "high" as const },
      { pattern: /DES(?!C)|des(?!c)/g, name: "DES", severity: "critical" as const },
      { pattern: /RC4|rc4/g, name: "RC4", severity: "high" as const },
    ];

    weakAlgorithms.forEach(({ pattern, name, severity }) => {
      if (pattern.test(firmwareString)) {
        findings.push({
          id: `weak-crypto-${name.toLowerCase()}`,
          severity,
          category: "Cryptographic Weakness",
          title: `Weak Cryptographic Algorithm: ${name}`,
          description: `Firmware uses ${name}, which has known cryptographic weaknesses and is not suitable for security-critical operations in automotive systems.`,
          recommendation: `Replace ${name} with modern, industry-standard cryptography: AES-256 for symmetric encryption, SHA-256 or SHA-3 for hashing, and ECC (P-256 or P-384) for asymmetric operations.`,
          hardneningTemplate: `crypto-upgrade-${name.toLowerCase()}`,
        });
      }
    });

    return findings;
  }

  /**
   * Detect missing authentication mechanisms
   */
  private detectMissingAuthentication(firmwareData: Uint8Array): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = [];
    const firmwareString = this.bufferToString(firmwareData);

    // Check for authentication-related functions
    const authPatterns = [
      { pattern: /verify|authenticate|auth/gi, name: "Authentication" },
      { pattern: /hmac|mac|message.*auth/gi, name: "Message Authentication" },
      { pattern: /signature|sign|verify/gi, name: "Digital Signature" },
    ];

    let hasAnyAuth = false;
    authPatterns.forEach(({ pattern }) => {
      if (pattern.test(firmwareString)) {
        hasAnyAuth = true;
      }
    });

    if (!hasAnyAuth) {
      findings.push({
        id: "missing-auth-001",
        severity: "critical",
        category: "Authentication",
        title: "Missing Authentication Mechanisms",
        description:
          "Firmware does not appear to implement any authentication or message integrity verification. This allows attackers to inject arbitrary commands.",
        recommendation:
          "Implement SecOC (Secure Onboard Communication) for CAN bus messages. Use HMAC-SHA256 or AES-CMAC for message authentication codes. Implement challenge-response authentication for wireless commands.",
        hardneningTemplate: "secoc-implementation",
      });
    }

    return findings;
  }

  /**
   * Detect exposed debug interfaces
   */
  private detectDebugInterfaces(firmwareData: Uint8Array): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = [];
    const firmwareString = this.bufferToString(firmwareData);

    const debugPatterns = [
      { pattern: /JTAG|jtag/g, name: "JTAG", severity: "critical" as const },
      { pattern: /SWD|swd|serial.*wire/gi, name: "SWD (Serial Wire Debug)", severity: "critical" as const },
      { pattern: /debug.*port|debug.*enable/gi, name: "Debug Port", severity: "high" as const },
      { pattern: /uart.*debug|debug.*uart/gi, name: "UART Debug", severity: "high" as const },
    ];

    debugPatterns.forEach(({ pattern, name, severity }) => {
      if (pattern.test(firmwareString)) {
        findings.push({
          id: `debug-interface-${name.toLowerCase().replace(/ /g, "-")}`,
          severity,
          category: "Hardware Security",
          title: `Exposed Debug Interface: ${name}`,
          description: `Firmware appears to enable ${name}, allowing direct access to processor internals. This can be exploited to extract cryptographic keys or modify code.`,
          recommendation: `Implement anti-tamper mechanisms to detect and disable ${name} in production firmware. Use hardware watchdogs to trigger key erasure on unauthorized debug attempts. Consider fusing debug ports in production ECUs.`,
          hardneningTemplate: "anti-tamper-mechanisms",
        });
      }
    });

    return findings;
  }

  /**
   * Detect hardcoded secrets
   */
  private detectHardcodedSecrets(firmwareData: Uint8Array): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = [];
    const firmwareString = this.bufferToString(firmwareData);

    // Look for patterns that suggest hardcoded secrets
    const secretPatterns = [
      { pattern: /password|passwd|pwd/gi, name: "Password" },
      { pattern: /api.?key|apikey/gi, name: "API Key" },
      { pattern: /secret|token|auth/gi, name: "Secret/Token" },
      { pattern: /0x[0-9A-Fa-f]{32}|0x[0-9A-Fa-f]{64}/g, name: "Cryptographic Key" },
    ];

    secretPatterns.forEach(({ pattern, name }) => {
      if (pattern.test(firmwareString)) {
        findings.push({
          id: `hardcoded-secret-${name.toLowerCase().replace(/ /g, "-")}`,
          severity: "critical",
          category: "Secret Management",
          title: `Hardcoded ${name} Detected`,
          description: `Firmware contains hardcoded ${name}. Extracting the firmware allows attackers to obtain these secrets and compromise vehicle security.`,
          recommendation: `Never hardcode secrets in firmware. Use Hardware Security Modules (HSMs) or secure key storage (e.g., TPM, secure enclave). Implement key derivation functions (KDF) to generate session keys from a master secret stored securely.`,
          hardneningTemplate: "hsm-integration",
        });
      }
    });

    return findings;
  }

  /**
   * Detect missing secure boot
   */
  private detectMissingSecureBoot(firmwareData: Uint8Array): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = [];
    const firmwareString = this.bufferToString(firmwareData);

    // Check for secure boot signatures
    const secureBootPatterns = [
      /signature|sign|verify.*boot|secure.*boot/gi,
      /rsa|ecc|ecdsa/gi,
      /certificate|cert|x509/gi,
    ];

    let hasSecureBoot = false;
    secureBootPatterns.forEach((pattern) => {
      if (pattern.test(firmwareString)) {
        hasSecureBoot = true;
      }
    });

    if (!hasSecureBoot) {
      findings.push({
        id: "missing-secure-boot-001",
        severity: "critical",
        category: "Boot Security",
        title: "Missing Secure Boot Implementation",
        description:
          "Firmware does not appear to implement cryptographic verification of boot code. This allows attackers to replace firmware with malicious versions.",
        recommendation:
          "Implement Secure Boot using RSA-2048 or ECDSA signatures. Sign all firmware images with a manufacturer private key. Verify signatures during boot using the public key stored in secure ROM. Implement a chain of trust from the bootloader through all firmware layers.",
        hardneningTemplate: "secure-boot-implementation",
      });
    }

    return findings;
  }

  /**
   * Detect CAN bus vulnerabilities
   */
  private detectCANBusVulnerabilities(firmwareData: Uint8Array): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = [];
    const firmwareString = this.bufferToString(firmwareData);

    // Check for CAN message handling
    const canPatterns = [/can.*bus|can.*message|can.*frame/gi, /0x[0-9A-Fa-f]{3}.*can/gi];

    let hasCANHandling = false;
    canPatterns.forEach((pattern) => {
      if (pattern.test(firmwareString)) {
        hasCANHandling = true;
      }
    });

    if (hasCANHandling) {
      // Check for SecOC implementation
      const secOCPattern = /secoc|secure.*onboard.*communication/gi;
      if (!secOCPattern.test(firmwareString)) {
        findings.push({
          id: "can-bus-no-secoc-001",
          severity: "high",
          category: "CAN Bus Security",
          title: "CAN Bus Without SecOC Protection",
          description:
            "Firmware handles CAN bus messages but does not implement SecOC (Secure Onboard Communication). CAN messages are unauthenticated and can be spoofed or injected.",
          recommendation:
            "Implement SecOC as defined in ISO 26262 and AUTOSAR standards. Add authentication tags (MAC) and freshness values to all critical CAN messages. Verify authenticity on reception.",
          hardneningTemplate: "secoc-implementation",
        });
      }
    }

    return findings;
  }

  /**
   * Detect memory safety issues
   */
  private detectMemorySafetyIssues(firmwareData: Uint8Array): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = [];
    const firmwareString = this.bufferToString(firmwareData);

    // Check for unsafe functions
    const unsafeFunctions = [
      { pattern: /strcpy|sprintf|gets/g, name: "strcpy/sprintf/gets", type: "Buffer Overflow" },
      { pattern: /malloc|free|new|delete/g, name: "Manual Memory Management", type: "Memory Leak" },
      { pattern: /pointer.*arithmetic|ptr\s*\+|ptr\s*-/gi, name: "Pointer Arithmetic", type: "Out-of-Bounds" },
    ];

    unsafeFunctions.forEach(({ pattern, name, type }) => {
      if (pattern.test(firmwareString)) {
        findings.push({
          id: `memory-safety-${name.toLowerCase().replace(/ /g, "-")}`,
          severity: "high",
          category: "Memory Safety",
          title: `Unsafe ${type} Risk: ${name}`,
          description: `Firmware uses ${name}, which can lead to ${type} vulnerabilities. These can be exploited to execute arbitrary code or leak sensitive data.`,
          recommendation: `Use safe alternatives: strncpy instead of strcpy, snprintf instead of sprintf. Consider using Rust or other memory-safe languages for critical security functions. Implement bounds checking and use static analysis tools.`,
          hardneningTemplate: "memory-safe-coding",
        });
      }
    });

    return findings;
  }

  /**
   * Calculate overall security score
   */
  private calculateSecurityScore(findings: VulnerabilityFinding[]): number {
    let score = 100;

    findings.forEach((finding) => {
      const penalty = {
        critical: 20,
        high: 10,
        medium: 5,
        low: 2,
      };

      score -= penalty[finding.severity];
    });

    return Math.max(0, score);
  }

  /**
   * Check compliance with standards
   */
  private checkCompliance(findings: VulnerabilityFinding[]): {
    iso21434: boolean;
    autosar: boolean;
    secoc: boolean;
  } {
    const criticalFindings = findings.filter((f) => f.severity === "critical");

    return {
      iso21434: criticalFindings.length === 0,
      autosar: !findings.some((f) => f.category === "CAN Bus Security"),
      secoc: !findings.some((f) => f.hardneningTemplate === "secoc-implementation"),
    };
  }

  /**
   * Generate firmware hash for tracking
   */
  private hashFirmware(data: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Convert buffer to string for pattern matching
   */
  private bufferToString(data: Uint8Array): string {
    let result = "";
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data[i]);
    }
    return result;
  }
}

export const firmwareAnalyzer = new FirmwareAnalyzer();
