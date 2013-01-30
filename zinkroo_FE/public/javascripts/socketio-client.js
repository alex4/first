var SLIDES_ROOT_PATH = 'http://www.zinkroo.com/presentations/view_slide/';
var SERVER_ADDRESS = 'http://10.0.10.119';
var SERVER_PORT = 3000;


var socket;


var webSocketConnections = new Object();
var currentPageNumber = 1;
var connectionId;

var docNames;
var thumbNames;

//costruisce i percorsi delle slide e dei thumb
buildSlidesPath(slidesPartialPath);
 
//preload image function
$.fn.preload = function() {
    this.each(function(){
        $('<img/>')[0].src = this;
    });
}


function connectWebSocket(sessId,connId,myRole,usrname) {
//console.log('connectWebSocket--------');
	"use strict";
	
	connectionId = connId;

	socket = io.connect(SERVER_ADDRESS+':'+SERVER_PORT+'?sessionId='+sessId+'&connectionId='+connId+'&username='+usrname+'&role='+myRole+'&userId='+userId+'&conferenceId='+conferenceId+'&authId='+authId);
	
	
	//visualizzo parti nascoste...
	$('#loading').hide();
	$('#navbar').show();
	$('#sessionContent').show();

	//se moderator o publisher visualizza o nasconde...
	
	setupSlideController();
	//recupero current page
	//recupero altri utenti gia' connessi
	//getAllAudioState
	
	
	socket.on("userConnected", function (data) {
		addWebSocketConnection(data.connectionId, data.username, data.role);
	});
	
	socket.on("connectedUsers", function (data) {
    var otherUsers = data.connectedUsers;
    for (var i=0;i<otherUsers.length;i++){
    	addWebSocketConnection(otherUsers[i].connectionId, otherUsers[i].username, otherUsers[i].role);	
    }
	});
	
	socket.on("chatPhrase", function (data) {
		addMessage(data.username,data.message);
	});
	
	socket.on("pageNumber", function (data) {
		updateCurrentPageNumber(data.message);
	});

	socket.on("enableSlideControl", function (data) {
		updateSlideControll(true,data.message);
	});

	socket.on("disableSlideControl", function (data) {
		updateSlideControll(false,data.message);
	});
		
	socket.on("allAudioState", function (data) {
  	if(data.message=='enabled'){
  		audioEnabled = true;
  	}else{
  		audioEnabled = false;
  	}
	});

	socket.on("enableAudio", function (data) {
		updateAudio(true,data.message);
	});

	socket.on("disableAudio", function (data) {
		updateAudio(false,data.message);
	});
		
	socket.on("connectionClosed", function (data) {
  	removeWebSocketConnection(data.connectionId);
	});
	
}


