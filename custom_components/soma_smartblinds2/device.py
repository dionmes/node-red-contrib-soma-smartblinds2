"""SomaDevice: shared BLE connection manager for an entry."""
from __future__ import annotations

import asyncio
import logging
from typing import Callable

from bleak import BleakClient, BleakScanner

from .const import POSITION_CHAR_UUID, BATTERY_UUID, MOVE_PERCENT_UUID, MOTOR_CHAR_UUID

_LOGGER = logging.getLogger(__name__)


class SomaDevice:
    """Manage BLE connection and notifications for a single Soma device."""

    def __init__(self, bt_address: str, scan_timeout: float = 10.0, reconnect_wait: float = 3.0, enable_notifications: bool = True, poll_interval: float = 1.0):
        self.bt_address = bt_address
        self.scan_timeout = scan_timeout
        self.reconnect_wait = reconnect_wait
        self.enable_notifications = enable_notifications
        self.poll_interval = poll_interval

        self._client: BleakClient | None = None
        self._lock = asyncio.Lock()
        self._connected_event = asyncio.Event()

        # listeners
        self._position_listeners: list[Callable[[int], None]] = []
        self._battery_listeners: list[Callable[[int], None]] = []

        self._running = False

    async def start(self):
        if self._running:
            return
        self._running = True
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False
        if self._client and self._client.is_connected:
            try:
                await self._client.disconnect()
            except Exception:
                _LOGGER.debug("Error disconnecting client")

    async def _run(self):
        while self._running:
            try:
                await self._ensure_connected()
                await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as err:
                _LOGGER.debug("SomaDevice run loop error: %s", err)
                await asyncio.sleep(self.reconnect_wait)

    async def _ensure_connected(self):
        async with self._lock:
            if self._client and self._client.is_connected:
                return

            _LOGGER.debug("Scanning for %s", self.bt_address)

            # Try different address formats: as-provided, stripped, lower/upper
            candidates = [self.bt_address]
            stripped = self.bt_address.replace(":", "").lower()
            candidates.append(stripped)
            # try colon insertions for 12-char addresses
            if len(stripped) == 12:
                parts = [stripped[i:i+2] for i in range(0, 12, 2)]
                candidates.append(":".join(parts))

            device = None
            for cand in dict.fromkeys(candidates):
                try:
                    device = await BleakScanner.find_device_by_address(cand, timeout=1.0)
                    if device:
                        break
                except Exception:
                    continue

            # Fallback: scan nearby devices and try to match last 6 hex or known names
            if not device:
                _LOGGER.debug("Fallback full scan for device: %s", self.bt_address)
                found = await BleakScanner.discover(timeout=self.scan_timeout)
                tail = stripped[-6:]
                for d in found:
                    if not d:
                        continue
                    addr = (d.address or "").replace(":", "").lower()
                    name = (d.name or "").upper()
                    if addr.endswith(tail) or name in ("S", "RISE") or "SOMA" in name:
                        device = d
                        break

            if not device:
                _LOGGER.warning("Device %s not found", self.bt_address)
                self._connected_event.clear()
                return

            # Prefer bleak-retry-connector if available for more reliable connections
            client = None
            # Try to use bleak-retry-connector if available
            try:
                from bleak_retry_connector import establish_connection

                _LOGGER.debug("Using bleak-retry-connector to connect to %s", self.bt_address)
                client = await establish_connection(lambda: BleakClient(device), timeout=10.0)
            except Exception as exc:  # import error or establish failure
                _LOGGER.debug("bleak-retry-connector not available or failed: %s", exc)

                # Fallback: try plain BleakClient with a few retries and backoff
                client = BleakClient(device)
                last_err = None
                for attempt in range(1, 4):
                    try:
                        _LOGGER.debug("Attempt %d to connect to %s", attempt, self.bt_address)
                        await client.connect(timeout=10.0)
                        _LOGGER.debug("Connected on attempt %d to %s", attempt, self.bt_address)
                        last_err = None
                        break
                    except Exception as err:
                        last_err = err
                        _LOGGER.warning("Attempt %d failed to connect to %s: %s", attempt, self.bt_address, err)
                        await asyncio.sleep(1 * attempt)

                if last_err is not None:
                    _LOGGER.warning("Failed to connect to %s after retries: %s", self.bt_address, last_err)
                    self._connected_event.clear()
                    return

            # setup notifications
            try:
                await client.start_notify(POSITION_CHAR_UUID, self._handle_position)
            except Exception:
                _LOGGER.debug("Position notify not available")

            try:
                await client.start_notify(BATTERY_UUID, self._handle_battery)
            except Exception:
                _LOGGER.debug("Battery notify not available")

            self._client = client
            self._connected_event.set()
            _LOGGER.info("Connected to Soma %s", self.bt_address)

    def _handle_position(self, sender: int, data: bytearray):
        try:
            pos = 100 - int(data[0])
            for cb in list(self._position_listeners):
                try:
                    cb(int(pos))
                except Exception:
                    _LOGGER.exception("Position listener failed")
        except Exception:
            _LOGGER.exception("Failed to parse position notification")

    def _handle_battery(self, sender: int, data: bytearray):
        try:
            reading = int(data[0])
            batt = min(100, reading / 75 * 100)
            for cb in list(self._battery_listeners):
                try:
                    cb(int(round(batt)))
                except Exception:
                    _LOGGER.exception("Battery listener failed")
        except Exception:
            _LOGGER.exception("Failed to parse battery notification")

    async def write_move_percent(self, percent: int):
        async with self._lock:
            if not self._client or not self._client.is_connected:
                await self._ensure_connected()
            if not self._client or not self._client.is_connected:
                raise RuntimeError("Not connected")
            await self._client.write_gatt_char(MOVE_PERCENT_UUID, bytes([percent]), response=False)

    async def write_motor(self, byte_value: int, response: bool = False):
        async with self._lock:
            if not self._client or not self._client.is_connected:
                await self._ensure_connected()
            if not self._client or not self._client.is_connected:
                raise RuntimeError("Not connected")
            await self._client.write_gatt_char(MOTOR_CHAR_UUID, bytes([byte_value]), response=response)

    def add_position_listener(self, cb: Callable[[int], None]):
        self._position_listeners.append(cb)

    def remove_position_listener(self, cb: Callable[[int], None]):
        if cb in self._position_listeners:
            self._position_listeners.remove(cb)

    def add_battery_listener(self, cb: Callable[[int], None]):
        self._battery_listeners.append(cb)

    def remove_battery_listener(self, cb: Callable[[int], None]):
        if cb in self._battery_listeners:
            self._battery_listeners.remove(cb)
