"""Sensor platform for Soma SmartBlinds 2 battery."""
from __future__ import annotations

import asyncio
import logging

from homeassistant.components.sensor import SensorEntity

from .const import BATTERY_UUID, DEFAULT_NAME
from . import DOMAIN

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
        self._device = hass.data[DOMAIN][entry_id]["device"]
        self._device.add_battery_listener(self._on_battery)
        self._device.add_connection_listener(self._on_connection_change)
        self._reconnect_wait = hass.data[DOMAIN][entry_id].get("options", {}).get("reconnect_wait", 3.0)
        self._disconnect_handle = None

    @property
    def unique_id(self) -> str:
        return f"{self._bt_address.replace(':','').lower()}_battery"

    def _on_connection_change(self, connected: bool):
        if connected:
            if self._disconnect_handle and not self._disconnect_handle.cancelled():
                self._disconnect_handle.cancel()
            self._available = True
            self.schedule_update_ha_state()
        else:
            loop = asyncio.get_event_loop()
            if self._disconnect_handle and not self._disconnect_handle.cancelled():
                self._disconnect_handle.cancel()

            async def _mark_unavailable():
                await asyncio.sleep(self._reconnect_wait)
                if not self._device._client or not getattr(self._device._client, "is_connected", False):
                    self._available = False
                    self.schedule_update_ha_state()

            self._disconnect_handle = loop.create_task(_mark_unavailable())

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

    async def async_will_remove_from_hass(self) -> None:
        try:
            self._device.remove_battery_listener(self._on_battery)
            self._device.remove_connection_listener(self._on_connection_change)
        except Exception:
            pass

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, self._bt_address)},
            "name": self._name.replace(" Battery", ""),
            "manufacturer": "Soma",
            "model": "SmartBlinds 2",
        }