////////////////////////
//	SOCKET
////////////////////////
function addWebSocketConnection(acceptedConnectionId,username,role){

//console.log('addWebSocketConnection------');

	var wsConnectionObject = new Object();
	wsConnectionObject.connectionId = acceptedConnectionId;
	wsConnectionObject.role = role;
	wsConnectionObject.username = username;
	webSocketConnections[acceptedConnectionId] = wsConnectionObject;



	if(bridge){
		wsConnectionObject.type = 'addWebSocketConnection';

		var myJSONText = JSON.stringify(wsConnectionObject);

		bridge.send(myJSONText);
		
	}


	
	if((role == ROLE_MODERATOR) || (role == ROLE_PUBLISHER)) {
		
		$("#display-name"+acceptedConnectionId).html(username);		
		if(myRole == ROLE_MODERATOR) {
	
			$('#user-profile'+acceptedConnectionId).popover({
				placement: 'left',
				title: ''+username,
				trigger: 'manual',
				content: '<table class="table popover-table"><tr><td>Permessi audio</td><td><a href="#" onclick="javascript:disableAudio(\''+acceptedConnectionId+'\');"><img src="images/popover-icons/mute.png" /></a></td><td><a href="#" onclick="javascript:enableAudio(\''+acceptedConnectionId+'\');"><img src="images/popover-icons/volume.png" /></a></td></tr><tr><td>Controllo slide</td><td><a href="#" onclick="javascript:enableSlideControl(\''+acceptedConnectionId+'\');"><img src="images/popover-icons/slide-ok.png" /></a></td><td><a href="#" onclick="javascript:disableSlideControl(\''+acceptedConnectionId+'\');"><img src="images/popover-icons/slide-ko.png" /></a></td></tr><tr><td>Espelli utente</td><td><a href="#" onclick="javascript:forceDisconnect(\''+acceptedConnectionId+'\');"><img src="images/popover-icons/remove.png" /></a></td><td></td></tr></table>'
			}).click(function(evt) {
			    evt.stopPropagation();
			    $(this).popover('show');
			});
	
			$('html').click(function(evt) {
			    $('#user-profile'+acceptedConnectionId).popover('hide');
			});
	
		}
	
		if(role == ROLE_MODERATOR){
			$('#usr'+acceptedConnectionId).addClass('moderator');
		}
	
	
		if((myRole != ROLE_MODERATOR) && (myRole != ROLE_PUBLISHER)){
			//sono un semplice utente subscriber (ne moderatore ne publisher)
			if(role == ROLE_MODERATOR){
				//sposto il video nell'area di sinistra
				$('#usr'+acceptedConnectionId).appendTo("#my-connection");
			}
		}
		
		//visualizzo immagine video
		$('#usr'+acceptedConnectionId).show();
		$('#usr'+acceptedConnectionId).css('display',true);
	
	}
	
	//aggiunge alla lista visualizzata nel tab utenti
	var subs_el = '<li id="subs_el'+acceptedConnectionId+'" >'+username+'</li>';

	$("#subscribers-list .subs-list").append(subs_el);
	
	//aggiunta colore per identificareil ruolo
	if(role == ROLE_MODERATOR){
		$('#subs_el'+acceptedConnectionId).addClass('moderator-list');
	}else if(role == ROLE_PUBLISHER){
		$('#subs_el'+acceptedConnectionId).addClass('publisher-list');
	}
	
	//aggiunta cestino per espellere il partecipante
	if(myRole == ROLE_MODERATOR){
		$('#subs_el'+acceptedConnectionId).prepend('<a class="btn btn-mini pull-right" href="#" title="espelli" onclick="javascript:forceDisconnect(\''+acceptedConnectionId+'\');"><i class="icon-trash"></i></a>');
	}

}

function removeWebSocketConnection(closedConnectionId){

	if(myRole == ROLE_MODERATOR){
		//messaggio utente disconnesso
		userDisconnectedMessage(webSocketConnections[closedConnectionId].username);
	}	

	if ($('#usr'+closedConnectionId)) {
		$('#usr'+closedConnectionId).remove();
	}			
	//rimuove dalla lista visualizzata
	if ($('#subs_el'+closedConnectionId)) {
		$('#subs_el'+closedConnectionId).remove();
	}			



	var wsConnectionObject = new Object();
	wsConnectionObject.connectionId = closedConnectionId;

	if(bridge){
		wsConnectionObject.type = 'removeWebSocketConnection';

		var myJSONText = JSON.stringify(wsConnectionObject);

		bridge.send(myJSONText);
		
	}


	delete webSocketConnections[closedConnectionId];

}


////////////////////////
//	CHAT
////////////////////////

function checkSubmitChatPhrase(e)
{
   if(e && e.keyCode == 13)
   {
      sendChatPhrase();
      return false;
   }
}

function sendChatPhrase() {
	var message = $('#chatPhrase').val();
	// send the message as an ordinary text
	socket.emit("chatPhrase", { sessionId: sessionId, username: myUsername, message: message });
	$('#chatPhrase').val('');	
}

//status messages		
function addStatusMessage(statusMessage) {
	var message = '<font color="#eeaaaa">'+statusMessage+'</font>';
	//connection.send(JSON.stringify({ type: 'chatPhrase', sessionId: sessionid, data: newLine }));	
	socket.emit("chatPhrase", { sessionId: sessionId, username: '', message: message });
}

function allMuteMessage() {
	var msg = 'Audio disabilitato su tutti i partecipanti';
	addStatusMessage(msg);			
}

function allAudioOnMessage() {
	var msg = 'Audio abilitato su tutti i partecipanti';
	addStatusMessage(msg);			
}

function userReceivedSlideControlMessage(username) {
	var msg = username+' controlla le slide';
	addStatusMessage(msg);			
}

function userRemovedSlideControlMessage(username) {
	var msg = username+' non controlla piu\' le slide';
	addStatusMessage(msg);			
}

function userDisconnectedMessage(username) {
	var msg = username+' e\' uscito';
	addStatusMessage(msg);			
}


function addMessage(username,message) {
	var newLine = '';
	if(username){
		newLine = '<p><b>'+username+'</b>:'+message+'</p>';
	}else{
		newLine = '<p>'+message+'</p>';
	}
	
  $('#chatBoard').prepend(newLine);	
  $("#chatBoard").animate({scrollTop: 0 });
} 
		
