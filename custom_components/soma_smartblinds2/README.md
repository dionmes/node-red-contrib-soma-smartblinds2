# Soma SmartBlinds 2 Home Assistant Integration

This is a small custom integration that exposes your Soma SmartBlinds 2 as a Home Assistant cover entity using direct BLE (no cloud).

Requirements
- Home Assistant running on a platform with BLE support (Linux, macOS, or supported hardware).
- Python package bleak (the integration manifest requests it).
 - Optional but recommended: `bleak-retry-connector` to improve connection reliability.

You can install it into the Home Assistant Python environment:

```bash
# from your HA venv
pip install bleak-retry-connector
```

Installation
1. Copy the `soma_smartblinds2` folder into your Home Assistant `custom_components` directory.
2. Restart Home Assistant.
3. After restart, add the integration from the Home Assistant UI:

   - Settings → Devices & Services → Add Integration → search for "Soma SmartBlinds 2"
   - Fill in the Bluetooth address and optional settings in the form.
  - You can choose to scan for nearby devices and select your Soma device from a list (recommended).

Alternatively, for testing you can still use YAML configuration (not recommended for long term):

```yaml
cover:
  - platform: soma_smartblinds2
    bt_address: "AA:BB:CC:DD:EE:FF"
```

Notes
- This is an initial port from a Node-RED node. It implements basic open/close/stop/set_position and reports battery/position when available.
- You may need to run Home Assistant with permissions to access BLE. On Linux this typically means running as root or enabling capabilities for the Python binary.
