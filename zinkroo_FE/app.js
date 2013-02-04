//LOGGER
var log4js = require('log4js');
log4js.configure(__dirname+'/log4js_configuration.json', {});
logger = log4js.getLogger('webcall-logger');
logger.setLevel('DEBUG');

//DB
var mysql = require("mysql");
// Create the connection.
// Data is default to new mysql installation and should be changed according to your configuration.
/*
dbconnection = mysql.createConnection({
   user: "root",
   password: "root",
   database: "zinkroo_com",
   socketPath: "/Applications/MAMP/tmp/mysql/mysql.sock"
});
*/

dbconnection = mysql.createConnection({
   host: '216.70.107.93',
   user: "zinkroo_user_dev",
   password: "zinkroo_user_13",
   database: "zinkroo_DB_dev"
});


function handleDisconnect(dbconnection) {
  dbconnection.on('error', function(err) {
    if (!err.fatal) {
      return;
    }

    if (err.code !== 'PROTOCOL_CONNECTION_LOST') {
      throw err;
    }

    console.log('Re-connecting lost connection: ' + err.stack);

    dbconnection = mysql.createConnection(dbconnection.config);
    handleDisconnect(dbconnection);
    dbconnection.connect();
  });
}

handleDisconnect(dbconnection);


/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path');


var app = express();

app.configure(function(){
  app.set('port', 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.errorHandler());
});


app.post('/', routes.index);
app.get('/sessionTerminated', routes.sessionTerminated);
app.get('/sessionClosed', routes.sessionClosed);
app.get('/ipad', routes.ipad);

var server = http.createServer(app);
server.listen(app.get('port'), function(){
  logger.warn("Express server listening on port " + app.get('port'));
});

/////////////////
//	SOCKET.IO
/////////////////

var ROLE_MODERATOR = 'moderator';

var io = require('socket.io').listen(server);

