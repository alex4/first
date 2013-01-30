//var CONNECTION_TIME_TIMEOUT = 5000; // 5000 milliseconds = 5 seconds 

var webinartype = 'Conference';

//connessioni di cui ho ricevuto connectionCreated ma che non sono state ancora considerate perche' la connessione dell'utente loggato (quello che sta caricando questa pagina) non era ancora stata creata.
var pendingConnections = new Array();
var pendingStreams = new Array();
//id connessioni memorizzate solo dal moderator per disconnessioni finali
var connectionsId = new Array();

var subscribers = {};

var session;

window.onload = function(){

	initHtml();

  session = TB.initSession(sessionId); // Sample session ID. 
	
	// Add event listeners to the session
	session.addEventListener('sessionConnected', sessionConnectedHandler);
	session.addEventListener('sessionDisconnected', sessionDisconnectedHandler);
	session.addEventListener('connectionCreated', connectionCreatedHandler);
	session.addEventListener('connectionDestroyed', connectionDestroyedHandler);
	session.addEventListener('streamCreated', streamCreatedHandler);
	session.addEventListener('streamDestroyed', streamDestroyedHandler);

	var sessionConnectProperties = {detectConnectionQuality:1};
	session.connect(apikey, token, sessionConnectProperties);


	$('#resizeSmall').hide();			
	$('#resizeFull').show();			
	
	//comportamento colonna 1
	$('#column1').mouseenter(function() {
		if(myRole == ROLE_MODERATOR || hasSlideControl){
			$('#slide-controller').show('slow');		
		}
		
		$('.resize').css('display','block');
	});
	$('#column1').mouseleave(function() {
		$('#slide-controller').hide('fast');
		$('.resize').css('display','none');
	});

}

function noBack() { 
	window.history.forward();
}

