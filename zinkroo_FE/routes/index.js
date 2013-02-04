
var CONF_STATUS_DRAFT = '0';
var CONF_STATUS_READY = '1';
var CONF_STATUS_ONAIR = '2';
var CONF_STATUS_CLOSED = '-1';

var ROLE_MODERATOR = "moderator";
var ROLE_PUBLISHER = "publisher";
var ROLE_SUBSCRIBER = "subscriber";
var ROLE_DISCONNECTED = "disconnected";
var ROLE_BANNED = "banned";

var ROLE_TYPE_PUBLISHER = "5";
var ROLE_TYPE_SUBSCRIBER = "0";
var ROLE_TYPE_DISCONNECTED = "-1";
var ROLE_TYPE_BANNED = "-2";


var opentok = require('opentok')
  , OPENTOK_API_KEY = '11456902' // add your API key here
  , OPENTOK_API_SECRET = 'fc4c9562901b0a6e99126169c387d4627c7aaf22'; // and your secret here


// create a single instance of opentok sdk.
var ot = new opentok.OpenTokSDK(OPENTOK_API_KEY,OPENTOK_API_SECRET)

exports.sessionTerminated = function(req, res){
	logger.debug('sessionTerminated');
	res.render('end', { title: 'END', message: 'Sessione FINITA' });
}

exports.sessionClosed = function(req, res){
	logger.debug('sessionClosed');
	res.render('end', { title: 'END', message: 'Sessione CHIUSA' });
}

exports.ipad = function(req, res){
	logger.debug('ipad');
	var auth = req.query["auth"];
	var conferenceId = req.query["conferenceId"];
	var username = req.query["username"];
	var random_key = req.query["random_key"];

	routeTo('ipad', res, auth, conferenceId, username, random_key);
}

exports.index = function(req, res){

	var auth = req.body["auth"];
	var conferenceId = req.body["conferenceId"];
	var username = req.body["username"];
	var random_key = req.body["random_key"];
	
	routeTo('desktop', res, auth, conferenceId, username, random_key);
};


function routeTo(to, res, auth, conferenceId, username, random_key){

	if(auth==0){
		//vuole accedere alla conference come moderator
		//controllo che sia un moderatore
		var sql = 'SELECT id, group_id FROM users WHERE username = ' + dbconnection.escape(username)+' AND password='+ dbconnection.escape(random_key);
		dbconnection.query(sql, function(err, results) {
			if(err){
				logger.error('error='+err);
			 	res.render('errorpage', { title: 'ERROR', message: 'DB ERROR checking moderator' });
			}else{
				if(results[0]){
			  	var authId = results[0].id;
			  	//recupero conference tra le sue conferences
			  	var sqlConference = 'SELECT * FROM '+authId+'_conferences WHERE id = ' + dbconnection.escape(conferenceId);
			  	dbconnection.query(sqlConference, function(errConference, resultsConference) {
			  		if(errConference){
			  			res.render('errorpage', { title: 'ERROR', message: 'DB ERROR checking conference' });
			  		}else{

					  	if(resultsConference[0]){
					  		var confStatus = resultsConference[0].conf_status;					  							  		
					  		//controllo status conferenza
					  		switch(confStatus) { 
					  			case CONF_STATUS_DRAFT: 
								    //istruzioni
								    res.render('errorpage', { title: 'ERROR', message: 'Conferenza in stato bozza' });
									  break; //si ferma qui 

									case CONF_STATUS_READY: 
										//creazione sessione e aggiornamento db
										ot.createSession('localhost',{},function(sessionId){											
											var sqlUpdateSessionId = 'UPDATE '+authId+'_conferences SET video_session_id = '+dbconnection.escape(sessionId)+', conf_status = '+dbconnection.escape(CONF_STATUS_ONAIR)+' WHERE id = ' +dbconnection.escape(conferenceId);
											dbconnection.query(sqlUpdateSessionId, function(errUpdateSessionId, resultUpdateSessionId) {
												if (errUpdateSessionId){
													res.render('errorpage', { title: 'ERROR', message: 'DB ERROR updating sessionId' });
												}else{
													//creazione token e ingresso in conferenza
													var role = ROLE_MODERATOR;
										 			var token = ot.generateToken({
								            'connection_data': username,
								            'role': role
								          });
										 			getConferencesSlides(to, res, sessionId, token, username, role, authId, conferenceId);
												}											
											});
									 	});
									  break; //si ferma qui 

									case CONF_STATUS_ONAIR: 
									  //creazione token e ingresso in conferenza 
									  var sessionId = resultsConference[0].video_session_id;
									  var role = ROLE_MODERATOR;
									  var token = ot.generateToken({
					            'connection_data': username,
					            'role': role
					          });
									  getConferencesSlides(to, res, sessionId, token, username, role, authId, conferenceId);
									  break; //si ferma qui 

									case CONF_STATUS_CLOSED: 
									  //istruzioni 
									  res.render('errorpage', { title: 'ERROR', message: 'Conferenza chiusa' });
									  break; //si ferma qui 

									default: 
										//istruzioni 
										res.render('errorpage', { title: 'ERROR', message: 'Conferenza in stato indefinito' });
							  }

					  	}else{
						  	res.render('errorpage', { title: 'ERROR', message: 'Conferenza non esiste' });
					  	}
			  		}
			  	});
				}else{
			 			res.render('errorpage', { title: 'ERROR', message: 'BANNED' });
				}
			}
			
		});
		
		
	}else{
		//vuole accedere alla conference con altro ruolo (publisher o subscriber)
		//recupero dati partecipante da db
		var sqlParticipant = 'SELECT * FROM '+auth+'_conference_participants WHERE username = ' + dbconnection.escape(username)+' AND random_key='+ dbconnection.escape(random_key);
		dbconnection.query(sqlParticipant, function(errParticipant, resultsParticipant) {
			if(errParticipant){
				logger.error('error='+errParticipant);
			 	res.render('errorpage', { title: 'ERROR', message: 'DB ERROR recuperando dati partecipante' });
			}else{
				if(resultsParticipant[0]){
					var userId = resultsParticipant[0].id;
					var role = roleFromType(resultsParticipant[0].role_type);
					if(role == ROLE_BANNED){
						res.render('errorpage', { title: 'ERROR', message: 'Utente bannato' });
					}else if(role == ROLE_DISCONNECTED){
						res.render('errorpage', { title: 'ERROR', message: 'Utente disconnesso' });
					}else{
						//recupero dati conference
						var sqlConference = 'SELECT * FROM '+auth+'_conferences WHERE id = ' + dbconnection.escape(conferenceId);
				  	dbconnection.query(sqlConference, function(errConference, resultsConference) {
				  		if(errConference){
				  			res.render('errorpage', { title: 'ERROR', message: 'DB ERROR checking conference' });
				  		}else{
				  			if(resultsConference[0]){
				  				//controllo stato conference
				  				var confStatus = resultsConference[0].conf_status;
				  				var sessionId = resultsConference[0].video_session_id;
				  				switch(confStatus) {
						  			case CONF_STATUS_DRAFT: 
									    //istruzioni
									    res.render('errorpage', { title: 'ERROR', message: 'Conferenza in stato bozza' });
										  break; //si ferma qui 
				
						  			case CONF_STATUS_READY: 
									    //istruzioni
									    res.render('errorpage', { title: 'ERROR', message: 'Conferenza non ancora iniziata' });
										  break; //si ferma qui 
				
						  			case CONF_STATUS_ONAIR:						    
										  //creazione token e ingresso in conferenza 
										  var token = ot.generateToken({
						            'connection_data': username,
						            'role': role
						          });
										  getConferencesSlides(to, res, sessionId, token, username, role, auth, conferenceId, userId);
										  break; //si ferma qui 
				
						  			case CONF_STATUS_CLOSED: 
									    //istruzioni
									    res.render('errorpage', { title: 'ERROR', message: 'Conferenza chiusa' });
										  break; //si ferma qui 
				
										default: 
											//istruzioni 
											res.render('errorpage', { title: 'ERROR', message: 'Conferenza in stato indefinito' });
				  				}
				  				
				  			}else{
					  			res.render('errorpage', { title: 'ERROR', message: 'Conferenza non esiste' });
				  			}
				  		}
				  	});
					}
			  	
				}else{
			 			res.render('errorpage', { title: 'ERROR', message: 'Utente non associato alla conference' });
				}
			}
			
		});
		
	}
}