io.sockets.on('connection', function (socket) {

	var sessionId = socket.handshake.query.sessionId;
	var connectionId = socket.handshake.query.connectionId;
	var username = socket.handshake.query.username;
	var role = socket.handshake.query.role;
	var userId = socket.handshake.query.userId;
	var conferenceId = socket.handshake.query.conferenceId;
	var authId = socket.handshake.query.authId;
	
	socket.set('sessionId', sessionId, function () {
  });
	socket.set('connectionId', connectionId, function () {
  });
	socket.set('role', role, function () {
  });

  //recupero utenti collegati
	var connectedUsersToSend = getConnectedUsersToSend(sessionId);
  var connectedUsers = {
      connectedUsers: connectedUsersToSend
  };
	socket.emit('connectedUsers', connectedUsers);

  var connectionObject = new Object();
  connectionObject.username = username;
  connectionObject.socket = socket;
  connectionObject.role = role;
  connectionObject.connectionId = connectionId;
  connectionObject.userId = userId;
  connectionObject.conferenceId = conferenceId;
  connectionObject.authId = authId;
  
    
	addConnectionToSession(sessionId,connectionId,connectionObject);

  logger.info('Connessione utente username:%s authId:%s conferenceId:%s userId:%s role:%s',username,authId,conferenceId,userId,role);
    
  //faccio sapere agli altri che mi sono connesso
  var jsonTosend = {
		connectionId: connectionId,
		username: username,
		role: role
  };
  // broadcast message to all connected clients
  //var jsonTosend = JSON.stringify({ data: obj });
  var type = 'userConnected';
  broadcastMessageToOthers(sessionId, connectionId, type, jsonTosend);
  
  //recupero pagina attualmente visibile
  var actualPageNumber = {
		message: sessionsCurrentPageNumber[sessionId],
	};
	socket.emit('pageNumber', actualPageNumber);
			 
  //recupero stato audio dei partecipanti
  var allAudioState = {
		message: sessionsAllAudioState[sessionId],
	};
	socket.emit('allAudioState', allAudioState);
			 

	socket.on('chatPhrase', function (data) {
		var obj = {
			username: data.username,
			message: data.message
		};
		broadcastMessage(data.sessionId, 'chatPhrase', obj);
	});
	
	socket.on('pageNumber', function (data) {
		updatePageNumber(sessionId, data.message);
		var obj = {
			message: data.message
		};
		broadcastMessage(data.sessionId, 'pageNumber', obj);
	});


	socket.on('enableSlideControl', function (data) {
		var obj = {
			message: data.message
		};
		broadcastMessage(data.sessionId, 'enableSlideControl', obj);
	});
	
	socket.on('disableSlideControl', function (data) {
		var obj = {
			message: data.message
		};
		broadcastMessage(data.sessionId, 'disableSlideControl', obj);
	});
	

	socket.on('enableAudio', function (data) {
		if(data.message=='all'){
			updateAllAudioState(sessionId, STATE_ENABLED);
		}
		var obj = {
			message: data.message
		};
		broadcastMessage(data.sessionId, 'enableAudio', obj);
	});

	socket.on('disableAudio', function (data) {
		if(data.message=='all'){
			updateAllAudioState(sessionId, STATE_DISABLED);
		}
		var obj = {
			message: data.message
		};
		broadcastMessage(data.sessionId, 'disableAudio', obj);
	});

	socket.on('leaveConference', function (data) {
		logger.info('leaveConference..................');
		socket.get('sessionId', function (err, sessionId) {
			socket.get('connectionId', function (err, connectionId) {
				socket.get('role', function (err, role) {
					//se ruolo moderator chiudo tutto
					if(role == ROLE_MODERATOR){
						clearInterval(sessionsMap[sessionId][connectionId].intervalId);
						updateClosedConference(sessionId,connectionId);						
					}else{
						updateDisconnectedUser(sessionId,connectionId);
					}

				});
			});
		});

	});

	socket.on('userBanned', function (data) {
		updateBannedUser(data.sessionId,data.connectionId);
	});

	socket.on('disconnect', function () {
		socket.get('sessionId', function (err, sessionId) {
			socket.get('connectionId', function (err, connectionId) {
				socket.get('role', function (err, role) {
					var obj = {
						connectionId: connectionId,
						role: role
					};
					
					if(sessionsMap && sessionsMap[sessionId] && sessionsMap[sessionId][connectionId]){
						logger.warn('DISCONNESSIONE username: %s SE NON EFFETTUATA CORRETTAMENTE nella tabella %s_conference_participants NON VERRA AGGIORNATO il campo disconnected_at:%s  per id=%s -conferenceId:%s',sessionsMap[sessionId][connectionId].username,sessionsMap[sessionId][connectionId].authId,mysqlTimestamp(new Date().getTime()),sessionsMap[sessionId][connectionId].userId,sessionsMap[sessionId][connectionId].conferenceId);
	
						if(role == ROLE_MODERATOR){
							//solo caso di uscita senza chiusura conference
							if(sessionsMap[sessionId]){
								logger.warn('Moderatore disconnesso STATISTICHE NON VERRANNO AGGIORNATE per authId:%s conferenceId:%s ',sessionsMap[sessionId][connectionId].authId,sessionsMap[sessionId][connectionId].conferenceId);
								clearInterval(sessionsMap[sessionId][connectionId].intervalId);
							}
						}
					}

					if(sessionsMap[sessionId]){
						//elimino da mappa connessioni
						delete sessionsMap[sessionId][connectionId];
					}
					//comunico agli altri
					broadcastMessage(sessionId, 'connectionClosed', obj);
				});
			});
		});
  });

});

/////////////////////////////////
//	gestione sessioni
/////////////////////////////////
/* Global variables */
const STATE_ENABLED = 'enabled';
const STATE_DISABLED = 'disabled';

var sessionsMap = new Object();
var sessionsCurrentPageNumber = new Object();
var sessionsAllAudioState = new Object();

function getSessionConnections(sessionId) {
    return sessionsMap[sessionId];
}

function addConnectionToSession(sessionId,connectionId,connectionObj){
	var sessionConnections = getSessionConnections(sessionId);
	if(!sessionConnections){
		//prima connessione della sessione
		sessionConnections = new Object();
		sessionsCurrentPageNumber[sessionId] = 1;
		sessionsAllAudioState[sessionId] = STATE_ENABLED;
	}
	sessionConnections[connectionId] = connectionObj;
	sessionsMap[sessionId] = sessionConnections;
	
	updateConnectionTime(sessionId,connectionId);
	if(connectionObj.role == ROLE_MODERATOR){
		addTimer(sessionId,connectionId);
	}
}