function initHtml(){
	
	noBack();
	
	$('#loading').show();
	
	$('#navbar').hide();
	$('#sessionContent').hide();

	if((myRole != ROLE_MODERATOR) && (myRole != ROLE_PUBLISHER)) {		
		$('#btn-live').remove();
		$('#slide-controller').remove();
	}

	if(myRole != ROLE_MODERATOR) {
		$("#nav-tab-tools").remove();
		$("#add-new-doc").remove();
		$("#conference-settings").remove();
	}
	
	if(myRole == ROLE_PUBLISHER) {
		$("#resize-div").hide();
		$("#slide-controller").hide();
	}	

}


	function disconnect(forced) {
		////////////////////////////////
		// gestione bottoni
		$('#publishLink-divider').hide();
		$('#publishLink').hide();
		$('#unpublishLink-divider').hide();
		$("#unpublishLink").hide();
		$('#disconnectLink-divider').hide();
		$('#disconnectLink').hide();
		////////////////////////////////
		stopPublishing();
		
		if(!forced){
			leaveConference();
		}
					
		//disconnette tutti gli altri utenti
   	if(myRole == ROLE_MODERATOR) {
	 		for(var i = 0; i < connectionsId.length; i++){
	   		session.forceDisconnect(connectionsId[i]);
	 		}
 		}

		session.disconnect();

	}
	
	
		// Called when user wants to start publishing to the session
	function startPublishing() {
		////////////////////////////////
		// gestione bottoni
		$('#publishLink-divider').hide();
		$('#publishLink').hide();
		$('#unpublishLink-divider').hide();
		$("#unpublishLink").hide();
		////////////////////////////////
		//se non e' ancora stato settata la variabile publisher
		if (!publisher) {
			$("#myCameraPlaceholder").hide();
			
			var publisherDiv = document.createElement('div'); // Create a div for the publisher to replace
			publisherDiv.setAttribute('id', 'opentok_publisher');
			$("#myCamera").append(publisherDiv);
			

			var newStyle = {
        showMicButton: false,
        showSettingsButton: false,
        showCameraToggleButton: false
	    }
			var publisherProperties = {style:newStyle};

			publisher = TB.initPublisher(apikey, publisherDiv.id, publisherProperties);  // Pass the replacement div id

			session.publish(publisher);
			
			if(audioEnabled){
				publisher.publishAudio(true);
			}else{
				publisher.publishAudio(false);
			}
			
			//aggiunge controlli volume
			var micControl = '<i class="icon-minus-sign" onclick="changeMicVol(-25)"> </i> <img id="volShow" scr=""/> <i class="icon-plus-sign" onclick="changeMicVol(+25);" > </i>'
			$('#vol-microfono').html(micControl);

			showMicVol();
		}
	}
	
	function stopPublishing() {
		////////////////////////////////
		// gestione bottoni
		/* $('#publishLink').hide(); */
		$('#unpublishLink-divider').hide();
		$("#unpublishLink").hide();
		////////////////////////////////

		if (publisher) {
			//rimuove controlli volume
			$('#micVol').remove();
			session.unpublish(publisher);
			$("#myCameraPlaceholder").show(); 
		}
		publisher = null;

	}
	
	
	//--------------------------------------
	//  OPENTOK EVENT HANDLERS
	//--------------------------------------

	function sessionConnectedHandler(event) {
		//mi sono connesso
		
		//timeoutVar = setTimeout("loop()", CONNECTION_TIME_TIMEOUT);
		
		////////////////////////////////
		// gestione bottoni
 		if((myRole == ROLE_MODERATOR) || (myRole == ROLE_PUBLISHER)) {

 			if(webinartype == 'Conference'){
 				//aggiungo mio placeholder
 				//aggiungere a id=myCamera lo style padding-bottom: 75% !important; oppure togliere padding
 				$("#my-connection").append('<li id="myCamera" class="user-list truncate grey" style="margin-bottom: 1%; overflow: hidden; border: none;"> <img id="myCameraPlaceholder" src="images/img-video-tutor.jpg" style="width: 100%;" /></li>');
 				if(myRole == ROLE_MODERATOR){
   				$("#myCamera").addClass('moderator');
 				}
 			}


 			$("#myCameraPlaceholder").show();
 			
 			$('#publishLink-divider').show();
 			$('#publishLink').show();
 			$('#unpublishLink-divider').hide();
 			$("#unpublishLink").hide();
 		}else{
      $("#myCamera").remove();
 			$("#subscribersPlaceholder").show();
 		}
 			
 		$('#disconnectLink-divider').show();
 		$('#disconnectLink').show();
 		
 		$(".buttons-live").show();
 		////////////////////////////////
   		
   	//aggiunge paramerti connessione nella toolbar
		$("#uploadSpeed").attr('data-original-title','Upload: '+event.target.connection.quality.upBandwidth+' kbps');
    $("#uploadSpeed").html('<i class="icon-upload"></i>');
		$("#downloadSpeed").attr('data-original-title','Download: '+event.target.connection.quality.downBandwidth+' kbps');
    $("#downloadSpeed").html('<i class="icon-download"></i>');
		$("#latency").attr('data-original-title','Latency: '+event.target.connection.quality.latency+'ms');
    $("#latency").html('<i class="icon-signal"></i>');
       	
					
		// aggiunge connessioni gia' in Session
		for (i = 0; i < event.connections.length; i++) {
			addConnection(event.connections[i]);
		}
		// Subscribe to all streams currently in the Session
		for (var i = 0; i < event.streams.length; i++) {
			addStream(event.streams[i]);
		}

		//aggiungo eventuali connessioni di altri utenti non ancora registrate in sessione
		for (var i = 0; i < pendingConnections.length; i++) {
			addConnection(pendingConnections[i]);
		}
		pendingConnections.length = 0;
		//aggiungo eventuali streams di altri utenti non ancora in sessione
		for (var i = 0; i < pendingStreams.length; i++) {
			addStream(pendingStreams[i]);
		}
		pendingStreams.length = 0;


		//apertura websocket
		connectWebSocket(sessionId,event.target.connection.connectionId,myRole,myUsername);

	}


	function streamCreatedHandler(event) {
		// Subscribe to the newly created streams
		for (var i = 0; i < event.streams.length; i++) {
			addStream(event.streams[i]);
		}
	}

	function streamDestroyedHandler(event) {
		if (session.connection.connectionId == event.streams[0].connection.connectionId) {
			////////////////////////////////
			// gestione bottoni
			$('#publishLink-divider').show();
			$('#publishLink').show();
			////////////////////////////////

			$('#myCamera').removeClass('green');
			$('#myCamera').addClass('grey');

		}
		removeStream( event.streams[0]);
		// This signals that a stream was destroyed. Any Subscribers will automatically be removed.
		// This default behaviour can be prevented using event.preventDefault()
		if(webinartype == 'Conference'){
			$("#subscribersPlaceholder"+event.streams[0].connection.connectionId).show();
		}
		$("#usr"+event.streams[0].connection.connectionId).removeClass('green');
		$("#usr"+event.streams[0].connection.connectionId).addClass('grey');

	}


	function sessionDisconnectedHandler(event) {
		if(event.reason == 'forceDisconnected'){
			disconnect(true);
		}

		$("object").remove(); //rimuove tutti gli oggetti stream

		// This signals that the user was disconnected from the Session. Any subscribers and publishers
		// will automatically be removed. This default behaviour can be prevented using event.preventDefault()
		publisher = null;

/* 		clearTimeout(timeoutVar); */
		$("#sessionContent").hide();
		$("#login").show();
		$("#connectLink").show();
		$('#status').html('');
		$("#connections").children().remove(); //rimuove tutti utenti sulla destra
		$("#my-connection").children().remove(); //rimuove se stesso
		$("#warning").hide(); // In case it was displayed. So that it is hidden if the login div is redisplayed.
		
/* 		isNewChatConnection = true; */
		
    if(myRole == ROLE_MODERATOR) {
	    location.href = "./sessionTerminated";
   	}else{
	   	location.href = "./sessionClosed";
   	}

	}

	function connectionDestroyedHandler(event) {
		for (i = 0; i < event.connections.length; i++) {
			removeConnection(event.connections[i]);
		}
	}

	function connectionCreatedHandler(event) {
		// This signals new connections have been created.
		// si è connesso un altro utente
		for (i = 0; i < event.connections.length; i++) {
			addConnection(event.connections[i]);
		}
	}


	/*
	If you un-comment the call to TB.addEventListener("exception", exceptionHandler) above, OpenTok calls the
	exceptionHandler() method when exception events occur. You can modify this method to further process exception events.
	If you un-comment the call to TB.setLogLevel(), above, OpenTok automatically displays exception event messages.
	*/
	function exceptionHandler(event) {
		alert("Exception: " + event.code + "::" + event.message);
	}

	//--------------------------------------
	//  HELPER METHODS
	//--------------------------------------

	function addStream(stream) {

		// Check if this is the stream that I am publishing, and if so do not publish.
		if(session.connection == null){
			pendingStreams.push(stream)
		}else if (stream.connection.connectionId == session.connection.connectionId) {
			////////////////////////////////
			// gestione bottoni
			$('#publishLink-divider').hide();
			$('#publishLink').hide();
			$('#unpublishLink-divider').show();
			$("#unpublishLink").show();
			////////////////////////////////
			
			if(stream.hasAudio){
				$('#myCamera').removeClass('grey');
				$('#myCamera').addClass('green');
			}else{
				$('#myCamera').removeClass('green');
				$('#myCamera').addClass('grey');
			}

			return;
		}else{
		
			var newSubStyle = {
	    	buttonDisplayMode: "off"
	    }
			var subscriberProperties = {style:newSubStyle};
			var speakerControl;

			if(webinartype == 'Conference'){

				$("#subscribersPlaceholder"+stream.connection.connectionId).hide();

				var subscriberDiv = document.createElement('div'); // Create a div for the subscriber to replace
				subscriberDiv.setAttribute('id', stream.streamId); // Give the replacement div the id of the stream as its id.
	
				$("#usr"+stream.connection.connectionId).append(subscriberDiv);

				subscribers[stream.streamId] = session.subscribe(stream, subscriberDiv.id, subscriberProperties);

				if(stream.hasAudio){
					$("#usr"+stream.connection.connectionId).removeClass('grey');
					$("#usr"+stream.connection.connectionId).addClass('green');
				}else{
					$("#usr"+stream.connection.connectionId).removeClass('green');
					$("#usr"+stream.connection.connectionId).addClass('grey');
				}
			}
			
		}

	}

	function getConnectionData(connection) {

		var connectionData = '';
		try {
			connectionData = JSON.parse(connection.data);
		} catch(error) {
			if(connection.data){
				connectionData = eval("(" + connection.data + ")" );
			}
		}
		return connectionData;
	}

	function addConnection(connection) {

		//se non e' ancora stata creata la connessione per l'utente loggato
		//memorizza connessioni degli altri utenti
		if(session.connection == null){
			pendingConnections.push(connection)
		}else if (connection.connectionId != session.connection.connectionId) {

			if(webinartype == 'Conference'){
				
				if(myRole == ROLE_MODERATOR) {
       				$("#connections").append('<li id="usr'+connection.connectionId+'" class="publisher user-list truncate grey" style="display:none" > <a href="#" onclick="hideAllOthersPopover(\''+connection.connectionId+'\');$(\'#user-profile'+connection.connectionId+'\').popover(\'show\');" id="user-profile'+connection.connectionId+'" rel="popover" data-trigger="click" class="btn user-profile-small" ><i class="icon-ok" style="display:none"></i><span id="display-name'+connection.connectionId+'"></span></a> <div class="placeholder-user"><img id="subscribersPlaceholder'+connection.connectionId+'" src="images/img-video.jpg" style="width: 100%;" /></div></li>');

				}else{
       				$("#connections").append('<li id="usr'+connection.connectionId+'" class="publisher user-list truncate grey" style="display:none" > <a id="user-profile'+connection.connectionId+'" class="btn disabled user-profile-small" ><i class="icon-ok" style="display:none"></i><span id="display-name'+connection.connectionId+'"></span></a> <div class="placeholder-user"><img id="subscribersPlaceholder'+connection.connectionId+'" src="images/img-video.jpg" style="width: 100%;"/></div></li>');
				}

 			}

 			//aggiungo connectionId a elenco connectionsId
 			if(myRole == ROLE_MODERATOR) {
 				connectionsId.push(connection.connectionId);
 			}
		}
	}

	function removeConnection(connection) {		
		//rimuove i popover aperti (se no potrebbe rimanere aperto in una posizione errata)
		hideAllPopover();
		if(myRole == ROLE_MODERATOR){
			//messaggio utente disconnesso
			//elimina connectionId da elenco connectionsId
			var index = connectionsId.indexOf(connection.connectionId);
			connectionsId.splice(index, 1);
		}
	}
		
	function removeStream(stream) {
		if ($('#'+stream.connectionId)) {
			$('#'+stream.connectionId).remove();
		}
	}


	function forceDisconnect(connectionId) {
		if(confirm('Vuoi veramente disconnettere l\'utente?')){
			banUser(session, connectionId);
/* 			session.forceDisconnect(connectionId); */
		}
	}


	//--------------------------------------
	//  TOOLBAR METHODS
	//--------------------------------------
	
