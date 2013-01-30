var ROLE_MODERATOR = 'moderator';
var ROLE_PUBLISHER = 'publisher';

var bridge;

/* var stateManager; */
/* var isNewChatConnection = true; //usata per non duplicare, ad ogni riconnessione, l'ultima frase scritta */

var publisher;

var hasSlideControl = false;
var audioEnabled;


Array.prototype.contains = function (element) {
	for (var i = 0; i < this.length; i++) {
	console.log(i+'-->'+this[i]);
		if (this[i] == element) {
			return true;
		}
	}
	return false;
}