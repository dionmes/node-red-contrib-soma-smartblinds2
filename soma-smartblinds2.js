module.exports = function(RED) {

	function SmartBlindsNode(config) {

		const noble = require('@abandonware/noble');

		RED.nodes.createNode(this,config);

		var node = this;

		var editorDeviceList = [];
		var editorScan = false;

		const positionCharUUID = '00001525b87f490c92cb11ba5ea5167c';
		const movePercentUUID = '00001526b87f490c92cb11ba5ea5167c';
		const motorCharUUID = '00001530b87f490c92cb11ba5ea5167c';
		const groupUUID = '00001893b87f490c92cb11ba5ea5167c';
		const nameUUID = '00001892b87f490c92cb11ba5ea5167c';
		const battPercentUUID = '2a19';
		const notifyUUID = '00001531b87f490c92cb11ba5ea5167c';
		const calibrateCharUUID = '00001529b87f490c92cb11ba5ea5167c';
		const chargingCharUUID = '00001894b87f490c92cb11ba5ea5167c';
		const configCharUUID = '00001896b87f490c92cb11ba5ea5167c';
		const reconnect_wait = 3;

		var somaDevice = null;
		var somaDeviceDisconnectHandler;
		var reconnect = true;
		var connected = false;

		var movePercentCharacteristic;
		var positionCharacteristic;
		var motorCharacteristic;
		var battPercentCharacteristic;
		var identifyCharacteristic;
		var chargingCharacteristic;
		var configCharacteristic;
		var battPercentCharacteristic;

		var btId = config.btId.toLowerCase().replace(/:/g,'');
		
		node.log("Soma Smartblinds node started. " + btId);

		// Register node close event
		this.on('close', function(removed, done) {

			node.log("Node stop init.");
			node.status({ fill:"grey",shape:"ring",text: ""});
			noble.stopScanning();

			if (somaDevice) {

				reconnect = false;

				somaDevice.disconnect((error) => {
					noble.removeAllListeners('discover');
					noble.removeAllListeners('stateChange');
					done();
				});
	
			} else {
	
				noble.removeAllListeners('discover');
				noble.removeAllListeners('stateChange');
				done();
	
			}

		});

		// Register input events
		this.on('input', (msg, send, done) => {
			// Handle command
			receiveCommand(msg);

			// Node red done
			if (done) { done(); }
		});

		// Discovered device event
		noble.on('discover', function (peripheral) {

			if (peripheral.id == btId && ! connected ) {

				connected = true;
				noble.stopScanning();

				node.log("Device found : " + btId);

				connectToSomaDevice(peripheral);

			}

		});

		if (btId == "") {

			node.status({fill:"grey",shape:"dot",text:"Not configured"});
			node.error("ID not configured.");

		} else {
			// noble statechange event
			noble.on('stateChange', nobleState);

			// Manual init event (needed for redeploy)
			nobleState(noble.state);

		} 

		//
		// function nobleState(state)
		// Handle state change of noble (Bluetooth lib.)
		//
		function nobleState(state) {

			if (state == "poweredOn") {

				node.status({fill:"blue",shape:"ring",text: "Start scanning" });
				node.send({ topic: "connection", payload: { "connection" : "scanning" } });

				noble.startScanning();

			}
		}

		//
		// function connectToSomaDevice()
		// Connect to found Soma Peripheral
		//
		function connectToSomaDevice(peripheral) {

			node.status({ fill:"blue",shape:"dot",text: "Connecting"});
			node.send({ topic: "connection", payload: { "connection" : "connecting" } });

			peripheral.connect((error) => {

				if (error) {

					node.error("Connection error - reconnecting");

					peripheral.disconnect();
					connected = false;

					node.status({ fill:"red",shape:"dot",text: "Error - Reconnecting"});

					somaDeviceDisconnectHandler = setTimeout(() => {

						noble.startScanning();
						return;

					}, reconnect_wait * 1000);

					return;

				} else {

					reconnect = true;

					// Clear timers
					if (somaDeviceDisconnectHandler)  { clearTimeout(somaDeviceDisconnectHandler); }

					peripheral.once('disconnect', (error) => {

						connected = false;

						node.log("Disconnected : " + error + " - reconnecting");

						node.status({ fill:"red",shape:"dot",text: "Reconnecting" });
						node.send({ topic: "connection", payload: { "connection" : "reconnecting" } });

						if (reconnect) { 
							somaDeviceDisconnectHandler = setTimeout(() => {

								noble.startScanning();
								return;

							}, reconnect_wait * 1000);
						}
					});	

					node.status({ fill:"blue",shape:"dot",text: "Connecting"});
					node.send({ topic: "connection", payload: { "connection" : "connecting"} });

					let expectedCharUuids = [positionCharUUID, movePercentUUID, motorCharUUID, battPercentUUID, groupUUID, nameUUID, notifyUUID, calibrateCharUUID, chargingCharUUID, configCharUUID];

					// Characteristics subscribe
					peripheral.discoverSomeServicesAndCharacteristics([], expectedCharUuids, (error, services, characteristics) => {

						let discoveredUuids = characteristics.map((char) => char.uuid);
						let missingCharacteristics = expectedCharUuids.filter((char) => !discoveredUuids.includes(char));

						if (missingCharacteristics.length !== 0) {
							node.status({ fill:"red",shape:"dot",text: "Device not recognized error"});
							node.error("Device not recognized error");

							peripheral.disconnect();

							return;
						}

						//	Not implementing speed changes at this moment due to unexpected results.
						/**
						configCharacteristic = characteristics.filter(char => char.uuid === configCharUUID)[0];
						configCharacteristic.subscribe();

						configCharacteristic.on('data', (data) => {

							if (data[1] == 3) {

								const bytes_speed = data.subarray(4,5);
								const speed = bytes_speed.readIntLE(0, Buffer.byteLength(bytes_speed));

								node.send({ topic: "speed", payload: { "speed" : speed} });

							} else {
								node.send({ topic: "config", payload: { "data" : data} });
							}

						});

						configCharacteristic.read();
						**/

						chargingCharacteristic = characteristics.filter(char => char.uuid === chargingCharUUID)[0];
					
						chargingCharacteristic.on('data', (data) => {

							const bytes_charging = data.subarray(0,2);
							const charging = bytes_charging.readIntLE(0, Buffer.byteLength(bytes_charging));

							const bytes_panel = data.subarray(2,4);
							const panel = bytes_panel.readIntLE(0, Buffer.byteLength(bytes_panel));

							node.send({ topic: "charging", payload: { "charging" : charging, "panel" : panel} });

						});

						chargingCharacteristic.subscribe();

						positionCharacteristic = characteristics.filter(char => char.uuid === positionCharUUID)[0];

						positionCharacteristic.on('data', (data) => {
							const position = 100 - data[0];
							node.send({ topic: "position", payload: { "position" : position} });
						});

						positionCharacteristic.subscribe();
						positionCharacteristic.read();

						battPercentCharacteristic = characteristics.filter(char => char.uuid === battPercentUUID)[0];

						battPercentCharacteristic.on('data', (data) => {
							let reading = data[0];
							const batt = Math.min(100, reading / 75 * 100).toFixed(0);
							const battery = parseInt(batt);
							node.send({ topic: "battery", payload: { "battery" : battery} });
						});

						battPercentCharacteristic.subscribe();
						battPercentCharacteristic.read();

						identifyCharacteristic = characteristics.filter(char => char.uuid === notifyUUID)[0];
						movePercentCharacteristic = characteristics.filter(char => char.uuid === movePercentUUID)[0];
						motorCharacteristic = characteristics.filter(char => char.uuid === motorCharUUID)[0];

						node.log("Connected : " + btId);

						// Reference for disconnect during node shutdown.
						somaDevice = peripheral;

						node.status({ fill:"green",shape:"dot",text: "connected"});
						node.send({ topic: "connection", payload: { "connection" : "connected"} });

					});
				}
				
			});
		
		}

		//
		// function receiveCommand(node, msg)
		// Handle commands received on node input.
		//
		function receiveCommand(msg) {

			if (somaDevice !== null) {

				var commandstring;

				try {
					commandstring = msg.payload.toString().toLowerCase();
				} catch(error) {
					node.error("Command not recognized.");
					return; 
				}

				const commandArray = commandstring.split(' ');

				//Handle command
				switch (commandArray[0]) {
				  case 'moveto':
						if (movePercentCharacteristic !== undefined ) {
							var move_to_postion;

							try {
								move_to_postion = parseInt(commandArray[1]);
							} catch(error) {
								node.error("Position not recognized.");
								return; 
							}

							if (move_to_postion < 0 || move_to_postion > 100) {
								node.error("Position outside boundaries.");
								return;
							}

							var movePercent = 100 - move_to_postion;
							var movePercentString = movePercent.toString();

							if (movePercentCharacteristic == null) {
								return;
							}

							movePercentCharacteristic.write(Buffer.from([movePercentString.toString(16)]), false, function(error) {
								if (error) { node.log(error); }
							});
						} else {

						}

						break;

				  case 'moveup':
						motorCharacteristic.write(Buffer.from([0x69]), false, (error) => {
							if (error) { node.log(error); }
						});
						break;

				  case 'movedown':
						motorCharacteristic.write(Buffer.from([0x96]), true, (error) => {
							if (error) { node.log(error); }
						});
						break;

				  case 'stop':
						motorCharacteristic.write(Buffer.from([0]), false, (error) => {
							if (error) { node.log(error); }
							positionCharacteristic.read();
						});
						break;

				  case 'getposition':
						positionCharacteristic.read();
						break;

				  case 'getbattery':
						battPercentCharacteristic.read();
						break;

				  case 'identify':
						identifyCharacteristic.write(Buffer.from([1]));
						break;

				// Not implementing speed changes at this moment due to unexpected results.
				/**
				  case 'getconfig':
						configCharacteristic.read();
						break;

				  case 'getspeed':
						configCharacteristic.write(Buffer.from([255,1,1]));
						break;

				  case 'setspeed':

						var speed;
						try {
							speed = parseInt(commandArray[1]);
						} catch(error) {
							node.error("Speed not recognized.");
							return; 
						}

						if (speed < 0 || speed > 100) {
							node.error("Speed outside boundaries.");
							return;
						}

						const buf = Buffer.allocUnsafe(3);
						buf.writeInt8(1,0);
						buf.writeInt8(1,1);
						buf.writeInt8(speed,2);

						configCharacteristic.write(buf);

						break;
				**/
				  default:
						node.error("Command not understood. ");
				}

				return;

			} else {
				node.error("Cannot process command as not connected.");
			}
		}

		/** functions to communicate with node editor **/

		// Request to Start scanning
		RED.httpAdmin.get("/smartblinds-bluetooth-scan-start", RED.auth.needsPermission('SmartBlindsNode.read'), function(req,res) {

			editorDeviceList = [];
			editorScan = true;
			noble.startScanning();

			noble.on('discover', function (peripheral) {
				editorDeviceList.push({ "name" : peripheral.advertisement.localName, "id" : peripheral.id });
			});

			setTimeout(() => { 
				noble.stopScanning(); 
				editorScan = false;
			}, 60*1000);

			res.json({"editorScan" : editorScan});

		});

		// Request to Stop scanning
		RED.httpAdmin.get("/smartblinds-bluetooth-scan-stop", RED.auth.needsPermission('SmartBlindsNode.read'), function(req,res) {
			noble.removeAllListeners('discover');
			noble.stopScanning();
			editorScan = false;
			res.json({"editorScan" : editorScan});
		});

		// Found devices list
		RED.httpAdmin.get("/smartblinds-bluetooth-list", RED.auth.needsPermission('SmartBlindsNode.read'), function(req,res) {

			var data = {};
			data.editorScan = editorScan;
			data.devices = editorDeviceList;
			res.json(data);

		});

	}

	RED.nodes.registerType("soma-smartblinds2",SmartBlindsNode);

}