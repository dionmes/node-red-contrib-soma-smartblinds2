# node-red-contrib-sonma-blinds2
NodeRed node for Soma Smart Blinds 2

# What is this node ?

This is a node for Node-Red to view the status and send commands to Soma smart blinds 2 via Bluetooth (BLE)

# Configuration

In the mac property of the node put in the mac address without colons (one longs string of hex. numbers)

# Usage

The Node will connect and receive status messages

## Commands

The input of the node accepts two type of commands.

# Bluetooth
- Compatible Bluetooth 5.0 Zephyr HCI-USB adapter (you need to add BLUETOOTH_HCI_SOCKET_USB_VID and BLUETOOTH_HCI_SOCKET_USB_PID to the process env)
- Compatible Bluetooth 4.0 USB adapter

# Running without root/sudo (Linux-specific, not always necessary).

Run the following command:  
```
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
This grants the node binary cap_net_raw privileges, so it can start/stop BLE advertising.
```   

Note: The above command requires setcap to be installed. It can be installed the following way:

- apt: sudo apt-get install libcap2-bin
- yum: su -c \'yum install libcap2-bin\'

