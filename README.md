# node-red-contrib-soma-blinds2
NodeRed node for Soma Smart Blinds 2

## What is this node ?

This is a node for Node-Red to control Soma smart blinds 2 via Bluetooth (BLE) directly. No bridge or additional hardware/software is necessary.

It is heavily based on the work by @andersonshatch , https://github.com/andersonshatch/soma-ctrl

The SOMA smart shade device needs to be configured with the SOMA app before connecting.

## Configuration

Scan for the devices with the scan button. Look for devices with the name S or RISE to identify the id.

## Usage

The Node will connect and receive status messages like position, battery or connection

## Commands

The Node accepts the following commmands;

- moveTo (0-100)
- moveUp
- moveDown
- stop
- getPosition
- getBattery
- identify

## Position 
The device will try to move to the exact position but will stop at approximation. Position will be correctly reported.

## Changes;
- 0.3.2, stability fixes. Better reconnect performance.
- 0.3.1, added getBattery command to instantly retrieve the current battery value
- 0.3.0, Added Charging and panel reporting.

## Bluetooth

- Compatible Bluetooth 5.0 Zephyr HCI-USB adapter (you need to add BLUETOOTH_HCI_SOCKET_USB_VID and BLUETOOTH_HCI_SOCKET_USB_PID to the process env)
- Compatible Bluetooth 4.0 USB adapter

Distance is important. Make sure the bluetooth signal is strong enough.

## Running without root/sudo (Linux-specific, not always necessary).

Run the following command:  
```
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```   
This grants the node binary cap_net_raw privileges, so it can start/stop BLE advertising.

Note: The above command requires setcap to be installed. It can be installed the following way:

- apt: sudo apt-get install libcap2-bin
- yum: su -c \'yum install libcap2-bin\'