function getConnection(sessionId,connectionId) {
    return sessionsMap[sessionId][connectionId];
}


/////////////////////////////////
//	UTIL
/////////////////////////////////
function broadcastMessage(sessionId, type, jsonTosend){
    var sessionConnections = getSessionConnections(sessionId);
    for (var k in sessionConnections) {
	    // use hasOwnProperty to filter out keys from the Object.prototype
	    if (sessionConnections.hasOwnProperty(k)) {
	        sessionConnections[k].socket.emit(type, jsonTosend);
	    }
	}
}

function broadcastMessageToOthers(sessionId, connectionIdToExclude, type, jsonTosend){
    var sessionConnections = getSessionConnections(sessionId);
    for (var k in sessionConnections) {
	    // use hasOwnProperty to filter out keys from the Object.prototype
	    if (sessionConnections.hasOwnProperty(k)) {
	    	if (k!=connectionIdToExclude) {
		        sessionConnections[k].socket.emit(type, jsonTosend);
	    	}
	    }
	}
}

function getConnectedUsersToSend(sessionId){
	var usersArray = new Array();
	var sessionConnections = getSessionConnections(sessionId);
	for (var k in sessionConnections) {
		// use hasOwnProperty to filter out keys from the Object.prototype
		if (sessionConnections.hasOwnProperty(k)) {
			var obj = {
				connectionId: sessionConnections[k].connectionId,
				username: sessionConnections[k].username,
				role: sessionConnections[k].role
			};
			usersArray.push(obj);
		}
	}
	return usersArray;
}

function updatePageNumber(sessionId, pageNumber){
	sessionsCurrentPageNumber[sessionId] = pageNumber;
}

function updateAllAudioState(sessionId, audioState){
	sessionsAllAudioState[sessionId] = audioState;
}

/////////////////
//	TIMER
/////////////////
/* ogni CHECK_INTERVAL secondi scrive su DB numero utenti collegati (per statistiche)*/
var CHECK_INTERVAL = 60000; //ogni minuto
function addTimer(sessionId,connectionId){
	var conferenceToModify = getConnection(sessionId,connectionId);
	//scrive appena chiamata
	updateStats(sessionId, conferenceToModify.conferenceId, conferenceToModify.authId);
	//ripete ogni CHECK_INTERVAL sec
	conferenceToModify.intervalId = setInterval(updateStats, CHECK_INTERVAL, sessionId, conferenceToModify.conferenceId, conferenceToModify.authId);
}


/////////////////
//	DB UTIL
/////////////////

function updateClosedConference(sessionId,connectionId){
	var CONFERENCE_STATUS_CLOSED = '-1';
	var conferenceToModify = getConnection(sessionId,connectionId);

	//TODO:se ci fosse la colonna end_date si potrebbe aggiornare
	var sqlUpdate = 'UPDATE '+conferenceToModify.authId+'_conferences SET conf_status = '+dbconnection.escape(CONFERENCE_STATUS_CLOSED)+' WHERE id = ' +dbconnection.escape(conferenceToModify.conferenceId);
	dbconnection.query(sqlUpdate, function(errUpdate, resultUpdate) {
		if(errUpdate){
			logger.error('error:'+errUpdate);
		}else{
			logger.debug('conferenceId %s chiusa da moderator (authId:%s)',conferenceToModify.conferenceId,conferenceToModify.authId);
			//elimino anche da mappa
			delete sessionsMap[sessionId];
		}
	});

}

function updateDisconnectedUser(sessionId,connectionId){
	var ROLE_DISCONNECTED = '-1';
	var connectionToModify = getConnection(sessionId,connectionId);
	var sqlUpdate = 'UPDATE '+connectionToModify.authId+'_conference_participants SET role_type = '+dbconnection.escape(ROLE_DISCONNECTED)+', disconnected_at = '+dbconnection.escape(mysqlTimestamp(new Date().getTime()))+'  WHERE id = ' +dbconnection.escape(connectionToModify.userId);
	dbconnection.query(sqlUpdate, function(errUpdate, resultUpdate) {
		if(errUpdate){
			logger.error('error:'+errUpdate);
		}else{
			logger.debug('disconnesso username:%s con userId:%s (authId:%s)',connectionToModify.username, connectionToModify.userId, connectionToModify.authId);
		}
	});
}

