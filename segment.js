function Segment(start, end, t, i) {
	this.endTime = end;
	this.startTime = start;
	this.text = t;
	this.id = i;
	this.selected = false;
	this.move = false;
	this.resize = false;
	this.deleted = false;
	this.selectable = true;
	this.track = 0;
	this.moveEvent = null;
	this.contentId = -1;
	this.parentId = -1;
	this.resizeSide = 0;

	// Location computation
	this.getShape = function() {
		var x = timeFunctions.timeToPixel(this.startTime);
		// var y = timelineGlobal.keyHeight + timelineGlobal.segmentTrackPadding + ((this.track - 1) * (timelineGlobal.segmentTrackPadding + timelineGlobal.segmentTrackHeight));
		var y = timelineGlobal.getTrackTop(this.track);
		var width = timeFunctions.timeToPixel(this.endTime) - x;
		return {x: x, y: y, width: width, height: timelineGlobal.segmentTrackHeight};
	}
	
	this.containsPoint = function(pos) {
		var s = this.getShape();
		return (pos.x >= s.x && pos.x <= s.x + s.width && pos.y >= s.y && pos.y <= s.y + s.height);
	}
	
	this.getMouseSide = function(pos) {
		// Get the x and width
		var shape = this.getShape();
		if(pos.x < shape.x + (shape.width/2))
			return -1;
		return 1;
	}
	
	// For mouse control
	this.mouseDownPos = {x: 0, y:0};
	this.startingPos = 0;
	this.startingLength = 0;
	
	this.select = function() {
		this.selected = false;
		this.toggleSelect();
	}
	
	this.toggleSelect = function() {
		if(this.selected == true) {
			this.selected = false;
			timelineGlobal.selectedSegment = null;
                        timelineGlobal.unselectCallback();
		} else {
			if(timelineGlobal.selectedSegment != null)
				timelineGlobal.selectedSegment.selected = false;
			timelineGlobal.selectedSegment = this;
			this.selected = true;
			timelineGlobal.getTextCallback(this.text);
		}
		timelineGlobal.render();
	}
	
	this.mouseDown = function(pos) {
		if(this.deleted || !this.selectable)
			return;
			
		this.mouseDownPos = pos;
		this.startingPos = timeFunctions.timeToPixel(this.startTime);
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
	}
	
	this.mouseUp = function(pos) {
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
				timelineGlobal.tracker.addEvent(this.moveEvent);
				
				timelineGlobal.update();
				
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
				timelineGlobal.tracker.addEvent(e);
				
				timelineGlobal.selectedSegment = null;
				timelineGlobal.render();
				timelineGlobal.update();
				break;
			case 5:
				// Resize tool
				this.resizeSide = 0;
				
				// Save the resize
				this.moveEvent.attributes.finalStart = this.startTime;
				this.moveEvent.attributes.finalEnd = this.endTime;
				timelineGlobal.tracker.addEvent(this.moveEvent);
				
				timelineGlobal.update();
		}
	}
	
	this.mouseMove = function(pos) {
		if(this.deleted || !this.selectable)
			return;
		
		if(this.move) {
			var x = this.startingPos + pos.x - this.mouseDownPos.x;
			var newStartTime = timeFunctions.pixelToTime(x);
			if(newStartTime < 0)
				newStartTime = 0;
			if(newStartTime + this.startingLength > timelineGlobal.length)
				newStartTime = timelineGlobal.length - this.startingLength;
			this.startTime = newStartTime;
			this.endTime = this.startTime + this.startingLength;
			
			timelineGlobal.render();
			timelineGlobal.update();
		}
		if(this.resizeSide == -1) {
			var x = this.startingPos + pos.x - this.mouseDownPos.x;
			var newStartTime = timeFunctions.pixelToTime(x);
			if(newStartTime < 0)
				newStartTime = 0;
			if(newStartTime >= this.endTime)
				newStartTime = this.endTime - 10;
			this.startTime = newStartTime;
			
			timelineGlobal.render();
			timelineGlobal.update();
		}
		if(this.resizeSide == 1) {
			var x = this.startingPos + pos.x - this.mouseDownPos.x;
			var newEndTime = timeFunctions.pixelToTime(x) + this.startingLength;
			if(newEndTime <= this.startTime)
				newEndTime = this.startTime + 10;
			if(newEndTime > timelineGlobal.length)
				newEndTime = timelineGlobal.length;
			this.endTime = newEndTime;
			
			timelineGlobal.render();
			timelineGlobal.update();
		}
	}
	
	// Rendering
	this.render = function() {
		if(this.deleted)
			return;
	
		timelineGlobal.canvasContext.font = timelineGlobal.segmentFontSize + ' sans-serif';
		timelineGlobal.canvasContext.textBaseline = 'top';

		var shape = this.getShape();
			
		// is in on the screen
		if(shape.x + shape.width >= timelineGlobal.view.start && shape.x <= timelineGlobal.view.getEnd()) {
			if(this.selected)
				this.renderImage(shape, timelineGlobal.segmentLeftSel, timelineGlobal.segmentRightSel, timelineGlobal.segmentMidSel);
			else if(!this.selectable)
				this.renderImage(shape, timelineGlobal.segmentLeftDark, timelineGlobal.segmentRightDark, timelineGlobal.segmentMidDark);
			else
				this.renderImage(shape, timelineGlobal.segmentLeft, timelineGlobal.segmentRight, timelineGlobal.segmentMid);
			
			// Set the clipping bounds
			timelineGlobal.canvasContext.save();
			timelineGlobal.canvasContext.beginPath();
			timelineGlobal.canvasContext.moveTo(shape.x, shape.y);
			timelineGlobal.canvasContext.lineTo(shape.x, shape.y + shape.height);
			timelineGlobal.canvasContext.lineTo(shape.x + shape.width - timelineGlobal.segmentFontPadding, shape.y + shape.height);
			timelineGlobal.canvasContext.lineTo(shape.x + shape.width - timelineGlobal.segmentFontPadding, shape.y);
			timelineGlobal.canvasContext.closePath();
			timelineGlobal.canvasContext.clip();
			
			timelineGlobal.canvasContext.fillStyle = timelineGlobal.segmentTextColor;
                        
                        if(timelineGlobal.direction == "ltr") {
                            timelineGlobal.canvasContext.fillText(this.text, shape.x + timelineGlobal.segmentFontPadding, shape.y + timelineGlobal.segmentFontPadding);
                        } else {
                            timelineGlobal.canvasContext.fillText(this.text, shape.x + shape.width - timelineGlobal.segmentFontPadding, shape.y + timelineGlobal.segmentFontPadding);
                        }
			
			
			timelineGlobal.canvasContext.restore();
		}
	}
	
	this.renderImage = function(shape, imageLeft, imageRight, imageMid)  {
		if(shape.width < 1)
			timelineGlobal.canvasContext.drawImage(imageMid, shape.x, shape.y, 1, shape.height);
		else if(shape.width < 8)
			timelineGlobal.canvasContext.drawImage(imageMid, shape.x, shape.y, shape.width, shape.height);
		else {
			timelineGlobal.canvasContext.drawImage(imageLeft, shape.x, shape.y);
			timelineGlobal.canvasContext.drawImage(imageRight, shape.width + shape.x - 4, shape.y);
			timelineGlobal.canvasContext.drawImage(imageMid, shape.x + 4, shape.y, shape.width - 8, shape.height);
		}
	}
}