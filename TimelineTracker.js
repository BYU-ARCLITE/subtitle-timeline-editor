var TimelineTracker = (function(){
	"use strict";
	function TimelineTracker(tl) {
		this.tl = tl;
		this.events = [];
		this.addEvent = function(event) {
			this.events.push(event);
			
			// Debug
			this.updateDebug();
		}
		this.target = "ajax/saver.php";
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function(){
			if (xmlhttp.readyState==4){
				if(xmlhttp.status>=200 &&  xmlhttp.status<400){
					this.saveSuccess(xmlhttp.responseText);
				}else{
					this.saveError(xmlhttp.responseText);
				}
			}
		};
		// Save functions
		this.save = function() {
			xmlhttp.open("POST",this.target,true);
			xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
			xmlhttp.send("json="+encodeURIComponent(JSON.stringify(consolidateEvents.call(this))).replace(/%20/g,'+'));
		};
	}

	function consolidateEvents() {
		var i, e, s, sum,
			tempEvents = {};
		for(i=0;e=this.events[i];i++) {
			// Update the event summary
			if(e.attributes.id in tempEvents){
				sum = tempEvents[e.attributes.id];
				switch(e.type){
					case "resize":
					case "move":
						sum.finalStart = e.attributes.finalStart;
						sum.finalEnd = e.attributes.finalEnd;
						break;
					case "create":
						sum.initialStart = e.attributes.startTime;
						sum.initialEnd = e.attributes.endTime;
						sum.created = true;
						break;
					case "delete":
						sum.deleted = true;
						break;
					case "update":
						sum.finalText = e.attributes.finalText;
						break;
				}
			}else{
				s = this.tl.getTrack(e.attributes.track).getSegment(e.attributes.id);
				sum = {
					id: s.id,
					track: s.track,
					language: s.track.language
				};
				tempEvents[e.attributes.id] = sum;
				switch(e.type){
					case "resize":
					case "move":
						sum.initialStart = e.attributes.initialStart;
						sum.initialEnd = e.attributes.initialEnd;
						break;
					case "create":
						sum.initialStart = e.attributes.startTime;
						sum.initialEnd = e.attributes.endTime;
						sum.created = true;
						break;
					case "delete":
						sum.deleted = true;
						break;
					case "update":
						sum.initialText = e.attributes.initialText;
						break;
				}
			}
		}
		for(var i in tempEvents) {
			e = tempEvents[i];
			if(e.deleted && e.created)
				delete tempEvents[i];
		}		
		return tempEvents;
	};

	TimelineTracker.prototype.saveSuccess = function(data){
		this.events = [];
		this.updateDebug();
	};

	TimelineTracker.prototype.saveError = function(data) {
		alert("An error was encountered while saving: " + data);
	};

	// Update functions
	TimelineTracker.prototype.undo = function() {
		var e, s, track;
		if(this.events.length == 0)
			return;

		e = this.events.pop();
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
			case "update":
				s.cue.text = e.attributes.initialText;
				break;
		}
		
		this.tl.renderTrack(track);
		
		// Debug
		this.updateDebug();
	};

	// Debug functions
	TimelineTracker.prototype.updateDebug = function(text) {
		if(this.debugElement){
			this.debugElement.innerHTML = text || this.toString();
		}
	};

	TimelineTracker.prototype.toString = function() {
		var s = "<pre>Events:\n";
		for(var i in this.events) {
			var e = this.events[i];
			s += e.toString("\t");
		}
		s += "</pre>";
		return s;
	};
	
	return TimelineTracker;
}());