////////////////////////
//	SLIDES
////////////////////////
/* Aggiorna current page number e mostra la slide corrente */
function updateCurrentPageNumber(message) {

	currentPageNumber = parseInt(message);
	//disabilita bottoni
	$('.previous').addClass('disabled');
	$('.next').addClass('disabled');

  $('#imgSlideShown')
  	.load(function() { $('#imgSlideShown').css('opacity', '1'); if(currentPageNumber>1){$('.previous').removeClass('disabled');} if(currentPageNumber < docNames.length){$('.next').removeClass('disabled');} })
  	.attr('src', docNames[currentPageNumber-1]);	
  $('#slideShownNum').html(currentPageNumber+' di '+docNames.length);	
  
  
  //preload next image
  if(currentPageNumber < docNames.length){
		var nextPageNum = currentPageNumber+1;
		$([docNames[nextPageNum-1]]).preload();   
  }
  //preload previous image
  if(currentPageNumber > 1){
		var prevPageNum = currentPageNumber-1;
		$([docNames[prevPageNum-1]]).preload();   
  }

  //evidenzia thumb selezionato
  $('.thumb-container img').removeClass('active-slide');
  $('#img-'+currentPageNumber).addClass('active-slide');
  //muove slider alla thumb selezionata
  if(currentPageNumber > 1){
  	$('.thumb-container').scrollTo( $('#img-'+(currentPageNumber-1)) );
  }else{
  	$('.thumb-container').scrollTo( $('#img-'+currentPageNumber) );
  }
}

function changePageNumber(newValue) {
	if(myRole == ROLE_MODERATOR || hasSlideControl){
		//opacizza immagine corrente
		$('#imgSlideShown').css('opacity', '0.5');
		
		currentPageNumber = newValue;
		socket.emit("pageNumber", { sessionId: sessionId, message: currentPageNumber });
	}
}

function nextPage() {
	if((currentPageNumber < docNames.length)  && !($('.next').hasClass('disabled'))){
		changePageNumber(currentPageNumber+1);
	}
}
function previousPage() {
	if((currentPageNumber > 1) && !($('.previous').hasClass('disabled'))){
		changePageNumber(currentPageNumber-1);
	}
}

function setupSlideController() {
	if((myRole == ROLE_MODERATOR) || (myRole == ROLE_PUBLISHER)) {

		//crea elenco thumb
		var thumbs = '';
		for (var i = 1; i <= docNames.length; i++) {
			thumbs = thumbs.concat('<img id="img-'+(i)+'" src="'+thumbNames[i-1]+'" onclick="changePageNumber('+i+')" class="preview-thumbs" rel="tooltip" title="'+ (i) +'" />');					
		}
		//e visualizza elenco thumb
		$('#slides').html('<div class="thumb-container">'+thumbs+'</div>');

		$('#slides div').css( 'width', docNames.length * 165+'px' );
	}
}

//thumb
function getThumbNameFromImageName(imageName){
	var pointIndex = imageName.lastIndexOf('.');
	var thumbName = imageName.substring(0,pointIndex).concat('_thumb').concat(imageName.substring(pointIndex));
	return thumbName;
}



//enable-disable SlideControl
function enableSlideControl(connectionIdToEnableSlideControl) {
  if(myRole == ROLE_MODERATOR) {
		socket.emit("enableSlideControl", { sessionId: sessionId, message: connectionIdToEnableSlideControl });
	}
}
function disableSlideControl(connectionIdToDisableSlideControl) {
  if(myRole == ROLE_MODERATOR) {
		socket.emit("disableSlideControl", { sessionId: sessionId, message: connectionIdToDisableSlideControl });
	}
}

/* Aggiorna controllo slide abilita-disabilita */
function updateSlideControll(message,slideCtrlConnId) {
	if(message){
		//ricevuto messaggio abilita slide controll
		if(slideCtrlConnId == connectionId){
			//messaggio per me
			if(!hasSlideControl){
				userReceivedSlideControlMessage(myUsername);
			}
			$('#slide-controller').show();
			hasSlideControl = true;
		}else{
			//toglie icona controllo slide dagli altri
			$('.user-profile-small i').hide();
			//mette icona controllo slide a chi e' stato ablilitato
			$('#user-profile'+slideCtrlConnId+' i').show();
		}
	}else{
		//ricevuto messaggio disabilita slide controll
		if(slideCtrlConnId == connectionId){
			//messaggio per me
			if(hasSlideControl){
				userRemovedSlideControlMessage(myUsername);
			}
			hasSlideControl = false;
			$('#slide-controller').hide();
		}else{
			//toglie icona controllo slide
			$('#user-profile'+slideCtrlConnId+' i').hide();
		}
	}
}

