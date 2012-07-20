(function(Timeline){
	"use strict";
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function Action(type, attrs) {
		this.type = type;
		this.attributes = attrs;
		this.time = +(new Date);
	}

	Action.prototype.toString = function(prepend) {
		var s = prepend + "type: " + this.type + "\n";
		s += prepend + "time: " + this.time + "\n";
		for(var key in this.attributes) if(this.attributes.hasOwnProperty(key)) {
			var value = this.attributes[key];
			s += prepend + key + ": " + value + "\n";
		}
		return s + "\n";
	};
	
	Timeline.Action = Action;
}(Timeline));