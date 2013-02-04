

exports.sessionTerminated = function(req, res){
	console.log('in routes index');
	res.render('endsession', { message: 'Sessione FINITA' });
}

exports.sessionClosed = function(req, res){
	console.log('in routes index');
	res.render('endsession', { message: 'Sessione CHIUSA' });
}
