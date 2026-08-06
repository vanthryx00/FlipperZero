/**
 * Secure Code Templates for Automotive Firmware Hardening
 * Production-ready implementations of security patterns
 */

/**
 * Rolling Code Implementation using AES-128
 * Replaces static codes with cryptographically secure challenge-response
 */
export const ROLLING_CODE_TEMPLATE = `
#include <stdint.h>
#include <string.h>
#include "aes.h"

#define ROLLING_CODE_LENGTH 16
#define COUNTER_LENGTH 4

typedef struct {
    uint8_t master_key[16];
    uint32_t counter;
    uint8_t last_code[ROLLING_CODE_LENGTH];
} RollingCodeContext;

/**
 * Generate next rolling code
 * Each code is unique and cryptographically bound to vehicle and key
 */
int generate_rolling_code(RollingCodeContext *ctx, uint8_t *output_code) {
    if (!ctx || !output_code) return -1;
    
    // Increment counter (freshness value)
    ctx->counter++;
    
    // Create plaintext: counter + random nonce
    uint8_t plaintext[16];
    memcpy(plaintext, &ctx->counter, COUNTER_LENGTH);
    
    // Fill remaining with random data (nonce)
    for (int i = COUNTER_LENGTH; i < ROLLING_CODE_LENGTH; i++) {
        plaintext[i] = get_random_byte();
    }
    
    // Encrypt using master key (AES-128)
    aes_encrypt(ctx->master_key, plaintext, output_code);
    
    // Store for replay detection
    memcpy(ctx->last_code, output_code, ROLLING_CODE_LENGTH);
    
    return 0;
}

/**
 * Verify rolling code (receiver side)
 * Detects replayed or out-of-sequence codes
 */
int verify_rolling_code(RollingCodeContext *ctx, const uint8_t *received_code) {
    if (!ctx || !received_code) return -1;
    
    uint8_t decrypted[ROLLING_CODE_LENGTH];
    
    // Decrypt received code
    aes_decrypt(ctx->master_key, received_code, decrypted);
    
    // Extract counter
    uint32_t received_counter;
    memcpy(&received_counter, decrypted, COUNTER_LENGTH);
    
    // Check for replay (counter must be strictly increasing)
    if (received_counter <= ctx->counter) {
        return -1; // Replay detected
    }
    
    // Update counter
    ctx->counter = received_counter;
    
    return 0;
}
`;

/**
 * SecOC (Secure Onboard Communication) for CAN Bus
 * Adds authentication to CAN messages
 */
export const SECOC_IMPLEMENTATION_TEMPLATE = `
#include <stdint.h>
#include <string.h>
#include "hmac.h"
#include "can.h"

#define SECOC_KEY_LENGTH 32
#define MAC_LENGTH 8
#define FRESHNESS_LENGTH 2

typedef struct {
    uint8_t key[SECOC_KEY_LENGTH];
    uint16_t freshness_counter;
} SecOCContext;

/**
 * Secure a CAN message with authentication
 * Adds MAC and freshness value
 */
int secoc_secure_message(SecOCContext *ctx, 
                         const uint8_t *message, 
                         uint8_t message_len,
                         uint8_t *secured_message,
                         uint8_t *secured_len) {
    if (!ctx || !message || !secured_message) return -1;
    
    // Increment freshness counter
    ctx->freshness_counter++;
    
    // Create authentication input: message + freshness value
    uint8_t auth_input[64];
    memcpy(auth_input, message, message_len);
    memcpy(&auth_input[message_len], &ctx->freshness_counter, FRESHNESS_LENGTH);
    
    // Calculate HMAC-SHA256
    uint8_t mac[32];
    hmac_sha256(ctx->key, SECOC_KEY_LENGTH, 
                auth_input, message_len + FRESHNESS_LENGTH,
                mac);
    
    // Build secured message: original + freshness + MAC (truncated)
    memcpy(secured_message, message, message_len);
    memcpy(&secured_message[message_len], &ctx->freshness_counter, FRESHNESS_LENGTH);
    memcpy(&secured_message[message_len + FRESHNESS_LENGTH], mac, MAC_LENGTH);
    
    *secured_len = message_len + FRESHNESS_LENGTH + MAC_LENGTH;
    
    return 0;
}

/**
 * Verify secured CAN message
 * Checks authenticity and detects replay
 */
int secoc_verify_message(SecOCContext *ctx,
                         const uint8_t *secured_message,
                         uint8_t secured_len,
                         uint8_t *message,
                         uint8_t *message_len) {
    if (!ctx || !secured_message || !message) return -1;
    
    uint8_t payload_len = secured_len - FRESHNESS_LENGTH - MAC_LENGTH;
    
    // Extract components
    memcpy(message, secured_message, payload_len);
    
    uint16_t received_freshness;
    memcpy(&received_freshness, &secured_message[payload_len], FRESHNESS_LENGTH);
    
    const uint8_t *received_mac = &secured_message[payload_len + FRESHNESS_LENGTH];
    
    // Check freshness (must be strictly increasing)
    if (received_freshness <= ctx->freshness_counter) {
        return -1; // Replay detected
    }
    
    // Recalculate MAC
    uint8_t auth_input[64];
    memcpy(auth_input, message, payload_len);
    memcpy(&auth_input[payload_len], &received_freshness, FRESHNESS_LENGTH);
    
    uint8_t calculated_mac[32];
    hmac_sha256(ctx->key, SECOC_KEY_LENGTH,
                auth_input, payload_len + FRESHNESS_LENGTH,
                calculated_mac);
    
    // Constant-time comparison to prevent timing attacks
    int mac_valid = constant_time_compare(calculated_mac, received_mac, MAC_LENGTH);
    if (!mac_valid) {
        return -1; // MAC verification failed
    }
    
    // Update freshness counter
    ctx->freshness_counter = received_freshness;
    *message_len = payload_len;
    
    return 0;
}
`;

