"""Soma SmartBlinds 2 Home Assistant integration.

This integration exposes a Cover entity that communicates with the SOMA SmartBlinds 2
over BLE. It uses bleak for BLE communication.
"""


from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry

from .const import DEFAULT_NAME

DOMAIN = "soma_smartblinds2"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up integration from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # create and store a SomaDevice manager for this entry
    from .device import SomaDevice

    entry_data = {
        "bt_address": entry.data.get("bt_address"),
        "title": entry.title or DEFAULT_NAME,
    }

    device = SomaDevice(
        entry_data["bt_address"],
        scan_timeout=entry.options.get("scan_timeout", 10.0),
        reconnect_wait=entry.options.get("reconnect_wait", 3.0),
        enable_notifications=entry.options.get("enable_notifications", True),
        poll_interval=entry.options.get("poll_interval", 1.0),
    )

    hass.data[DOMAIN][entry.entry_id] = {**entry_data, "device": device, "options": entry.options}

    # start device manager
    await device.start()

    # set up platforms (support different HA versions API)
    if hasattr(hass.config_entries, "async_forward_entry_setup"):
        hass.async_create_task(hass.config_entries.async_forward_entry_setup(entry, "cover"))
        hass.async_create_task(hass.config_entries.async_forward_entry_setup(entry, "sensor"))
    else:
        # newer HA may provide async_forward_entry_setups that accepts a list
        hass.async_create_task(hass.config_entries.async_forward_entry_setups(entry, ["cover"]))
        hass.async_create_task(hass.config_entries.async_forward_entry_setups(entry, ["sensor"]))

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    # stop device manager
    entry_data = hass.data[DOMAIN].get(entry.entry_id)
    if entry_data and "device" in entry_data:
        try:
            await entry_data["device"].stop()
        except Exception:
            pass

    unload_ok = await hass.config_entries.async_forward_entry_unload(entry, "cover")
    unload_ok &= await hass.config_entries.async_forward_entry_unload(entry, "sensor")

    hass.data[DOMAIN].pop(entry.entry_id, None)

    return unload_ok