/*popolamento array slides e thumb*/
function buildSlidesPath(partialPaths){
	docNames = new Array();
	thumbNames = new Array();
	var paths = partialPaths.split(",");
	for (i=0; i<paths.length; i++){
		var fullSlidePath = SLIDES_ROOT_PATH + paths[i] + '/normal';
		var fullThumbPath = SLIDES_ROOT_PATH + paths[i] + '/thumb';
		docNames.push(fullSlidePath);
		thumbNames.push(fullThumbPath);
	}
}

////////////////////////
//	AUDIO
////////////////////////
/*
function getAllAudioState() {	
	connection.send(JSON.stringify({ type: 'getAllAudioState', sessionId: sessionid, connectionId: connectionid }));
}
*/

/* Aggiorna audio abilita-disabilita */
function updateAudio(enable,audioConnId) {
	if(bridge){
	//ipad
		var wsObject = new Object();
		wsObject.connectionId = audioConnId;
		wsObject.enable = enable;

		wsObject.type = 'updateAudio';

		var myJSONText = JSON.stringify(wsObject);

		bridge.send(myJSONText);
		
	} else{
	//non ipad
		if(enable){
			//ricevuto messaggio abilita audio
			if(audioConnId == 'all'){
				if(myRole != ROLE_MODERATOR) {
					if(publisher){
						publisher.publishAudio(true);
					}
				}
				//tutti gli altri tranne il moderator green
				$('.user-list').removeClass('grey');
				$('.user-list').addClass('green');
				//bottone enableAllAudio disabilitato
				$('#enableAllAudio').addClass('disabled');
				$('#disableAllAudio').removeClass('disabled');
				//aggiorno stato audio
				audioEnabled = true;
			}else if(audioConnId == connectionId){
				if(publisher){
					publisher.publishAudio(true);
				}
				if($("#myCamera")){
					$('#myCamera').removeClass('grey');
					$('#myCamera').addClass('green');
				}
				//aggiorno stato audio
				audioEnabled = true;
			}else{
				if($("#usr"+audioConnId)){
					$("#usr"+audioConnId).removeClass('grey');
					$("#usr"+audioConnId).addClass('green');
				}
			}
		}else{
			//ricevuto messaggio disabilita audio
			if(audioConnId == 'all'){
				if(myRole != ROLE_MODERATOR) {
					if(publisher){
						publisher.publishAudio(false);
					}
				}
				
				//tutti gli altri tranne il moderator grey
				$('.user-list').removeClass('green');
				$('.user-list').addClass('grey');
				//bottone disableAllAudio disabilitato
				$('#enableAllAudio').removeClass('disabled');
				$('#disableAllAudio').addClass('disabled');				
				//aggiorno stato audio
				audioEnabled = false;
			}else if(audioConnId == connectionId){
				if(publisher){
					publisher.publishAudio(false);
				}
				if($("#myCamera")){
					$('#myCamera').removeClass('green');
					$('#myCamera').addClass('grey');
				}
				//aggiorno stato audio
				audioEnabled = false;
			} else{
				if($("#usr"+audioConnId)){
					$("#usr"+audioConnId).removeClass('green');
					$("#usr"+audioConnId).addClass('grey');
				}
			}
		}//fine else ricevuto messaggio abilita-disabilita audio
	}//fine else ipad-nonipad
	
	
}


//enable-disable audio
function enableAudio(connectionIdToEnableAudio) {
	socket.emit("enableAudio", { sessionId: sessionId, message: connectionIdToEnableAudio });
}
function disableAudio(connectionIdToDisableAudio) {
	socket.emit("disableAudio", { sessionId: sessionId, message: connectionIdToDisableAudio });
}

function enableAllAudio() {
	socket.emit("enableAudio", { sessionId: sessionId, message: 'all'});
	allAudioOnMessage();
}
function disableAllAudio() {
	socket.emit("disableAudio", { sessionId: sessionId, message: 'all'});
	allMuteMessage();
}

////////////////////////
//	CONFERENCE CONTROLL
////////////////////////
function banUser(session, connectionId){
	socket.emit("userBanned", { sessionId: sessionId, connectionId: connectionId});
	session.forceDisconnect(connectionId);
}

function leaveConference(){
	socket.emit("leaveConference", null);
}

