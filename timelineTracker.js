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
		xmlhttp.send("json="+encodeURIComponent(JSON.stringify(this.consolidateEvents())).replace(/%20/g,'+'));
	};
}

TimelineTracker.prototype.consolidateEvents = function() {
	var cEvents = [];
	var tempEvents = {};
	for(var i in this.events) {
		var e = this.events[i];
		
		// Update the event summary
		var sum = tempEvents["e"+e.attributes.id];
		if(sum == undefined) {
			var s = this.tl.tracks[e.attributes.track][e.attributes.id];
			sum = {
				id: s.id,
				track: s.track,
				contentId: s.contentId,
				parent: s.track,
				language: this.tl.trackLangs[s.track],
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
};

TimelineTracker.prototype.saveSuccess = function(data) {
	// Parse the results
	// alert(data);
	//var results = eval('(' + data + ')');
	for(var i in results) {
		// Set the new ContentIDs
		var r = results[i];
		this.tl.tracks[r.track][r.id].contentId = r.ContentID;
	}
	this.events = [];
	this.updateDebug();
};

TimelineTracker.prototype.saveError = function(data) {
	alert("An error was encountered while saving: " + data);
};

// Update functions
TimelineTracker.prototype.undo = function() {
	var t = this.tl.tracker;
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
};
TimelineTracker.prototype.undoMove = function(e) {
	var s = this.tl.tracks[e.attributes.track][e.attributes.id];
	s.startTime = e.attributes.initialStart;
	s.endTime = e.attributes.initialEnd;
	this.tl.render();
};
TimelineTracker.prototype.undoCreate = function(e) {
	var s = this.tl.tracks[e.attributes.track][e.attributes.id];
	s.deleted = true;
	this.tl.render();
};
TimelineTracker.prototype.undoDelete = function(e) {
	var s = this.tl.tracks[e.attributes.track][e.attributes.id];
	s.deleted = false;
	this.tl.render();
};
TimelineTracker.prototype.undoUpdate = function(e) {
	var s = this.tl.tracks[e.attributes.track][e.attributes.id];
	s.text = e.attributes.initialText;
	this.tl.render();
};
TimelineTracker.prototype.undoResize = function(e) {
	var s = this.tl.tracks[e.attributes.track][e.attributes.id];
	s.startTime = e.attributes.initialStart;
	s.endTime = e.attributes.initialEnd;
	this.tl.render();
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