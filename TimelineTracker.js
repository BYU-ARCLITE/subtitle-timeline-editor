(function(Timeline){
	"use strict";
	var Proto;
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function Tracker(tl) {
		this.tl = tl;
		this.events = [];
		this.index = -1;
	}

	Proto = Tracker.prototype;
	
	Proto.addAction = function(evt) {
		this.events[++this.index] = evt;
		if(this.events.length > this.index+1){
			this.events.length = this.index;
		}
		console.log(this.events,this.index);
		this.updateDebug();
	};
	
	Proto.undo = function() {
		var e, s, track;
		if(this.index === -1)
			return;

		e = this.events[this.index--];
		track = this.tl.getTrack(e.attributes.track);
		s = track.getSegment(e.attributes.id);
		switch(e.type){
			case "resize":
			case "move":
				s.startTime = e.attributes.initialStart;
				s.endTime = e.attributes.initialEnd;
				break;
			case "create":
				s.deleted = true;
				break;
			case "delete":
				s.deleted = false;
				break;
			case "changetext":
				s.cue.text = e.attributes.initialText;
				break;
			case "changeid":
				s.cue.id = e.attributes.initialId;
				break;
		}
		
		this.tl.renderTrack(track);
		this.tl.emit('update',s);
		this.tl.updateCurrentSegments();
		console.log(this.events,this.index);
		this.updateDebug();
	};

	Proto.redo = function() {
		var e, s, track;
		if(this.index >= this.events.length)
			return;

		e = this.events[++this.index];
		track = this.tl.getTrack(e.attributes.track);
		s = track.getSegment(e.attributes.id);
		switch(e.type){
			case "resize":
			case "move":
				s.startTime = e.attributes.finalStart;
				s.endTime = e.attributes.finalEnd;
				break;
			case "create":
				s.deleted = false;
				break;
			case "delete":
				s.deleted = true;
				break;
			case "changetext":
				s.cue.text = e.attributes.finalText;
				break;
			case "changeid":
				s.cue.id = e.attributes.finalId;
				break;
		}
		
		this.tl.renderTrack(track);
		this.tl.emit('update',s);
		this.tl.updateCurrentSegments();
		console.log(this.events,this.index);
		this.updateDebug();
	};
	
	// Debug functions
	Proto.updateDebug = function(text) {
		if(this.debugElement){
			this.debugElement.innerHTML = text || this.toString();
		}
	};

	Proto.toString = function() {
		var i, s = "<pre>Events:\n";
		for(i in this.events) {
			s += this.events[i].toString("\t");
		}
		s += "</pre>";
		return s;
	};
	
	Timeline.Tracker = Tracker;
}(Timeline));