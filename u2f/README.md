# u2f/ — U2F / FIDO2 credentials

The Flipper's U2F app registers hardware keys with FIDO2/U2F services
(Google, GitHub, Dropbox, …). All registrations are stored in **one file**,
`key.u2f`, in this folder (verified against the firmware source:
`U2F_KEY_FILE = U2F_DATA_FOLDER "key.u2f"` in `applications/main/u2f/u2f_data.c`).

- The file is a **flipper-format** document holding the key data, and it is
  **generated on-device** during a live registration handshake with each
  service — it cannot be synthesized on a PC.
- **Back this file up.** Deleting it silently invalidates every site you
  registered; the Flipper's PIN is the only unlock for the keys.
- This folder ships empty on purpose: the only correct way to populate it is
  to open the Flipper's U2F app and register with each service.
