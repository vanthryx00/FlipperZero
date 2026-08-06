# AutoSec Research Platform — archived bundle (reference only)

This folder is an **archived copy** of a third-party project bundle that was
uploaded as
`Creating a Flipper Zero Program: Ethical and Legal Guidelines.zip`
(67 files, dated 2026-08-03). It was not written by this workspace's authors;
it appears to be AI-generated output ("Manus" / "Koko" authorship appears in
manifests and reports).

> **PC-side only.** This folder lives under `_vendor/` so `flipper-sync.ps1`
> never pushes it to the Flipper's SD card. It is reference material, not
> device payloads, and none of the validators scan it.

## What's in here

| Area | Files | Notes |
|---|---|---|
| Skill | `SKILL.md`, `automotive-security-research.skill` | Reusable AI-skill packaging for the platform (the `.skill` is itself a zip). |
| Flipper FAP apps | `autosec_tool.c`, `can_monitor.c`, `marauder_companion.c`, `autosec_launcher.c`, `esp32_flasher.c`, `application.fam` | UI scaffolding apps. **Mostly simulated logic — not real, working builds.** |
| ESP32 code | `esp32_can_autosec.ino`, `esp32_flasher.c`, `esp32_marauder_firmware_placeholder.txt` | CAN sniffer/injector sketch + flasher scaffolding + Marauder download pointer. |
| Web app | `*.tsx`, `*.ts`, `index.html`, `index.css` | A React/tRPC SaaS-style app (WebUSB flasher, firmware analyzer, hardening wizard) tied to an external "Manus" platform. Not runnable in this repo. |
| Python tooling | `generate_fap_application.py`, `audit_system.py`, `generate_documentation.py` | FAP codegen, security-audit, and doc-generation helpers. |
| Docs | `flipper_zero_development.md` (accurate FAP reference), `web_deployment_guide.md`, ESP32/Marauder integration guides, rolling-codes explainer, ISO 21434/SecOC primer (`pasted_content.txt`), indexes, manifests, roadmap | Mixed quality — see honest limits. |
| Reports | `VERIFICATION_REPORT.txt` | Self-reported "ALL SYSTEMS VERIFIED" — **AI self-certification, not real build verification.** |
| Archives | `flipper-zero-complete-project.zip`, `flipper-zero-complete-project.tar.gz` | Nested backups of the FAP apps + docs (no attack guides inside). |

## Excluded on purpose

Two files were **not** archived: `automotive_pentesting_guide.md` and
`Automotive Penetration Testing: Advanced Vulnerability Demonstration Guide.md`.
Both contain step-by-step instructions for attacking real vehicles (CAN bus
injection/DoS, rolling-code grab-and-jam, WiFi deauth, gateway bypass). That
content is out of scope for this workspace; the defensive/educational material
(rolling-code explainer, ISO 21434 / SecOC primer) **was** kept.

## Honest limits

- **Not verified.** The `VERIFICATION_REPORT.txt` claims 50+ checks passed, but
  nothing here was compiled against real firmware or run on hardware. The C
  apps are UI scaffolding (e.g. the flasher uses hardcoded example sizes).
- **AI-generated.** Content was produced by an external AI agent; treat all
  code and claims as untrusted until independently reviewed and built.
- **Dual-use.** The ESP32 CAN sketch includes both sniffing (RX) and injection
  (TX) paths, and the skill targets automotive security research. Keep use to
  systems you own or have explicit written authorization to test, and follow
  local radio/vehicle laws.
- **No secrets found.** A scan of all `.ts/.c/.py/.ino` files found only
  pattern lists and reference URLs (NIST/OWASP/ISO) — no credentials, no
  `.env`, no telemetry/exfiltration code.

## Where to go from here

- The genuinely useful piece is `flipper_zero_development.md` — a solid FAP
  development reference that complements this repo's `apps/` folder.
- The ESP32/Marauder integration guides match the existing ESP32 devboard
  section in the main `README.md`.
