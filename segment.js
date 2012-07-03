function Segment(tl, start, end, t, i) {
	var cue = (start instanceof WebVTT.Cue)?start:new WebVTT.Cue(i, start, end, t);
	
	this.tl = tl;
	this.cue = cue;
	this.selected = false;
	this.move = false;
	this.resize = false;
	this.deleted = false;
	this.selectable = true;
	this.track = null;
	this.moveEvent = null;
	this.contentId = -1;
	this.parentId = -1;
	this.resizeSide = 0;

	// For mouse control
	this.mouseDownPos = {x: 0, y:0};
	this.startingPos = 0;
	this.startingLength = 0;
}

Object.defineProperties(Segment.prototype,{
	active: {
		get: function(){
			var mark = this.tl.timeMarkerPos;
			return mark > this.cue.startTime && mark < this.cue.endTime;
		},enumerable: true
	},
	id: {
		set: function(id){return this.cue.id = id;},
		get: function(){return this.cue.id;},
		enumerable: true
	},
	startTime: {
		set: function(t){return this.cue.startTime = t;},
		get: function(){return this.cue.startTime;},
		enumerable: true
	},
	endTime: {
		set: function(t){return this.cue.endTime = t;},
		get: function(){return this.cue.endTime;},
		enumerable: true
	},
	text: {
		set: function(t){
			var tl = this.tl,
				cue = this.cue;
			if(cue.text == t){ return t; }
			tl.tracker.addEvent(new TimelineEvent("update",{
				id:cue.id,
				track:this.track,
				initialText:cue.text,
				finalText:t
			}));
			cue.text = t;
			tl.renderTrack(this.track);
			tl.emit('update');
			return t;
		},
		get: function(){return this.cue.text;},
		enumerable: true
	}
});

Segment.order = function(a,b){
	//sort first by start time, then by length
	return (a.startTime - b.startTime) || (b.endTime - a.endTime);
};

Segment.prototype.toVTT = function(){
	return this.deleted?"":this.cue.toVTT();
};

Segment.prototype.toSRT = function(){
	return this.deleted?"":this.cue.toSRT();
};

// Location computation
Segment.prototype.getShape = function() {
	var tl = this.tl,
		x = tl.timeToPixel(this.startTime),
		y = tl.getTrackTop(this.track),
		width = tl.timeToPixel(this.endTime) - x;
	return {x: x, y: y, width: width, height: tl.segmentTrackHeight};
};

Segment.prototype.containsPoint = function(pos) {
	var s = this.getShape();
	return (pos.x >= s.x && pos.x <= s.x + s.width && pos.y >= s.y && pos.y <= s.y + s.height);
};

Segment.prototype.getMouseSide = function(pos) {
	// Get the x and width
	var shape = this.getShape();
	return (pos.x < shape.x + (shape.width/2))?-1:1;
};

Segment.prototype.mouseDown = function(pos) {
	if(this.deleted || !this.selectable)
		return;
		
	this.mouseDownPos = pos;
	this.startingPos = this.tl.timeToPixel(this.startTime);
	this.startingLength = this.endTime - this.startTime;
			
	switch(this.tl.currentTool){
		case Timeline.SELECT:
			if(this.selected){ this.tl.unselect(); }
			else{ this.tl.select(this); }
			break;
		case Timeline.MOVE:
			this.move = true;    
			this.moveEvent = new TimelineEvent("move",{
				id:this.id||this.text,
				track:this.track,
				initialStart:this.startTime,
				initialEnd:this.endTime
			});
			break;
		case Timeline.RESIZE:
			this.moveEvent = new TimelineEvent("resize",{
				id:this.id||this.text,
				track:this.track,
				initialStart:this.startTime,
				initialEnd:this.endTime
			});
			this.resizeSide = this.getMouseSide(pos);
	}
};

