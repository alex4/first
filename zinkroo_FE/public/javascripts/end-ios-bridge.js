var bridge;

////////////////////////
//	IOS-JS BRIDGE
////////////////////////
document.addEventListener('WebViewJavascriptBridgeReady', function onBridgeReady(event) {
    bridge = event.bridge;
    bridge.init(function(message, response) {
        alert('Received message: ' + message)   
        if (response) {
/*             response.respondWith("Right back atcha") */
            // or use response.respondWithError("Booh!")
        }
    });
	

	var wsConnectionObject = new Object();

	if(bridge){
		wsConnectionObject.type = 'sessionEnded';
		wsConnectionObject.message = message;

		var myJSONText = JSON.stringify(wsConnectionObject);

		bridge.send(myJSONText);
		
	}

}, false);





