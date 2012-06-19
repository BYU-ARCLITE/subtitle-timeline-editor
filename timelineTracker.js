function TimelineTracker() {
	this.events = new Array();
	this.addEvent = function(event) {
		this.events.push(event);
		
		// Debug
		this.updateDebug();
	}
	
	// Save functions
	this.save = function() {
		var t = timelineGlobal.tracker;
		var eventsJson = JSON.stringify(t.consolodateEvents());
		
		// Call the PHP script to save
		$.ajax({ type: "POST",
			url: "ajax/saver.php",
			data: {json: eventsJson},
			async: true,
			dataType: "text",
			success: t.saveSuccess,
			error: t.saveError
		});
	}
	this.consolodateEvents = function() {
		var cEvents = new Array();
		var tempEvents = {};
		for(var i in this.events) {
			var e = this.events[i];
			
			// Update the event summary
			var sum = tempEvents["e"+e.attributes.id];
			if(sum == undefined) {
				var s = timelineGlobal.elements[e.attributes.track][e.attributes.id];
				sum = {
					id: s.id,
					track: s.track,
					contentId: s.contentId,
					parent: timelineGlobal.trackIds[s.track],
					language: timelineGlobal.trackLangs[s.track],
					text: s.text
				};
			}
			if(e.type == "move") {
				sum.start = e.attributes.finalStart;
				sum.end = e.attributes.finalEnd;
			}
			if(e.type == "create") {
				sum.start = e.attributes.startTime;
				sum.end = e.attributes.endTime;
				sum.created = true;
			}
			if(e.type == "delete")
				sum.deleted = true;
			if(e.type == "update")
				sum.text = e.attributes.finalText;
			if(e.type == "resize") {
				sum.start = e.attributes.finalStart;
				sum.end = e.attributes.finalEnd;
			}
			tempEvents["e"+e.attributes.id] = sum;
		}
		for(var i in tempEvents) {
			var e = tempEvents[i];
			if(e.deleted && e.created)
				continue;
			cEvents.push(e);
		}		
		return cEvents;
	}
	this.saveSuccess = function(data) {
		// Parse the results
		// alert(data);
		//var results = eval('(' + data + ')');
		for(var i in results) {
			// Set the new ContentIDs
			var r = results[i];
			timelineGlobal.elements[r.track][r.id].contentId = r.ContentID;
		}
	
		var t = timelineGlobal.tracker;
		t.events = new Array();
		t.updateDebug();
	}
	this.saveError = function(data) {
		alert("An error was encountered while saving: " + data);
	}
	
	// Update functions
	this.undo = function() {
		var t = timelineGlobal.tracker;
		if(t.events.length == 0)
			return;
	
		var e = t.events.pop();
		
		if(e.type == "move")
			t.undoMove(e);
		if(e.type == "create")
			t.undoCreate(e);
		if(e.type == "delete")
			t.undoDelete(e);
		if(e.type == "update")
			t.undoUpdate(e);
		if(e.type == "resize")
			t.undoResize(e);
		
		// Debug
		t.updateDebug();
	}
	this.undoMove = function(e) {
		var s = timelineGlobal.elements[e.attributes.track][e.attributes.id];
		s.startTime = e.attributes.initialStart;
		s.endTime = e.attributes.initialEnd;
		timelineGlobal.render();
	}
	this.undoCreate = function(e) {
		var s = timelineGlobal.elements[e.attributes.track][e.attributes.id];
		s.deleted = true;
		timelineGlobal.render();
	}
	this.undoDelete = function(e) {
		var s = timelineGlobal.elements[e.attributes.track][e.attributes.id];
		s.deleted = false;
		timelineGlobal.render();
	}
	this.undoUpdate = function(e) {
		var s = timelineGlobal.elements[e.attributes.track][e.attributes.id];
		s.text = e.attributes.initialText;
		timelineGlobal.render();
	}
	this.undoResize = function(e) {
		var s = timelineGlobal.elements[e.attributes.track][e.attributes.id];
		s.startTime = e.attributes.initialStart;
		s.endTime = e.attributes.initialEnd;
		timelineGlobal.render();
	}
	
	// Debug functions
	this.updateDebug = function(text) {
		if(text == undefined)
			text = this.toString();
		// $("#canvasEditorDebug").html(text);
	}
	
	this.toString = function() {
		var s = "<pre>Events:\n";
		for(var i in this.events) {
			var e = this.events[i];
			s += e.toString("\t");
		}
		s += "</pre>";
		return s;
	}
}