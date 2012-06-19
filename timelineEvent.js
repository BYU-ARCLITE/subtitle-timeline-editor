function TimelineEvent(eventType) {
	this.type = eventType;
	this.attributes = {};
	this.time = new Date().getTime();
	
	this.toString = function(prepend) {
		var s = prepend + "type: " + this.type + "\n";
		s += prepend + "time: " + this.time + "\n";
		for(var key in this.attributes) {
			var value = this.attributes[key];
			s += prepend + key + ": " + value + "\n";
		}
		return s + "\n";
	}
}