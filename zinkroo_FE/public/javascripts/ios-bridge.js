window.onload = function(){
	
	$('#sessionContent').hide();			

}

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

	bridge.registerHandler("connectWebSocket", function(data) {		
		connectWebSocket(data.sessionId,data.connectionId,data.role,data.username);
		//visualizzo pagina
		$('#sessionContent').show();			

	});
	
	bridge.registerHandler("leaveConference", function(data) {		
		leaveConference();
	});
	
	

	var wsConnectionObject = new Object();
	wsConnectionObject.sessionId = sessionId;
	wsConnectionObject.tokenId = token;
	wsConnectionObject.role = myRole;

	if(bridge){
		wsConnectionObject.type = 'initOTConnection';

		var myJSONText = JSON.stringify(wsConnectionObject);

		bridge.send(myJSONText);
		
	}

}, false);



