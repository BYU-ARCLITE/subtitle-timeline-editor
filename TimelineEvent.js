var TimelineEvent = (function(){
	function TimelineEvent(eventType, attrs) {
		this.type = eventType;
		this.attributes = attrs;
		this.time = +(new Date);
	}

	TimelineEvent.prototype.toString = function(prepend) {
		var s = prepend + "type: " + this.type + "\n";
		s += prepend + "time: " + this.time + "\n";
		for(var key in this.attributes) if(this.attributes.hasOwnProperty(key)) {
			var value = this.attributes[key];
			s += prepend + key + ": " + value + "\n";
		}
		return s + "\n";
	};
	
	return TimelineEvent;
}());