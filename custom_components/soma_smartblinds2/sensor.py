"""Sensor platform for Soma SmartBlinds 2 battery."""
from __future__ import annotations

import asyncio
import logging

from homeassistant.components.sensor import SensorEntity

from .const import BATTERY_UUID, DEFAULT_NAME

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    bt_address = config.get("bt_address") if config else None
    if not bt_address:
        _LOGGER.error("No bt_address provided for sensor platform")
        return

    async_add_entities([SomaBatterySensor(bt_address)], update_before_add=True)


async def async_setup_entry(hass, entry, async_add_entities):
    bt_address = entry.data.get("bt_address")
    title = entry.title
    entity = SomaBatterySensor(bt_address, entry.entry_id, hass)
    entity._name = f"{title} Battery"
    async_add_entities([entity], update_before_add=True)


class SomaBatterySensor(SensorEntity):
    def __init__(self, bt_address: str, entry_id: str, hass):
        self._bt_address = bt_address
        self._entry_id = entry_id
        self._hass = hass
        self._name = DEFAULT_NAME + " " + bt_address.replace(":", "")[-6:] + " Battery"
        self._state = None
        self._available = False
        self._lock = asyncio.Lock()
        self._device = hass.data["soma_smartblinds2"][entry_id]["device"]
        self._device.add_battery_listener(self._on_battery)

    def _on_battery(self, batt: int):
        self._state = batt
        self.schedule_update_ha_state()

    @property
    def name(self):
        return self._name

    @property
    def native_value(self):
        return self._state

    @property
    def device_class(self):
        return "battery"

    @property
    def available(self):
        return self._available

    async def async_update(self):
        # rely on shared device notifications; availability follows device
        self._available = True
