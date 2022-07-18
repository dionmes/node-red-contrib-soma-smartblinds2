module.exports = function(RED) {

	function SmartBlindsNode(config) {
		
		const async = require('async');
		const noble = require('@abandonware/noble');
		const SomaShade = require('./soma.js');
		const EventEmitter = require('events');

		const positionCharUUID = '00001525b87f490c92cb11ba5ea5167c';
		const movePercentUUID = '00001526b87f490c92cb11ba5ea5167c';
		const motorCharUUID = '00001530b87f490c92cb11ba5ea5167c';
		const groupUUID = '00001893b87f490c92cb11ba5ea5167c';
		const nameUUID = '00001892b87f490c92cb11ba5ea5167c';
		const battPercentUUID = '2a19';
		const notifyUUID = '00001531b87f490c92cb11ba5ea5167c';

		const calibrateCharUUID = '00001529b87f490c92cb11ba5ea5167c';

		RED.nodes.createNode(this,config);

		var somaDevice;
			
		var node = this;
		
		node.trace("Soma Smartblinds node started.");
		
		node.mac = config.mac.toLowerCase().replace(/:/g,'');
		
		if (node.mac !== "") {
		 
		 	// Start Bluetooth
			start_bluetooth();
			
		} else {
		
			node.status({fill:"grey",shape:"dot",text:"Not configured."});
			node.error("BLE mac address not configured.");
		
		}
		
		function start_bluetooth() {
		
			node.status({fill:"blue",shape:"ring",text: "Start scanning for : " + node.mac});

			noble.startScanning();

			noble.on('discover', function (peripheral) {
												
				if (peripheral.id == node.mac) {
	
					noble.stopScanning();

					node.status({ fill:"blue",shape:"dot",text: "Found : " + peripheral.id });

					somaDevice = peripheral;
								
					// Register node close event
					node.on('close', function() {
				
						if (somaDevice) {
							somaDevice.disconnect();
						}
				
					});		
				}
			});
			
		}
	   
	RED.nodes.registerType("soma-smartblinds2",SmartBlindsNode);

}