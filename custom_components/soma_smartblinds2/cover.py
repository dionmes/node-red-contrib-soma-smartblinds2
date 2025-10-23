"""Cover platform for Soma SmartBlinds 2."""
from __future__ import annotations

import asyncio
import logging

from homeassistant.components.cover import CoverEntity

from .const import (
    POSITION_CHAR_UUID,
    MOVE_PERCENT_UUID,
    MOTOR_CHAR_UUID,
    BATTERY_UUID,
    DEFAULT_NAME,
)

from . import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Deprecated: allow YAML-less setup via config entries later.

    For now, user must provide a 'bt_address' key in config to add a single device.
    """
    bt_address = config.get("bt_address") if config else None
    if not bt_address:
        _LOGGER.error("No bt_address provided in platform configuration")
        return

    entity = SomaSmartBlindsCover(bt_address)
    async_add_entities([entity], update_before_add=True)


async def async_setup_entry(hass, entry, async_add_entities):
    """Set up cover from a config entry using shared SomaDevice."""
    entry_data = hass.data[DOMAIN][entry.entry_id]
    bt_address = entry_data["bt_address"]
    title = entry_data["title"]
    entity = SomaSmartBlindsCover(bt_address, entry.entry_id, hass)
    entity._name = title
    async_add_entities([entity], update_before_add=True)


class SomaSmartBlindsCover(CoverEntity):
    """Representation of a Soma SmartBlinds 2 as a Cover entity."""

    def __init__(self, bt_address: str, entry_id: str, hass):
        self._bt_address = bt_address
        self._entry_id = entry_id
        self._hass = hass
        self._name = DEFAULT_NAME + " " + bt_address.replace(":", "")[-6:]
        self._position = None
        self._battery = None
        self._available = False
        self._lock = asyncio.Lock()
        self._device = hass.data[DOMAIN][entry_id]["device"]

        # register listeners
        self._device.add_position_listener(self._on_position)
        self._device.add_battery_listener(self._on_battery)

    def _on_position(self, pos: int):
        self._position = pos
        self.schedule_update_ha_state()

    def _on_battery(self, batt: int):
        self._battery = batt
        self.schedule_update_ha_state()

    @property
    def name(self):
        return self._name

    @property
    def available(self) -> bool:
        return self._available

    @property
    def device_class(self):
        # Use string constant to avoid import changes across HA versions
        return "shutter"

    @property
    def current_cover_position(self) -> int | None:
        return self._position

    @property
    def is_closed(self) -> bool | None:
        if self._position is None:
            return None
        return self._position == 0

    async def async_update(self):
        # Ensure connected and read position and battery
        try:
            # rely on the shared device for notifications/connection
            self._available = True

        except Exception as err:
            _LOGGER.error("Error during update: %s", err)
            self._available = False

    async def _connect(self):
        # Connection is managed by SomaDevice; no-op here
        return

    @property
    def device_info(self):
        return {
            "identifiers": {(DOMAIN, self._bt_address)},
            "name": self._name,
            "manufacturer": "Soma",
            "model": "SmartBlinds 2",
        }

    async def async_set_cover_position(self, **kwargs):
        position = int(kwargs.get("position"))
        # Node-RED writes move percent as 100 - position as hex string byte
        move_percent = 100 - position
        # write a single byte hex value
        data = bytes([move_percent])
        async with self._lock:
            await self._device.write_move_percent(move_percent)

    async def async_open_cover(self, **kwargs):
        # Move up == open (Node-RED uses 0x69)
        async with self._lock:
            await self._device.write_motor(0x69, response=False)

    async def async_close_cover(self, **kwargs):
        # Move down == close (Node-RED uses 0x96)
        async with self._lock:
            await self._device.write_motor(0x96, response=True)

    async def async_stop_cover(self, **kwargs):
        async with self._lock:
            await self._device.write_motor(0x00, response=False)

    async def async_identify(self):
        # Send identify command (Node-RED writes [1] to notify char)
        async with self._lock:
            # write directly to notify char via device's client
            await self._device.write_motor(0x01, response=False)

    async def async_will_remove_from_hass(self) -> None:
        # remove listeners
        try:
            self._device.remove_position_listener(self._on_position)
            self._device.remove_battery_listener(self._on_battery)
        except Exception:
            pass
