"""Config flow for Soma SmartBlinds 2 integration."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import DEFAULT_NAME

DOMAIN = "soma_smartblinds2"


class SomaSmartBlindsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}

        # initial screen: choose to scan or enter manually
        if user_input is None:
            schema = vol.Schema({
                vol.Required("mode", default="scan"): vol.In(["scan", "manual"]),
            })
            return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

        mode = user_input.get("mode")
        if mode == "scan":
            return await self.async_step_scan()

        # manual path
        if mode == "manual":
            # proceed to manual entry form
            schema = vol.Schema({
                vol.Required("bt_address"): str,
                vol.Optional("name", default=DEFAULT_NAME): str,
                vol.Optional("scan_timeout", default=10.0): vol.Coerce(float),
                vol.Optional("reconnect_wait", default=3.0): vol.Coerce(float),
                vol.Optional("enable_notifications", default=True): bool,
                vol.Optional("poll_interval", default=1.0): vol.Coerce(float),
            })
            return self.async_show_form(step_id="manual", data_schema=schema, errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return SomaSmartBlindsOptionsFlow(config_entry)

    async def async_step_scan(self, user_input=None):
        """Discover nearby BLE devices and allow selection."""
        from bleak import BleakScanner

        # perform discovery
        devices = await BleakScanner.discover(timeout=5.0)
        options = {}
        for d in devices:
            if not d:
                continue
            display = f"{(d.name or 'Unknown')} [{d.address}]"
            options[display] = d.address

        if not options:
            return self.async_show_form(step_id="scan", data_schema=vol.Schema({}), errors={"base": "no_devices"})

        schema = vol.Schema({
            vol.Required("device_choice"): vol.In(list(options.keys())),
            vol.Optional("name", default=DEFAULT_NAME): str,
            vol.Optional("scan_timeout", default=10.0): vol.Coerce(float),
            vol.Optional("reconnect_wait", default=3.0): vol.Coerce(float),
            vol.Optional("enable_notifications", default=True): bool,
            vol.Optional("poll_interval", default=1.0): vol.Coerce(float),
        })

        if user_input is None:
            return self.async_show_form(step_id="scan", data_schema=schema, errors={})

        # user selected device
        selected = options.get(user_input.get("device_choice"))
        if not selected:
            return self.async_abort(reason="unknown_device")

        options_data = {
            "scan_timeout": float(user_input.get("scan_timeout", 10.0)),
            "reconnect_wait": float(user_input.get("reconnect_wait", 3.0)),
            "enable_notifications": bool(user_input.get("enable_notifications", True)),
            "poll_interval": float(user_input.get("poll_interval", 1.0)),
        }

        return self.async_create_entry(
            title=user_input.get("name", DEFAULT_NAME),
            data={"bt_address": selected},
            options=options_data,
        )

    async def async_step_manual(self, user_input=None):
        """Handle manual form submission to create an entry."""
        if user_input is None:
            schema = vol.Schema({
                vol.Required("bt_address"): str,
                vol.Optional("name", default=DEFAULT_NAME): str,
                vol.Optional("scan_timeout", default=10.0): vol.Coerce(float),
                vol.Optional("reconnect_wait", default=3.0): vol.Coerce(float),
                vol.Optional("enable_notifications", default=True): bool,
                vol.Optional("poll_interval", default=1.0): vol.Coerce(float),
            })
            return self.async_show_form(step_id="manual", data_schema=schema, errors={})

        options = {
            "scan_timeout": float(user_input.get("scan_timeout", 10.0)),
            "reconnect_wait": float(user_input.get("reconnect_wait", 3.0)),
            "enable_notifications": bool(user_input.get("enable_notifications", True)),
            "poll_interval": float(user_input.get("poll_interval", 1.0)),
        }

        return self.async_create_entry(
            title=user_input.get("name", DEFAULT_NAME),
            data={"bt_address": user_input.get("bt_address")},
            options=options,
        )


class SomaSmartBlindsOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        # Do not set attribute named `config_entry` (deprecated). Store privately.
        self._config_entry = config_entry

    async def async_step_init(self, user_input=None):
        errors = {}

        current = self._config_entry.options or {}

        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        schema = vol.Schema({
            vol.Optional("scan_timeout", default=current.get("scan_timeout", 10.0)): vol.Coerce(float),
            vol.Optional("reconnect_wait", default=current.get("reconnect_wait", 3.0)): vol.Coerce(float),
            vol.Optional("enable_notifications", default=current.get("enable_notifications", True)): bool,
            vol.Optional("poll_interval", default=current.get("poll_interval", 1.0)): vol.Coerce(float),
        })

        return self.async_show_form(step_id="init", data_schema=schema, errors=errors)

    async def async_step_scan(self, user_input=None):
        """Discover nearby BLE devices and allow selection."""
        from bleak import BleakScanner

        # perform discovery
        devices = await BleakScanner.discover(timeout=5.0)
        options = {}
        for d in devices:
            if not d:
                continue
            display = f"{(d.name or 'Unknown')} [{d.address}]"
            options[display] = d.address

        if not options:
            return self.async_show_form(step_id="scan", data_schema=vol.Schema({}), errors={"base": "no_devices"})

        schema = vol.Schema({vol.Required("device_choice"): vol.In(list(options.keys())),
                             vol.Optional("name", default=DEFAULT_NAME): str,
                             vol.Optional("scan_timeout", default=10.0): vol.Coerce(float),
                             vol.Optional("reconnect_wait", default=3.0): vol.Coerce(float),
                             vol.Optional("enable_notifications", default=True): bool,
                             vol.Optional("poll_interval", default=1.0): vol.Coerce(float),
                            })

        if user_input is None:
            return self.async_show_form(step_id="scan", data_schema=schema, errors={})

        # user selected device
        selected = options.get(user_input.get("device_choice"))
        if not selected:
            return self.async_abort(reason="unknown_device")

        options_data = {
            "scan_timeout": float(user_input.get("scan_timeout", 10.0)),
            "reconnect_wait": float(user_input.get("reconnect_wait", 3.0)),
            "enable_notifications": bool(user_input.get("enable_notifications", True)),
            "poll_interval": float(user_input.get("poll_interval", 1.0)),
        }

        return self.async_create_entry(
            title=user_input.get("name", DEFAULT_NAME),
            data={"bt_address": selected},
            options=options_data,
        )

