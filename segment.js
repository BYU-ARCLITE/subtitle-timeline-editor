function Segment(tl, start, end, t, i) {
	var cue = (start instanceof WebVTT.Cue)?start:new WebVTT.Cue(i, start, end, t);
	Object.defineProperties(this,{
		id: {
			set: function(id){return cue.id = id;},
			get: function(){return cue.id;},
			enumerable: true
		},
		startTime: {
			set: function(t){return cue.startTime = t/1000;},
			get: function(){return cue.startTime*1000;},
			enumerable: true
		},
		endTime: {
			set: function(t){return cue.endTime = t/1000;},
			get: function(){return cue.endTime*1000;},
			enumerable: true
		},
		text: {
			set: function(t){return cue.text = t;},
			get: function(){return cue.text;},
			enumerable: true
		}
	});
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

Segment.prototype.toVTT = function(){
	return this.cue.toVTT();
};

Segment.prototype.toSRT = function(){
	return this.cue.toSRT();
};

// Location computation
Segment.prototype.getShape = function() {
	var x = this.tl.timeToPixel(this.startTime);
	// var y = this.tl.keyHeight + this.tl.segmentTrackPadding + ((this.track - 1) * (this.tl.segmentTrackPadding + this.tl.segmentTrackHeight));
	var y = this.tl.getTrackTop(this.track);
	var width = this.tl.timeToPixel(this.endTime) - x;
	return {x: x, y: y, width: width, height: this.tl.segmentTrackHeight};
};

Segment.prototype.containsPoint = function(pos) {
	var s = this.getShape();
	return (pos.x >= s.x && pos.x <= s.x + s.width && pos.y >= s.y && pos.y <= s.y + s.height);
};

Segment.prototype.getMouseSide = function(pos) {
	// Get the x and width
	var shape = this.getShape();
	if(pos.x < shape.x + (shape.width/2))
		return -1;
	return 1;
};

Segment.prototype.select = function() {
	this.selected = false;
	this.toggleSelect();
};

Segment.prototype.toggleSelect = function() {
	if(this.selected == true) {
		this.tl.unselect();
	} else {
		this.tl.select(this);
	}
	this.tl.render();
};

Segment.prototype.mouseDown = function(pos) {
	if(this.deleted || !this.selectable)
		return;
		
	this.mouseDownPos = pos;
	this.startingPos = this.tl.timeToPixel(this.startTime);
	this.startingLength = this.endTime - this.startTime;
			
	if(buttonController.currentTool == 2) { // moving
		this.move = true;    
		this.moveEvent = new TimelineEvent("move");
		this.moveEvent.attributes.initialStart = this.startTime;
		this.moveEvent.attributes.initialEnd = this.endTime;
		this.moveEvent.attributes.id = this.id;
		this.moveEvent.attributes.track = this.track;
	}
	if(buttonController.currentTool == 5) { // resizing
		this.moveEvent = new TimelineEvent("resize");
		this.moveEvent.attributes.initialStart = this.startTime;
		this.moveEvent.attributes.initialEnd = this.endTime;
		this.moveEvent.attributes.id = this.id;
		this.moveEvent.attributes.track = this.track;
		this.resizeSide = this.getMouseSide(pos);
	}
};

Segment.prototype.mouseUp = function(pos) {
	if(this.deleted || !this.selectable)
		return;
	
	switch(buttonController.currentTool) {
		case 1:
			// Selector tool
			if(this.containsPoint(pos))
				this.toggleSelect();
			break;
		case 2:
			// Move Tool
			this.move = false;
			
			// Save the move
			this.moveEvent.attributes.finalStart = this.startTime;
			this.moveEvent.attributes.finalEnd = this.endTime;
			this.tl.tracker.addEvent(this.moveEvent);
			
			this.tl.emit('update');
			
			break;
		case 3:
			// Add tool
			break;
		case 4:
			// Delete tool
			this.deleted = true;
			
			// Save the delete
			var e = new TimelineEvent("delete");
			e.attributes.id = this.id;
			e.attributes.track = this.track;
			this.tl.tracker.addEvent(e);
			
			this.tl.selectedSegment = null;
			this.tl.render();
			this.tl.emit('update');
			break;
		case 5:
			// Resize tool
			this.resizeSide = 0;
			
			// Save the resize
			this.moveEvent.attributes.finalStart = this.startTime;
			this.moveEvent.attributes.finalEnd = this.endTime;
			this.tl.tracker.addEvent(this.moveEvent);
			
			this.tl.emit('update');
	}
};

Segment.prototype.mouseMove = function(pos) {
	if(this.deleted || !this.selectable)
		return;
	
	if(this.move) {
		var x = this.startingPos + pos.x - this.mouseDownPos.x;
		var newStartTime = this.tl.pixelToTime(x);
		if(newStartTime < 0)
			newStartTime = 0;
		if(newStartTime + this.startingLength > this.tl.length)
			newStartTime = this.tl.length - this.startingLength;
		this.startTime = newStartTime;
		this.endTime = this.startTime + this.startingLength;
		
		this.tl.render();
		this.tl.emit('update');
	}
	if(this.resizeSide == -1) {
		var x = this.startingPos + pos.x - this.mouseDownPos.x;
		var newStartTime = this.tl.pixelToTime(x);
		if(newStartTime < 0)
			newStartTime = 0;
		if(newStartTime >= this.endTime)
			newStartTime = this.endTime - 10;
		this.startTime = newStartTime;
		
		this.tl.render();
		this.tl.update();
	}
	if(this.resizeSide == 1) {
		var x = this.startingPos + pos.x - this.mouseDownPos.x;
		var newEndTime = this.tl.pixelToTime(x) + this.startingLength;
		if(newEndTime <= this.startTime)
			newEndTime = this.startTime + 10;
		if(newEndTime > this.tl.length)
			newEndTime = this.tl.length;
		this.endTime = newEndTime;
		
		this.tl.render();
		this.tl.emit('update');
	}
};

// Rendering
Segment.prototype.render = function() {
	if(this.deleted)
		return;

	this.tl.ctx.font = this.tl.segmentFontSize + ' sans-serif';
	this.tl.ctx.textBaseline = 'top';

	var shape = this.getShape();
		
	// is in on the screen
	if(shape.x + shape.width >= this.tl.view.startPixel && shape.x <= this.tl.view.endPixel) {
		if(this.selected)
			this.renderImage(shape, this.tl.segmentLeftSel, this.tl.segmentRightSel, this.tl.segmentMidSel);
		else if(!this.selectable)
			this.renderImage(shape, this.tl.segmentLeftDark, this.tl.segmentRightDark, this.tl.segmentMidDark);
		else
			this.renderImage(shape, this.tl.segmentLeft, this.tl.segmentRight, this.tl.segmentMid);
		
		// Set the clipping bounds
		this.tl.ctx.save();
		this.tl.ctx.beginPath();
		this.tl.ctx.moveTo(shape.x, shape.y);
		this.tl.ctx.lineTo(shape.x, shape.y + shape.height);
		this.tl.ctx.lineTo(shape.x + shape.width - this.tl.segmentFontPadding, shape.y + shape.height);
		this.tl.ctx.lineTo(shape.x + shape.width - this.tl.segmentFontPadding, shape.y);
		this.tl.ctx.closePath();
		this.tl.ctx.clip();
		
		this.tl.ctx.fillStyle = this.tl.segmentTextColor;

		if(this.tl.direction == "ltr") {
			this.tl.ctx.fillText(this.text, shape.x + this.tl.segmentFontPadding, shape.y + this.tl.segmentFontPadding);
		} else {
			this.tl.ctx.fillText(this.text, shape.x + shape.width - this.tl.segmentFontPadding, shape.y + this.tl.segmentFontPadding);
		}
					
		this.tl.ctx.restore();
	}else{
		throw "Segment Offscreen";
	}
};
	
Segment.prototype.renderImage = function(shape, imageLeft, imageRight, imageMid)  {
	if(shape.width < 1)
		this.tl.ctx.drawImage(imageMid, shape.x, shape.y, 1, shape.height);
	else if(shape.width < 8)
		this.tl.ctx.drawImage(imageMid, shape.x, shape.y, shape.width, shape.height);
	else {
		this.tl.ctx.drawImage(imageLeft, shape.x, shape.y);
		this.tl.ctx.drawImage(imageRight, shape.width + shape.x - 4, shape.y);
		this.tl.ctx.drawImage(imageMid, shape.x + 4, shape.y, shape.width - 8, shape.height);
	}
};