function getConferencesSlides(to, res, sessionId, token, username, role, authId, conferenceId, userId) {
	var sql = 'SELECT slid.id FROM '+authId+'_conference_displays disp, 1_presentation_slides slid WHERE slid.id_presentation = disp.item AND disp.id_conference = ' + dbconnection.escape(conferenceId) + ' ORDER BY slid.position ASC';
	dbconnection.query(sql, function(err, results) {
		if(err){
			logger.error('error='+err);
		 	res.render('errorpage', { title: 'ERROR', message: 'DB ERROR checking moderator' });
		}else{
		//es.. http://www.zinkroo.com/presentations/view_slide/2/1/normal
			var slidesPartialPath = new Array(); 
			for (i=0; i<results.length; i++){
				var currentPath = authId+'/'+results[i].id;
				slidesPartialPath.push(currentPath);
			}
			
			if(to=='ipad'){
				res.render('ipad', { title: 'Express' , apikey: OPENTOK_API_KEY, sessionId: sessionId, token: token, username: username, role: role, authId: authId, userId: userId, conferenceId: conferenceId, slidesPartialPath: slidesPartialPath });
			}else{
				res.render('index', { title: 'Express' , apikey: OPENTOK_API_KEY, sessionId: sessionId, token: token, username: username, role: role, authId: authId, userId: userId, conferenceId: conferenceId, slidesPartialPath: slidesPartialPath });
			}
			
		}
	});
}

//UTIL
function roleFromType(roleType){
	var role;
	switch(roleType) {
		case ROLE_TYPE_SUBSCRIBER: 
	    //istruzioni
	    role = ROLE_SUBSCRIBER;
		  break; //si ferma qui 

		case ROLE_TYPE_PUBLISHER: 
	    //istruzioni
	    role = ROLE_PUBLISHER;
		  break; //si ferma qui 

		case ROLE_TYPE_DISCONNECTED: 
	    //istruzioni
	    role = ROLE_DISCONNECTED;
		  break; //si ferma qui 

		case ROLE_TYPE_BANNED: 
	    //istruzioni
	    role = ROLE_BANNED;
		  break; //si ferma qui 

		default: 
			//istruzioni 
	    role = ROLE_SUBSCRIBER;
	}
	
	return role;
}

