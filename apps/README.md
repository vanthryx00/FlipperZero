# apps/ — Flipper Application Packages (.fap)

The Flipper's SD card loads applications as compiled `.fap` binaries — each
app is one file whose metadata (name, icon, entry point) is embedded at
build time against the exact firmware you run.

This folder ships **empty on purpose**:

- A `.fap` must be built against your exact firmware channel *and version*
  (official / Unleashed / Momentum / Xtreme / …). A stale `.fap` shows up as
  a blank icon at best and a crash at worst.
- The official mobile apps (iOS/Android) and qFlipper install `.fap` files
  from the app catalog for you — no PC-side copying needed, and the catalog
  picks the correct build automatically.

To populate from a PC:

1. Download a `.fap` bundle built for **your** firmware channel + version.
2. Drop the `.fap` files into this folder.
3. Run `.\flipper-sync.cmd` to push them onto the device.

Do **not** mix `.fap` files built for different firmware channels in one
sync — replace the whole `apps/` content per channel instead.

## Writing your own apps: reference

To develop your own FAP (C source + `application.fam` manifest, view
lifecycle, build commands), an archived third-party reference is available
in this workspace:

- `_vendor/autosec-bundle/flipper_zero_development.md` — accurate FAP
  development reference (app structure, memory management, view dispatcher,
  manifests, `./fbt` build/flash commands).
- `_vendor/autosec-bundle/application.fam` + the `*_tool.c` / `*_monitor.c`
  sources — worked manifest + UI-scaffolding examples. **Reference only:**
  the bundled code was never compiled against real firmware (see
  `_vendor/autosec-bundle/README.md` honest limits).

Build a real FAP from the flipper-firmware tree, not from the archive.