/*
	function setConnectionTotalTime(millis){
	
		//var milliseconds = millis % 1000;
		var seconds = Math.floor((millis / 1000) % 60);
		var minutes = Math.floor((millis / (60 * 1000)) % 60);
		var hours = Math.floor((millis / (60 * 60 * 1000)) % 24);
		
		if (seconds < 10){
			seconds = "0" + seconds;
		} if (minutes < 10){
			minutes = "0" + minutes;
		} if (hours < 10){
			hours = "0" + hours;
		}
		var formattedTime = hours + ":" + minutes + ":" + seconds;;
		
		//per sicurezza se giorni
		var days = parseInt(millis / (24 * 60 * 60 * 1000));
		if(days > 0){
			formattedTime = days + ' giorni';
		}

		$('#connectionTotalTime').attr('data-original-title',formattedTime);
		$('#connectionTotalTime').html('<i class="icon-time"></i> <span>'+formattedTime+'</span>');		

	}
*/
		
/*
	function loop() {    
		connectionTotalTime += CONNECTION_TIME_TIMEOUT;
	  setConnectionTotalTime(connectionTotalTime);		    
		timeoutVar = setTimeout("loop()", CONNECTION_TIME_TIMEOUT);    
	}
*/

	
	function changeMicVol(amount) {
		publisher = publisher.setMicrophoneGain(publisher.getMicrophoneGain()+amount);
		showMicVol();
	}
	
	function showMicVol(){
		var value = publisher.getMicrophoneGain();
		if (value <= 5) { 
		  	$('#volShow').attr('src', 'images/volume/0.png');
		}
		else if (value <= 25) { 
		  	$('#volShow').attr('src', 'images/volume/25.png');
		}
		else if (value <= 50) { 
		  	$('#volShow').attr('src', 'images/volume/50.png');
		}
		else if (value <= 75) { 
		  	$('#volShow').attr('src', 'images/volume/75.png');
		}
		else { 
		  	$('#volShow').attr('src', 'images/volume/100.png');
		}
	}
		
		
	function changeSpeakersVol(streamId, amount) {
		subscribers[streamId] = subscribers[streamId].setAudioVolume(subscribers[streamId].getAudioVolume()+amount);
	}

	//popover
	function hideAllPopover() {
		if(myRole == ROLE_MODERATOR) {
			for(var i = 0; i < connectionsId.length; i++){
				$('#user-profile'+connectionsId[i]).popover('hide');	       		
			}
		}
	}
	
	function hideAllOthersPopover(connectionIdToShow) {
   	if(myRole == ROLE_MODERATOR) {
   		for(var i = 0; i < connectionsId.length; i++){
   			if(connectionsId[i] != connectionIdToShow){
   				$('#user-profile'+connectionsId[i]).popover('hide');	       		
   			}
   		}
		}
	}

	//colonna utenti
	function hideColumnUsers() {
		$('#resizeFull').hide();			
		$('#resizeSmall').show();			
		$('#column1').addClass('big-slide');			
		$('#connections').addClass('comprimi');			
		$('.colonna-utenti').addClass('comprimi');	
		$('#column2').addClass('big-column');		
	}

	function showColumnUsers() {
		$('#resizeSmall').hide();			
		$('#resizeFull').show();			
		$('#column1').removeClass('big-slide');			
		$('#connections').removeClass('comprimi');			
		$('.colonna-utenti').removeClass('comprimi');	
		$('#column2').removeClass('big-column');		
		if(myRole == ROLE_MODERATOR || hasSlideControl){
			$('#slide-controller').css('display','block');
		}
	}