Segment.prototype.mouseUp = function(pos) {
	if(this.deleted || !this.selectable)
		return;
	
	var tl = this.tl;
	
	switch(tl.currentTool) {
		case Timeline.MOVE:
			this.move = false;
			
			// Save the move
			this.moveEvent.attributes.finalStart = this.startTime;
			this.moveEvent.attributes.finalEnd = this.endTime;
			tl.tracker.addEvent(this.moveEvent);
			tl.emit('update');
			tl.tracks[tl.trackIndices[this.track]].segments.sort(Segment.order);
			break;
		case Timeline.DELETE:
			// Delete tool
			this.deleted = true;
			
			// Save the delete
			tl.tracker.addEvent(new TimelineEvent("delete",{
				id:this.id,
				track:this.track
			}));
			tl.selectedSegment = null;
			tl.render();
			tl.emit('update');
			break;
		case Timeline.RESIZE:
			this.resizeSide = 0;
			// Save the resize
			this.moveEvent.attributes.finalStart = this.startTime;
			this.moveEvent.attributes.finalEnd = this.endTime;
			tl.tracker.addEvent(this.moveEvent);
			tl.emit('update');
			tl.tracks[this.track].segments.sort(Segment.order);
	}
};

Segment.prototype.mouseMove = function(pos) {
	if(this.deleted || !this.selectable)
		return;
	
	var tl = this.tl,
		activeStart, newTime, maxStartTime;
	
	if(this.move){
		activeStart = this.active;
		
		newTime = tl.pixelToTime(this.startingPos + pos.x - this.mouseDownPos.x);
		maxStartTime = tl.length - this.startingLength;
		
		if(newTime < 0){ newTime = 0; }
		else if(newTime > maxStartTime){ newTime = maxStartTime; }
		
		this.startTime = newTime;
		this.endTime = newTime + this.startingLength;
				
	}else if(this.resizeSide == -1){
		activeStart = this.active;
		
		newTime = tl.pixelToTime(this.startingPos + pos.x - this.mouseDownPos.x);
		
		if(newTime < 0){ newTime = 0; }
		else if(newTime >= this.endTime){ newTime = this.endTime - 10; }
		
		this.startTime = newTime;
				
	}else if(this.resizeSide == 1){
		activeStart = this.active;
		
		newTime = this.tl.pixelToTime(this.startingPos + pos.x - this.mouseDownPos.x) + this.startingLength;
		if(newTime <= this.startTime){ newTime = this.startTime + 10; }
		else if(newTime > tl.length){ newTime = tl.length; }
		
		this.endTime = newTime;
		
	}else{ return; }
	
	tl.renderTrack(this.track);
	if(activeStart != this.active){ tl.updateCurrentSegments(); }
};

// Rendering
Segment.prototype.render = function() {
	if(this.deleted)
		return;

	var tl = this.tl,
		ctx = tl.ctx,
		shape = this.getShape();
		
	// is it on the screen
	if(shape.x + shape.width >= tl.view.startPixel && shape.x <= tl.view.endPixel) {

		ctx.save();
		ctx.font = this.tl.segmentFontSize + ' sans-serif';
		ctx.textBaseline = 'top';
		
		if(this.selected){
			this.renderImage(shape, tl.segmentLeftSel, tl.segmentRightSel, tl.segmentMidSel);
		}else if(!this.selectable){
			this.renderImage(shape, tl.segmentLeftDark, tl.segmentRightDark, tl.segmentMidDark);
		}else{
			this.renderImage(shape, tl.segmentLeft, tl.segmentRight, tl.segmentMid);
		}
		// Set the clipping bounds
		ctx.beginPath();
		ctx.moveTo(shape.x, shape.y);
		ctx.lineTo(shape.x, shape.y + shape.height);
		ctx.lineTo(shape.x + shape.width - tl.segmentFontPadding, shape.y + shape.height);
		ctx.lineTo(shape.x + shape.width - tl.segmentFontPadding, shape.y);
		ctx.closePath();
		ctx.clip();
		
		ctx.fillStyle = tl.segmentTextColor;
		ctx.fillText(this.text, shape.x + (	tl.direction == "ltr"?
											tl.segmentFontPadding:
											shape.width - tl.segmentFontPadding	),
								shape.y + tl.segmentFontPadding	);
					
		ctx.restore();
	}else{
		debugger;
	}
};
	
Segment.prototype.renderImage = function(shape, imageLeft, imageRight, imageMid) {
	var ctx = this.tl.ctx;
	if(shape.width < 1){
		ctx.drawImage(imageMid, shape.x, shape.y, 1, shape.height);
	}else if(shape.width < 8){
		ctx.drawImage(imageMid, shape.x, shape.y, shape.width, shape.height);
	}else{
		ctx.drawImage(imageLeft, shape.x, shape.y);
		ctx.drawImage(imageRight, shape.width + shape.x - 4, shape.y);
		ctx.drawImage(imageMid, shape.x + 4, shape.y, shape.width - 8, shape.height);
	}
};