/**
 * Anti-Tamper Mechanisms
 * Detects unauthorized debug access and triggers security response
 */
export const ANTI_TAMPER_TEMPLATE = `
#include <stdint.h>
#include "watchdog.h"
#include "key_storage.h"

typedef struct {
    uint32_t debug_attempts;
    uint32_t tamper_flags;
} AntiTamperContext;

#define MAX_DEBUG_ATTEMPTS 3
#define TAMPER_DETECTED_FLAG 0x01
#define JTAG_DETECTED_FLAG 0x02
#define SWD_DETECTED_FLAG 0x04

/**
 * Monitor for debug interface access
 * Called periodically from main loop
 */
void anti_tamper_monitor(AntiTamperContext *ctx) {
    if (!ctx) return;
    
    // Check for JTAG access
    if (is_jtag_active()) {
        ctx->debug_attempts++;
        ctx->tamper_flags |= JTAG_DETECTED_FLAG;
    }
    
    // Check for SWD access
    if (is_swd_active()) {
        ctx->debug_attempts++;
        ctx->tamper_flags |= SWD_DETECTED_FLAG;
    }
    
    // Trigger security response on multiple attempts
    if (ctx->debug_attempts >= MAX_DEBUG_ATTEMPTS) {
        anti_tamper_response(ctx);
    }
}

/**
 * Security response to detected tampering
 * Erases keys and disables functionality
 */
void anti_tamper_response(AntiTamperContext *ctx) {
    if (!ctx) return;
    
    // Mark tamper detected
    ctx->tamper_flags |= TAMPER_DETECTED_FLAG;
    
    // Erase all cryptographic keys from memory
    erase_master_keys();
    erase_session_keys();
    
    // Disable critical functions
    disable_vehicle_control();
    
    // Trigger watchdog to force reboot
    watchdog_trigger_reset();
}

/**
 * Check tamper status
 * Returns true if tampering was detected
 */
int is_tamper_detected(AntiTamperContext *ctx) {
    if (!ctx) return 1; // Fail secure
    return (ctx->tamper_flags & TAMPER_DETECTED_FLAG) != 0;
}
`;

/**
 * Secure Boot Implementation
 * Cryptographic verification of firmware
 */
export const SECURE_BOOT_TEMPLATE = `
#include <stdint.h>
#include <string.h>
#include "ecdsa.h"
#include "sha256.h"

#define PUBLIC_KEY_SIZE 64
#define SIGNATURE_SIZE 64
#define HASH_SIZE 32

// Public key stored in secure ROM (manufacturer key)
const uint8_t MANUFACTURER_PUBLIC_KEY[PUBLIC_KEY_SIZE] = {
    // P-256 public key (64 bytes)
    // This should be burned into ROM during manufacturing
};

typedef struct {
    uint8_t firmware_hash[HASH_SIZE];
    uint8_t signature[SIGNATURE_SIZE];
} FirmwareSignature;

/**
 * Verify firmware signature before execution
 * Called from bootloader
 */
int verify_firmware(const uint8_t *firmware_data, 
                    uint32_t firmware_size,
                    const FirmwareSignature *sig) {
    if (!firmware_data || !sig) return -1;
    
    // Calculate SHA-256 hash of firmware
    uint8_t calculated_hash[HASH_SIZE];
    sha256(firmware_data, firmware_size, calculated_hash);
    
    // Compare with signed hash
    if (memcmp(calculated_hash, sig->firmware_hash, HASH_SIZE) != 0) {
        return -1; // Hash mismatch
    }
    
    // Verify ECDSA signature using manufacturer public key
    int sig_valid = ecdsa_verify(MANUFACTURER_PUBLIC_KEY,
                                 calculated_hash,
                                 sig->signature);
    
    if (!sig_valid) {
        return -1; // Signature verification failed
    }
    
    return 0; // Signature valid
}

/**
 * Execute firmware after verification
 */
int secure_boot_execute(const uint8_t *firmware_data,
                        uint32_t firmware_size,
                        const FirmwareSignature *sig) {
    // Verify signature
    if (verify_firmware(firmware_data, firmware_size, sig) != 0) {
        // Signature verification failed - do not execute
        halt_system();
        return -1;
    }
    
    // Signature valid - execute firmware
    execute_firmware(firmware_data);
    
    return 0;
}
`;

