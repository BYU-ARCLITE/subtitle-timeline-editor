(function(Timeline){
	"use strict";
	var Proto, segId = 0;
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function order(a,b){
		//sort first by start time, then by length
		return (a.startTime - b.startTime) || (b.endTime - a.endTime);
	}
	
	function TextTrack(tl, cues, id, language){
		var active = true,
			that = this;
		this.tl = tl;
		this.id = id;
		this.language = language;
		this.segments = cues.map(function(cue){ return new Segment(that, cue); });
		this.segments.sort(order);
		this.visibleSegments = [];
		this.audioId = null;
		this.locked = false;
		Object.defineProperty(this,'active',{
			get: function(){ return active; },
			set: function(val){
				if(!this.locked){
					val = !!val;
					if(val != active){
						active = val;
						if(!active && tl.selectedSegment && tl.selectedSegment.track === this){
							tl.unselect();
						}else{
							tl.renderTrack(this);
						}
						if(this.audioId){ tl.audio[this.audioId].draw(); }
						tl.updateCurrentSegments();
					}
				}
				return active;
			}
		});
	}
	
	Proto = TextTrack.prototype;
	
	Proto.add = function(start, end, t, i){
		var tl = this.tl,
			seg = new Segment(this, (start instanceof Cue)?start:new Cue(i, start, end, t));
		
		this.segments.push(seg);
		this.segments.sort(order);
		
		// Save the action
		tl.tracker.addAction(new Timeline.Action("create",{
			id:seg.uid,
			track:this.id,
			initialStart:seg.startTime,
			initialEnd:seg.endTime
		}));
		tl.renderTrack(this);
		if(this.active && seg.startTime < this.tl.view.endTime && seg.endTime > this.tl.view.startTime){
			tl.updateCurrentSegments();
		}
		tl.emit('update');
		return seg;
	};
	
	Proto.getSegment = function(id){
		var i, segs = this.segments,
			len = segs.length;
		for(i=0;i<len;i++){
			if(segs[i].uid === id){ return segs[i]; }
		}
	};
	
	Proto.searchRange = function(low, high){
		//TODO: Higher efficiency binary search
		return this.segments.filter(function(seg){
			return !seg.deleted && seg.startTime < high && seg.endTime > low;
		});
	};

	Proto.render = function(){
		var tl = this.tl,
			startTime = tl.view.startTime,
			ctx = tl.ctx,
			audio = this.audio,
			selected = null;
		
		ctx.save();
		
		ctx.translate(0,tl.getTrackTop(this));
		
		ctx.fillStyle = ctx.createPattern(tl.images.trackBg, "repeat-x");
		ctx.fillRect(0, 0, tl.width, tl.trackHeight);
		
		ctx.textBaseline = 'middle';
		ctx.font = tl.fonts.titleFont;
		ctx.fillStyle = tl.fonts.titleTextColor;
		ctx.fillText(this.id, tl.width/100, tl.trackHeight/2);
		
		ctx.restore();
		
		this.visibleSegments = this.searchRange(startTime,tl.view.endTime).sort(order);
		this.visibleSegments.forEach(function(seg){
			if(seg.selected){ selected = seg; }
			else{ seg.render(); }
		});
		//save the selected segment for last so it's always on top
		selected && selected.render();
	};
	
	Proto.toVTT = function(){
		return "WEBVTT\n\n"+this.segments.map(function(seg){ return this.toVTT(); }).join('');
	};
	
	Proto.toSRT = function(){
		return this.segments.map(function(seg){ return this.toSRT(); }).join('');
	};
	
	function Segment(track, cue) {
		this.tl = track.tl;
		this.track = track;
		this.cue = cue;
		this.uid = (segId++).toString(36);
		this.selected = false;
		this.move = false;
		this.resize = false;
		this.deleted = false;
		this.action = null;
		this.resizeSide = 0;

		// For mouse control
		this.startingPos = 0;
		this.startingLength = 0;
	}

	Proto = Segment.prototype;
	
	Object.defineProperties(Proto,{
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
		return {x: x, y: y, width: width, height: tl.trackHeight};
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
		if(shape.width < imageLeft.width + imageRight.width){
			ctx.drawImage(imageLeft, 0, 0, shape.width/2, shape.height);
			ctx.drawImage(imageRight, shape.width/2, 0, shape.width, shape.height);
		}else{
			ctx.drawImage(imageLeft, 0, 0);
			ctx.drawImage(imageRight, shape.width - imageRight.width, 0);
			ctx.fillStyle = ctx.createPattern(imageMid, "repeat-x");
			ctx.fillRect(imageLeft.width, 0, shape.width - (imageRight.width + imageLeft.width), shape.height);
		}
	}
	
	Proto.render = function() {
		if(this.deleted)
			return;

		var tl = this.tl,
			images = tl.images,
			fonts = tl.fonts,
			ctx = tl.ctx,
			shape = this.getShape(),
			x = shape.x,
			y = shape.y,
			direction, dir;
			
		// is it on the screen
		if(x > -shape.width && x < tl.width) {
			ctx.save();
			ctx.translate(x, y);
			
			renderImage.apply(this, (this.selected)?[
										shape,
										images.segmentLeftSel, images.segmentRightSel, images.segmentMidSel
									]:(!this.selectable)?[
										shape,
										images.segmentLeftDark, images.segmentRightDark, images.segmentMidDark
									]:[
										shape,
										images.segmentLeft, images.segmentRight, images.segmentMid
									]);
			
			if(shape.width > 2*tl.segmentTextPadding){
				// Set the clipping bounds
				ctx.beginPath();
				ctx.moveTo(tl.segmentTextPadding, 0);
				ctx.lineTo(tl.segmentTextPadding, shape.height);
				ctx.lineTo(shape.width - tl.segmentTextPadding, shape.height);
				ctx.lineTo(shape.width - tl.segmentTextPadding, 0);
				ctx.closePath();
				ctx.clip();
				
				ctx.textBaseline = 'top';
				
				dir = tl.canvas.dir; //save
				
				if(this.id){
					direction = Ayamel.Text.getDirection(this.id);
					tl.canvas.dir = direction;
					
					ctx.font = fonts.idFont;
					ctx.fillStyle = fonts.idTextColor;
					ctx.fillText(this.id, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, 0);
					y = Math.max(fonts.idFontSize,tl.segmentTextPadding);
				}else{
					y = tl.segmentTextPadding;
				}
				
				direction = Ayamel.Text.getDirection(this.text);
				tl.canvas.dir = direction;
				
				ctx.font = fonts.segmentFont;
				ctx.fillStyle = fonts.segmentTextColor;
				ctx.fillText(this.text, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, y);
				
				tl.canvas.dir = dir; //restore
			}
			ctx.restore();
		}
	};	
	
	Timeline.TextTrack = TextTrack;
}(Timeline));