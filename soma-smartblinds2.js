module.exports = function(RED) {

	function SmartBlindsNode(config) {
		
		const bt_noble = require('@abandonware/noble');

		RED.nodes.createNode(this,config);

		var node = this;
		
		const positionCharUUID = '00001525b87f490c92cb11ba5ea5167c';
		const movePercentUUID = '00001526b87f490c92cb11ba5ea5167c';
		const motorCharUUID = '00001530b87f490c92cb11ba5ea5167c';
		const groupUUID = '00001893b87f490c92cb11ba5ea5167c';
		const nameUUID = '00001892b87f490c92cb11ba5ea5167c';
		const battPercentUUID = '2a19';
		const notifyUUID = '00001531b87f490c92cb11ba5ea5167c';
		const calibrateCharUUID = '00001529b87f490c92cb11ba5ea5167c';

		var somaDevice;
		var bt_noble_disconnectHandler;
		var peripheral_disconnectHandler;
		var position;
		var battery;
		var movePercentCharacteristic;
		var motorCharacteristic;
		var positionCharacteristic;
		var battPercentCharacteristic;
		
		node.id = config.id.toLowerCase().replace(/:/g,'');

		node.trace("Soma Smartblinds node started.");
				
		// Register node close event
		node.on('close', function(done) {

			if (somaDevice) {
				somaDevice.disconnect();
			}
			
			// Node red done
			if (done) { done(); }
			
		});		

		// Register input events
		node.on('input', (msg, send, done) => {
			// Handle command
			receiveCommand(node,send,msg);

			// Node red done
			if (done) { done(); }
		});

		// Discovered device event
		bt_noble.on('discover', function (peripheral) {
			
			if (peripheral.id == node.id) {
				
				node.log("ID found.");
				bt_noble.stopScanning();
				node.log("Stopped scanning");
				node.somaDevice = peripheral;
				connect_to_somaDevice();
				
			}
			
		});
				
		// bt_noble statechange event
		bt_noble.on('stateChange', bt_nobleState);

		if (node.id == "") {
		
			node.status({fill:"grey",shape:"dot",text:"Not configured"});
			node.error("BLE mac address not configured.");
		
		}
		
		//
		// function bt_nobleState(state)
		// Handle state change of bt_noble (Bluetooth lib.)
		//
		function bt_nobleState(state) {

			node.log("BT Noble state : " + state);

			if (state == "poweredOn") {

				if (node.bt_noble_disconnectHandler) { clearTimeout(node.bt_noble_disconnectHandler)};
				
				node.status({fill:"blue",shape:"ring",text: "Start scanning" });
				node.send({ topic: "connection", payload: { "connection" : "scanning" } });
				
				node.log("Noble starts scanning.");

				bt_noble.startScanning();
			
			} else {
			
				if (state !== "resetting") {
					
					node.status({fill:"red",shape:"ring",text: "Bluetooth reset"});
					node.error("BT Noble Reset");
					
					node.bt_noble_disconnectHandler = setTimeout(() => {
						bt_noble.reset();		
					}, 7*1000);
				}
							
			}
		}

		//
		// function receiveCommand(node, msg)
		// Handle commands received on node input.
		//
		function receiveCommand(node, send, msg) {

			if (node.somaDevice) {

				try {
					var commandstring = msg.payload.toString().toLowerCase();
				} catch(error) {
					node.error("Command not recognized.");
					return;	
				}

				const commandArray = commandstring.split(' ');

				//Handle command
				switch (commandArray[0]) {
				  case 'moveto':
						var move_to_postion;  	
						try {
							move_to_postion = parseInt(commandArray[1]);
						} catch(error) {
							node.error("Position not recognized.");
							return;	
						}

						var movePercent = 100 - move_to_postion;
						var movePercentString = movePercent.toString();

						if (node.movePercentCharacteristic == null) {
							return;
						}

						node.movePercentCharacteristic.write(Buffer.from([movePercentString.toString(16)]), false, function(error) {
							if (error) { node.log(error); }
						});
	
						break;

				  case 'moveup':
						node.motorCharacteristic.write(Buffer.from([0x69]), false, (error) => {
							if (error) { node.log(error); }
						});
						break;
				  
				  case 'movedown':
						node.motorCharacteristic.write(Buffer.from([0x96]), true, (error) => {
							if (error) { node.log(error); }
						});
					  	break;
				  
				  case 'stop':
						node.motorCharacteristic.write(Buffer.from([0]), false, (error) => {
							if (error) { node.log(error); }
							node.positionCharacteristic.read();
						});
					  	break;
				  
				  case 'getposition':
						node.positionCharacteristic.read();
						break;

				  default:
					  	node.error("Command not understood. ");
				}
				
				return;
				
			}

    	}

		//
		// function connect_to_somaDevice()
		// Connect to found Soma Peripheral
		//
		function connect_to_somaDevice() {
	
			node.status({ fill:"blue",shape:"dot",text: "Connecting"});
			node.send({ topic: "connection", payload: { "connection" : "connecting" } });
			
			node.somaDevice.once('disconnect', () => {
	
				node.status({ fill:"red",shape:"dot",text: "Disconnected" });
				node.send({ topic: "connection", payload: { "connection" : "disconnected" } });
				node.log("disconnect");
				
				node.peripheral_disconnectHandler = setTimeout(() => {
		
					connect_to_somaDevice();
			
				}, 10*1000);
		
			});
		
			node.somaDevice.connect((error) => {
				
				if (error) {
					
					node.log("connect error");
					node.somaDevice.disconnect();
					
					node.status({ fill:"red",shape:"dot",text: "Error connecting (Reconnecting)"});
					node.error("Connecting error (Reconnecting) : " + error);

					node.peripheral_disconnectHandler = setTimeout(() => {
						connect_to_somaDevice();
					}, 10*1000);
		
					return;
				}
		
				// Clear timers
				if (node.peripheral_disconnectHandler) clearTimeout(node.peripheral_disconnectHandler);
				if (node.bt_noble_disconnectHandler) clearTimeout(node.bt_noble_disconnectHandler);

				node.status({ fill:"green",shape:"dot",text: "connected"});
				node.send({ topic: "connection", payload: { "connection" : "connected"} });
				node.log("Connected");

				let expectedCharUuids = [positionCharUUID, movePercentUUID, motorCharUUID, battPercentUUID, groupUUID, nameUUID, notifyUUID, calibrateCharUUID];				
				
				// Characteristics subscribe
				node.somaDevice.discoverSomeServicesAndCharacteristics([], expectedCharUuids, (error, services, characteristics) => {

					let discoveredUuids = characteristics.map((char) => char.uuid);
					let missingCharacteristics = expectedCharUuids.filter((char) => !discoveredUuids.includes(char));

					if (missingCharacteristics.length !== 0) {
						node.error('Missing characteristics: %o', missingCharacteristics);
						node.somaDevice.disconnect();
						
						// Needs retry from scanning
						return;
					}
					
					node.positionCharacteristic = characteristics.filter(char => char.uuid === positionCharUUID)[0];
					node.positionCharacteristic.subscribe();
					
					node.positionCharacteristic.on('data', (data) => {
						node.position = 100 - data[0];
						node.send({ topic: "position", payload: { "position" : node.position} });
					});
					
					node.positionCharacteristic.read();

					node.battPercentCharacteristic = characteristics.filter(char => char.uuid === battPercentUUID)[0];
					node.battPercentCharacteristic.subscribe();
					
					node.battPercentCharacteristic.on('data', (data) => {
						let reading = data[0];
						var batt = Math.min(100, reading / 75 * 100).toFixed(0);
						node.battery = parseInt(batt);
						node.send({ topic: "battery", payload: { "battery" : node.battery} });
					});
					
					node.battPercentCharacteristic.read();

					node.movePercentCharacteristic = characteristics.filter(char => char.uuid === movePercentUUID)[0];
					node.motorCharacteristic = characteristics.filter(char => char.uuid === motorCharUUID)[0];
					
				});
				
			});
		}

	}
	
	RED.nodes.registerType("soma-smartblinds2",SmartBlindsNode);

}