/**
 * Hardware Security Module (HSM) Integration
 * Secure key storage and cryptographic operations
 */
export const HSM_INTEGRATION_TEMPLATE = `
#include <stdint.h>
#include "hsm_interface.h"

typedef struct {
    uint32_t hsm_handle;
    uint8_t master_key_id;
} HSMContext;

/**
 * Initialize HSM connection
 * Establishes secure channel to HSM
 */
int hsm_init(HSMContext *ctx) {
    if (!ctx) return -1;
    
    // Open secure channel to HSM
    ctx->hsm_handle = hsm_open_channel();
    if (ctx->hsm_handle == 0) {
        return -1;
    }
    
    // Authenticate to HSM
    if (hsm_authenticate(ctx->hsm_handle) != 0) {
        return -1;
    }
    
    return 0;
}

/**
 * Perform cryptographic operation in HSM
 * Keys never leave the HSM
 */
int hsm_encrypt(HSMContext *ctx,
                const uint8_t *plaintext,
                uint32_t plaintext_len,
                uint8_t *ciphertext,
                uint32_t *ciphertext_len) {
    if (!ctx || !plaintext || !ciphertext) return -1;
    
    // Request encryption from HSM
    // Key material never exposed to main processor
    int result = hsm_request_encrypt(ctx->hsm_handle,
                                     ctx->master_key_id,
                                     plaintext,
                                     plaintext_len,
                                     ciphertext,
                                     ciphertext_len);
    
    return result;
}

/**
 * Derive session key from master key
 * Uses KDF (Key Derivation Function)
 */
int hsm_derive_session_key(HSMContext *ctx,
                           const uint8_t *context,
                           uint32_t context_len,
                           uint8_t *session_key,
                           uint32_t session_key_len) {
    if (!ctx || !context || !session_key) return -1;
    
    // Request key derivation from HSM
    // Master key never exposed
    int result = hsm_request_kdf(ctx->hsm_handle,
                                 ctx->master_key_id,
                                 context,
                                 context_len,
                                 session_key,
                                 session_key_len);
    
    return result;
}
`;

/**
 * Memory-Safe Coding Patterns
 * Prevents buffer overflows and memory corruption
 */
export const MEMORY_SAFE_CODING_TEMPLATE = `
#include <stdint.h>
#include <string.h>
#include <limits.h>

/**
 * Safe string copy with bounds checking
 * Replaces strcpy which has no bounds checking
 */
int safe_strcpy(char *dest, size_t dest_size, const char *src) {
    if (!dest || !src || dest_size == 0) return -1;
    
    size_t src_len = strlen(src);
    
    // Check if source fits in destination (including null terminator)
    if (src_len >= dest_size) {
        return -1; // Buffer overflow prevented
    }
    
    memcpy(dest, src, src_len + 1);
    return 0;
}

/**
 * Safe formatted string with bounds checking
 * Replaces sprintf which can overflow
 */
int safe_snprintf(char *buffer, size_t buffer_size, const char *format, ...) {
    if (!buffer || buffer_size == 0 || !format) return -1;
    
    // Use snprintf which respects buffer size
    va_list args;
    va_start(args, format);
    int result = vsnprintf(buffer, buffer_size, format, args);
    va_end(args);
    
    // Check for truncation
    if (result >= (int)buffer_size) {
        return -1; // Buffer overflow prevented
    }
    
    return result;
}

/**
 * Safe array access with bounds checking
 */
int safe_array_access(const uint8_t *array, size_t array_size, 
                      size_t index, uint8_t *value) {
    if (!array || !value || index >= array_size) {
        return -1; // Out-of-bounds access prevented
    }
    
    *value = array[index];
    return 0;
}

/**
 * Safe pointer arithmetic
 */
int safe_pointer_add(const uint8_t *base, size_t base_size,
                     size_t offset, uint8_t **result) {
    if (!base || !result) return -1;
    
    // Check for overflow
    if (offset > base_size) {
        return -1; // Pointer arithmetic overflow prevented
    }
    
    *result = (uint8_t *)base + offset;
    return 0;
}
`;

export const SECURE_CODE_TEMPLATES = {
  ROLLING_CODE_TEMPLATE,
  SECOC_IMPLEMENTATION_TEMPLATE,
  ANTI_TAMPER_TEMPLATE,
  SECURE_BOOT_TEMPLATE,
  HSM_INTEGRATION_TEMPLATE,
  MEMORY_SAFE_CODING_TEMPLATE,
};