function updateBannedUser(sessionId,connectionId){
	var connectionToBan = getConnection(sessionId,connectionId)
	var ROLE_BANNED = '-2';
	var sqlUpdate = 'UPDATE '+connectionToBan.authId+'_conference_participants SET role_type = '+dbconnection.escape(ROLE_BANNED)+', disconnected_at = '+dbconnection.escape(mysqlTimestamp(new Date().getTime()))+'  WHERE id = ' +dbconnection.escape(connectionToBan.userId);
	dbconnection.query(sqlUpdate, function(errUpdate, resultUpdate) {
		if(errUpdate){
			logger.error('error:'+errUpdate);
		}else{
			logger.info('bannato username:%s con userId:%s (authId:%s)',connectionToBan.username,connectionToBan.userId,connectionToBan.authId);
		}
	});
}

function updateConnectionTime(sessionId,connectionId){
	var connectionToModify = getConnection(sessionId,connectionId);
		
	var sqlParticipant = 'SELECT connected_at FROM '+connectionToModify.authId+'_conference_participants WHERE id = ' + dbconnection.escape(connectionToModify.userId);
	dbconnection.query(sqlParticipant, function(errParticipant, resultsParticipant) {
		if(errParticipant){
			logger.error('error:'+errParticipant);
		 	res.render('error', { title: 'DB ERROR recuperando dati partecipante' });
		}else{
			if(resultsParticipant[0]){
				if(resultsParticipant[0].connected_at){
					//utente gia connesso non aggoirno
					logger.warn('Riconnessione username: %s NEL DB NON VERRA AGGIORNATO il campo connected_at:%s nella tabella %s_conference_participants per id=%s -conferenceId:%s',connectionToModify.username,mysqlTimestamp(new Date().getTime()),connectionToModify.authId,connectionToModify.userId,connectionToModify.conferenceId);
				}else{
					//aggiorno
					var sqlUpdate = 'UPDATE '+connectionToModify.authId+'_conference_participants SET connected_at = '+dbconnection.escape(mysqlTimestamp(new Date().getTime()))+'  WHERE id = ' +dbconnection.escape(connectionToModify.userId);
					dbconnection.query(sqlUpdate, function(errUpdate, resultUpdate) {
						if(errUpdate){
							logger.error('error:'+errUpdate);
						}else{
							logger.info('Prima connessione per username:%s con userId:%s (authId:%s)',connectionToModify.username, connectionToModify.userId, connectionToModify.authId);
						}
					});
					
				}
			}
			
		}
	
	});
	
}

function updateStats(sessionId,conferenceId,authId){
	var sqlInsert = 'INSERT INTO '+authId+'_conference_stats_conference (id_conference,added_on,num_participants) VALUES ( '+dbconnection.escape(conferenceId)+','+dbconnection.escape(mysqlTimestamp(new Date().getTime()))+','+dbconnection.escape(Object.size(sessionsMap[sessionId]))+')';
	
		dbconnection.query(sqlInsert, function(errInsert, resultInsert) {
		if(errInsert){
			logger.error('error:'+errInsert);
		}else{
			logger.debug('log numero utenti connessi');
		}
	});
	
}

/**
 * get a mysql date timestamp
 * @deprecated - Datepicker used instead
 * @param {Object} dateobj - a date
 */
function mysqlTimestamp( dateobj )
{
	var date = new Date( dateobj );
	var yyyy = date.getFullYear();
  var mm = date.getMonth() + 1;
  var dd = date.getDate();
  var hh = date.getHours();
  var min = date.getMinutes();
  var ss = date.getSeconds();
	
	var mysqlDateTime = yyyy + '-' + mm + '-' + dd + ' ' + hh + ':' + min + ':' + ss;
       
  return mysqlDateTime;
}

/////////////////
//	UTIL
/////////////////
/**
 * get associative array size
 * @param {Object} obj - an array
 */
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

