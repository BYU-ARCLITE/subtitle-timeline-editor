(function(Timeline){
	"use strict";
	var Proto;
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function Segment(tl, start, end, t, i) {
		var cue = (start instanceof Cue)?start:new Cue(i, start, end, t);
		
		this.tl = tl;
		this.cue = cue;
		this.uid = +(new Date)+start;
		this.selected = false;
		this.move = false;
		this.resize = false;
		this.deleted = false;
		this.track = null;
		this.action = null;
		this.resizeSide = 0;

		// For mouse control
		this.startingPos = 0;
		this.startingLength = 0;
	}

	Object.defineProperties(Segment.prototype,{
		selectable: { get: function(){ return !this.track.locked && this.track.active; }, enumerable: true },
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
				tl.tracker.addAction(new Timeline.Action("update",{
					id:this.uid,
					track:this.track.id,
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

	Proto = Segment.prototype;
	
	Proto.toVTT = function(){
		return this.deleted?"":WebVTT.serialize(this.cue);
	};

	Proto.toSRT = function(){
		return this.deleted?"":SRT.serialize(this.cue);
	};

	// Location computation
	Proto.getShape = function() {
		var tl = this.tl,
			x = tl.view.timeToPixel(this.startTime),
			y = tl.getTrackTop(this.track),
			width = tl.view.timeToPixel(this.endTime) - x;
		return {x: x, y: y, width: width, height: tl.segmentTrackHeight};
	};

	Proto.containsPoint = function(pos) {
		var s = this.getShape();
		return (pos.x >= s.x && pos.x <= s.x + s.width && pos.y >= s.y && pos.y <= s.y + s.height);
	};

	Proto.getMouseSide = function(pos) {
		// Get the x and width
		var shape = this.getShape();
		return (pos.x < shape.x + (shape.width/2))?-1:1;
	};

	// Event handlers
	Proto.mouseDown = function(pos) {
		if(this.deleted || !this.selectable)
			return;
			
		this.startingPos = this.tl.view.timeToPixel(this.startTime);
		this.startingLength = this.endTime - this.startTime;
				
		switch(this.tl.currentTool){
			case Timeline.SELECT:
				if(this.selected){ this.tl.unselect(); }
				else{ this.tl.select(this); }
				break;
			case Timeline.MOVE:
				this.move = true;    
				this.action = new Timeline.Action("move",{
					id:this.uid,
					track:this.track.id,
					initialStart:this.startTime,
					initialEnd:this.endTime
				});
				break;
			case Timeline.RESIZE:
				this.action = new Timeline.Action("resize",{
					id:this.uid,
					track:this.track.id,
					initialStart:this.startTime,
					initialEnd:this.endTime
				});
				this.resizeSide = this.getMouseSide(pos);
		}
	};

	Proto.mouseUp = function(pos) {
		if(this.deleted || !this.selectable)
			return;
		
		var tl = this.tl;
		
		switch(tl.currentTool) {
			case Timeline.MOVE:
				this.move = false;
				
				// Save the move
				this.action.attributes.finalStart = this.startTime;
				this.action.attributes.finalEnd = this.endTime;
				tl.tracker.addAction(this.action);
				tl.emit('update');
				this.track.segments.sort(Segment.order);
				break;
			case Timeline.DELETE:
				// Delete tool
				this.deleted = true;
				
				// Save the delete
				tl.tracker.addAction(new Timeline.Action("delete",{
					id:this.uid,
					track:this.track.id
				}));
				tl.selectedSegment = null;
				tl.render();
				tl.emit('update');
				break;
			case Timeline.RESIZE:
				this.resizeSide = 0;
				// Save the resize
				this.action.attributes.finalStart = this.startTime;
				this.action.attributes.finalEnd = this.endTime;
				tl.tracker.addAction(this.action);
				tl.emit('update');
				this.track.segments.sort(Segment.order);
		}
	};

	Proto.mouseMove = function(pos) {
		if(this.deleted || !this.selectable)
			return;
		
		var tl = this.tl,
			activeStart, newTime, maxStartTime;
		
		if(this.move){
			activeStart = this.active;
			
			newTime = tl.view.pixelToTime(this.startingPos + pos.x - tl.mouseDownPos.x);
			maxStartTime = tl.length - this.startingLength;
			
			if(newTime < 0){ newTime = 0; }
			else if(newTime > maxStartTime){ newTime = maxStartTime; }
			
			this.startTime = newTime;
			this.endTime = newTime + this.startingLength;
					
		}else if(this.resizeSide == -1){
			activeStart = this.active;
			
			newTime = tl.view.pixelToTime(this.startingPos + pos.x - tl.mouseDownPos.x);
			
			if(newTime < 0){ newTime = 0; }
			else if(newTime >= this.endTime){ newTime = this.endTime - 10; }
			
			this.startTime = newTime;
					
		}else if(this.resizeSide == 1){
			activeStart = this.active;
			
			newTime = tl.view.pixelToTime(this.startingPos + pos.x - tl.mouseDownPos.x) + this.startingLength;
			if(newTime <= this.startTime){ newTime = this.startTime + 10; }
			else if(newTime > tl.length){ newTime = tl.length; }
			
			this.endTime = newTime;
			
		}else{ return; }
		
		tl.renderTrack(this.track);
		if(activeStart != this.active){ tl.updateCurrentSegments(); }
	};

	// Rendering
	
	function renderImage(shape, imageLeft, imageRight, imageMid) {
		var ctx = this.tl.ctx;
		if(shape.width < 2){
			ctx.drawImage(imageMid, 0, 0, Math.max(1,shape.width), shape.height);
		}else if(shape.width < imageLeft.width + imageRight.width){
			ctx.drawImage(imageLeft, 0, 0, shape.width/2, shape.height);
			ctx.drawImage(imageRight, shape.width/2, 0, shape.width, shape.height);
		}else{
			ctx.drawImage(imageLeft, 0, 0);
			ctx.drawImage(imageRight, shape.width - imageRight.width, 0);
			ctx.drawImage(imageMid, imageLeft.width, 0, shape.width - (imageRight.width + imageLeft.width), shape.height);
		}
	}
	
	Proto.render = function() {
		if(this.deleted)
			return;

		var tl = this.tl,
			ctx = tl.ctx,
			shape = this.getShape(),
			x = shape.x,
			y = shape.y,
			direction, dir;
			
		// is it on the screen
		if(x > -shape.width && x < tl.view.width) {
			ctx.save();
			ctx.translate(x, y);
			
			renderImage.apply(this, (this.selected)?	[shape,	tl.segmentLeftSel,	tl.segmentRightSel,	tl.segmentMidSel]:
									(!this.selectable)?	[shape,	tl.segmentLeftDark,	tl.segmentRightDark,	tl.segmentMidDark]:
														[shape,	tl.segmentLeft,	tl.segmentRight,	tl.segmentMid]);
			
			if(shape.width > 2*tl.segmentFontPadding){
				// Set the clipping bounds
				ctx.beginPath();
				ctx.moveTo(tl.segmentFontPadding, 0);
				ctx.lineTo(tl.segmentFontPadding, shape.height);
				ctx.lineTo(shape.width - tl.segmentFontPadding, shape.height);
				ctx.lineTo(shape.width - tl.segmentFontPadding, 0);
				ctx.closePath();
				ctx.clip();
				
				ctx.textBaseline = 'top';
				
				dir = tl.canvas.dir; //save
				
				if(this.id){
					direction = Ayamel.Text.getDirection(this.id);
					tl.canvas.dir = direction;
					
					ctx.font = tl.idFont;
					ctx.fillStyle = tl.idTextColor;
					ctx.fillText(this.id, direction === 'ltr' ? tl.segmentFontPadding : shape.width - tl.segmentFontPadding, 0);
					y = Math.max(tl.idFontSize,tl.segmentFontPadding);
				}else{
					y = tl.segmentFontPadding;
				}
				
				direction = Ayamel.Text.getDirection(this.text);
				tl.canvas.dir = direction;
				
				ctx.font = tl.segmentFont;
				ctx.fillStyle = tl.segmentTextColor;
				ctx.fillText(this.text, direction === 'ltr' ? tl.segmentFontPadding : shape.width - tl.segmentFontPadding, y);
				
				tl.canvas.dir = dir; //restore
			}
			ctx.restore();
		}
	};
	
	Timeline.Segment = Segment;
}(Timeline));