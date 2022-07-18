module.exports = function(RED) {

	function SmartBlindsNode(config) {
		
		const async = require('async');		
		const noble = require('@abandonware/noble');
		const SomaShade = require('./soma.js');

		RED.nodes.createNode(this,config);
	
		var node = this;
		var nobleTimerHandler;
		
		node.trace("Soma Smartblinds node started.");		
		node.mac = config.mac.toLowerCase().replace(/:/g,'');
		
		if (node.mac !== "") {
		 
		 	// Noble state
		 	noble.on('stateChange', nobleState);
		 	
		 	// Connect
			//connect();
			
		} else {
		
			node.status({fill:"grey",shape:"dot",text:"Not configured."});
			node.error("BLE mac address not configured.");
		
		}
		
		//
		// function nobleState(state)
		// Handle state change of Noble (Bluetooth lib.)
		//
		function nobleState(state) {

			node.log("Noble state change : " + state);

			if (state == "poweredOn") {

				if (this.nobleTimerHandler) clearTimeout(this.nobleTimerHandler);

				// Connect
				connect();
			
			} else {
			
				if (state !== "resetting") {
					this.nobleTimerHandler = setTimeout(() => {
						node.error("Noble Reset");
						noble.reset();		
						// Connect
						connect();
				
					}, 10*1000);
				}
							
			}
		}

		//
		// Function connect()
		// Method to connect to device
		// 
		function connect() {

			if (noble.state == "poweredOn") {
				
				node.log("Connecting");
				const msg = { topic: "connection", payload: { "connection" : "connecting" } };
				node.send(msg);

				node.status({fill:"blue",shape:"ring",text: "Start scanning for : " + node.mac});

				noble.startScanning();

				noble.on('discover', function (peripheral) {
												
					if (peripheral.id == node.mac) {
	
						noble.stopScanning();

						node.status({ fill:"blue",shape:"dot",text: "Found : " + peripheral.id });

						const somaDevice = new SomaShade(peripheral.id, peripheral, noble);		

						// Register node close event
						node.on('close', function() {
				
							if (peripheral) {
								node.status({ fill:"red",shape:"dot",text: "Disconnecting for stopping node."});
								peripheral.disconnect();
							}
				
						});
						
						// Connection error
						somaDevice.on("error", error => {
							nobleState("somaDevice error.");
						});
		
						// Register device batteryLevelChanged event
						somaDevice.on('batteryLevelChanged', data => {
							const msg = { topic: "battery", payload: { "battery" : data.battery } };
							node.send(msg);
						});

						// Register device positionChanged event
						somaDevice.on('positionChanged', data => {
							const msg = { topic: "position", payload: { "position" : data.position } };
							node.send(msg);
						});

						// Register device connectionStateChanged event
						somaDevice.on('connectionStateChanged', data => {
					
							const msg = { topic: "connection", payload: {"connection" : data.connectionState } };
							node.send(msg);

							if (data.connectionState  == "connected") {
								node.status({fill:"green",shape:"dot",text: "Connected"});
							} else {
								node.status({fill:"red",shape:"dot",text: data.connectionState });
							}
							
						});

						// Connect to device
						node.status({ fill:"blue",shape:"dot",text: "Trying to connect."});
						
						somaDevice.connect();
					
						// Register node input events
						node.on('input', (msg, send, done) => {
			
							// Handle command
							receiveCommand(node, send, msg, somaDevice);
						
							if (done) { done(); }

						});

					}
  
				});
			}

		}
		
		//
		// function receiveCommand(node, msg)
		// Handle commands received on node input.
		//
		function receiveCommand(node, send, msg, somaDevice) {

			if (somaDevice) {

				try {
					var commandstring = msg.payload.toString().toLowerCase();
				} catch(error) {
					node.error("Command not recognized. ");
					return;	
				}

				const commandArray = commandstring.split(' ');

				//Handle command
				switch (commandArray[0]) {
				  case 'moveto':
				  	
				  	try {
				  		const move_to_postion = parseInt(commandArray[1]);
						somaDevice.move(move_to_postion);

					} catch(error) {
						node.error("Position not recognized. ");
						return;	
					}
				  		
					break;

				  case 'getposition':
				  	somaDevice.getPosition();
				  	break;

				  case 'moveup':
				  	somaDevice.moveUp();
				  	break;
				  
				  case 'movedown':
				  	somaDevice.moveDown();
				  	break;
				  
				  case 'stop':
				  	somaDevice.stop();
				  	break;
				  
				  default:
				  	node.error("Command not understood. ");
				}
				
				return;
				
			}

    	}
    
    }
    
    RED.nodes.registerType("soma-smartblinds2",SmartBlindsNode);
    
}
