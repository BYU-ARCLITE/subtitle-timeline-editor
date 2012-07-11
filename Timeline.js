/**
 * Timeline class
 * By: Joshua Monson
 * Date: October 2011
 *
 * The timeline class renders a Final Cut Pro-like timeline onto the browser window. It was designed with the purpose of creating and editing
 * subtitles but it can be used for other purposes too.
 **/
var Timeline = (function(){
	"use strict";
	var Proto;
	
	function Timeline(location, params) {
		if(!(location instanceof HTMLElement)){ throw new Error("Invalid DOM Insertion Point"); }
		if(!params){ params = {}; }
		var canvas = document.createElement('canvas'),
			overlay = document.createElement('canvas'),
			node = document.createElement('div'),
			fonts = params.fonts || new Timeline.Fonts({}),
			colors = params.colors || new Timeline.Colors({}),
			images = params.images || new Timeline.Images({}),
			cursors = params.cursors || new Timeline.Cursors({}),
			width = params.width || location.offsetWidth,
			length = params.length || 1800;
			
		Object.defineProperties(this,{
			fonts: {
				get: function(){ return fonts; },
				set: function(obj){ fonts = obj; this.render(); },
				enumerable:true
			},colors: {
				get: function(){ return colors; },
				set: function(obj){ colors = obj; this.render(); },
				enumerable:true
			},images: {
				get: function(){ return images; },
				set: function(obj){ images = obj; this.render(); },
				enumerable:true
			},cursors: {
				get: function(){ return cursors; },
				set: function(obj){ cursors = obj; this.render(); },
				enumerable:true
			},length: { // In seconds
				get: function(){ return length; },
				set: function(val){
					if(val != length){
						length = val;
						this.render();
					}
					return length;
				},enumerable:true
			},width: { // In pixels
				get: function(){ return width; },
				set: function(val){
					var id;
					if(val != width){
						width = +val;
						canvas.width = width;
						overlay.width = width;
						for(id in this.audio){
							this.audio[id].width = width;
						}
						// Re-render the timeline
						this.render();
					}
					return width;				
				},enumerable: true
			}
		});
			
		this.events = {};
		this.tracks = [];
		this.audio = {};
		this.trackIndices = {};
		
		this.activeElement = null;
		this.selectedSegment = null;
		this.currentSegments = [];
		this.sliderActive = false;
		
		this.slider = new Timeline.Slider(this);
		this.tracker = new Timeline.Tracker(this);
		this.persistence = new Timeline.Persistence(this);
		this.view = new Timeline.View(this, params.start || 0, params.end || 60);
		
		this.timeMarkerPos = 0;
		this.repeatA = null;
		this.repeatB = null;
		this.abRepeatOn = false;
	  
		// Sizing
		this.height = this.keyHeight + this.trackPadding + this.sliderHeight;
		
		//cursor & tool selection
		this.currentTool = Timeline.SELECT;
		
		//mouse control
		this.mouseDownPos = {x: 0, y: 0};
		this.scrollInterval = null;
		this.sizeInterval = null;
		this.renderInterval = null;
		
		// Canvas
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		canvas.width = width;
		canvas.height = this.height;
		canvas.addEventListener('mousemove', mouseMove.bind(this), false);
		canvas.addEventListener('mouseup', mouseUp.bind(this), false);
		canvas.addEventListener('mouseout', mouseUp.bind(this), false);
		canvas.addEventListener('mousedown', mouseDown.bind(this), false);
		
		this.overlay = overlay;
		this.octx = overlay.getContext('2d');
		overlay.width = width;
		overlay.height = this.height;
		overlay.style.position = "absolute";
		overlay.style.top = 0;
		overlay.style.left = 0;
		overlay.style.pointerEvents = "none";

		node.style.position = "relative";
		node.appendChild(canvas);
		node.appendChild(overlay);
		location.appendChild(node);
		
		this.render();
	}
	
	Timeline.SELECT = 1;
	Timeline.MOVE = 2;
	Timeline.CREATE = 3;
	Timeline.DELETE = 4;
	Timeline.RESIZE = 5;
	Timeline.REPEAT = 6;
	Timeline.SCROLL = 7;
	
	Proto = Timeline.prototype;
	
	// Sizing
	Proto.trackHeight = 50;
	Proto.trackPadding = 10;
	Proto.sliderHeight = 25;
	Proto.sliderHandleWidth = 10;
	Proto.segmentTextPadding = 5;
	Proto.keyTop = 0;
	Proto.keyHeight = 25;
	
	Object.defineProperties(Proto,{
		currentTime: {
			set: function(val){
				this.updateTimeMarker(val);
				return this.timeMarkerPos;
			},
			get: function(){return this.timeMarkerPos;}
		}
	});
	
	Proto.getTrack = function(id){
		return this.tracks[this.trackIndices[id]];
	};
	
	/* Event Triggers */

	Proto.emit = function(evt, data){
		var that = this, fns = this.events[evt];
		fns && fns.forEach(function(cb){ setTimeout(cb.bind(that,data),0); });
	};

	Proto.on = function(name, cb){
		if(name in this.events){ this.events[name].push(cb); }
		else{ this.events[name] = [cb]; }
	};
	
	function updateCursor(pos) {
		if(typeof pos !== 'object')
			return;
		var i,j,track,seg,shape,
			cursor = this.cursors.pointer;
		
		// Check the slider
		i = this.slider.onHandle(pos);
		if(i === 1) {
			cursor = this.cursors.resizeR;
		}else if(i === -1) {
			cursor = this.cursors.resizeL;
		}else if(this.slider.containsPoint(pos)) {
			cursor = this.cursors.move;
		}else
		// Check the key
		if(pos.y < this.keyHeight+this.trackPadding) {
			cursor = this.cursors.skip;
		}else if(this.currentTool === Timeline.REPEAT){
			if(!this.abRepeatOn){
				cursor = this.cursors[this.repeatA == null?'repeatA':'repeatB'];
			}
		}else if(this.currentTool === Timeline.SCROLL){
			cursor = this.cursors[(
						(this.mousePos.y < this.height - this.sliderHeight - this.trackPadding)
						&& (this.mousePos.x < this.width/2)
						|| (this.mousePos.x < this.slider.x+this.slider.width/2)
					)?'resizeL':'resizeR'];
		}else 
		track_cursor: // Are we on a track?
		if(track = this.trackFromPos(pos)){
			if(!track.active || track.locked){
				cursor = this.cursors.locked;
				break track_cursor;
			}
			if(this.currentTool === Timeline.CREATE){
				 cursor = this.cursors.add;
			}else{
				//Are we on a segment?
				//traverse backwards so you get the ones on top
				for(j=track.visibleSegments.length-1;seg=track.visibleSegments[j];j--){
					if(!seg.containsPoint(pos)){ continue; }
					shape = seg.getShape();
					switch(this.currentTool){
						case Timeline.SELECT:
							cursor = this.cursors.select;
							break track_cursor;
						case Timeline.MOVE:
							cursor = this.cursors.move;
							break track_cursor;
						case Timeline.DELETE:
							cursor = this.cursors.remove;
							break track_cursor;
						case Timeline.RESIZE:
							cursor = this.cursors[(pos.x < shape.x + shape.width/2)?'resizeL':'resizeR'];
							break track_cursor;
					}
				}
			}
		}
		
		this.canvas.style.cursor = cursor;
	};
		
	/**
	 * Helper Functions
	 * 
	 * These functions deal with manipulating the data
	 * 
	 * Author: Joshua Monson
	 **/
	 
	Proto.select = function(seg){
		if(this.selectedSegment != null){
			this.selectedSegment.selected = false;
		}
		this.selectedSegment = seg;
		seg.selected = true;
		this.render();
		this.emit('select', seg);
	};

	Proto.unselect = function(){
		var seg = this.selectedSegment;
		this.selectedSegment = null;
		seg.selected = false;
		this.renderTrack(seg.track);
		this.emit('unselect');
	};

	Proto.setText = function(text) {
		if(this.selectedSegment != null) {
			this.selectedSegment.text = text;
		}
	};

	// Helper functions

	Proto.getTrackTop = function(track) {
		return this.keyHeight + this.trackPadding + (this.trackIndices[track.id] * (this.trackHeight + this.trackPadding));
	};

	Proto.trackFromPos = function(pos) {
		var i, bottom,
			padding = this.trackPadding,
			height = this.trackHeight,
			top = this.keyHeight + this.trackPadding;
		for(i = 0; i < this.tracks.length; i++, top = bottom + padding) {
			bottom = top + height;
			if(pos.y >= top && pos.y <= bottom)
				return this.tracks[i];
		}
		return null;
	};

	/**
	 * Event Listeners and Callbacks
	 *
	 * These listeners include mouseMove, mouseUp, and mouseDown.
	 * They check the mouse location and active elements and call their mouse listener function.
	 * 
	 * Author: Joshua Monson
	 **/
	 
	 function autoScroll(){
		if(this.delta){
			this.slider.x += this.delta*(this.width-this.sliderHandleWidth*3)/(this.length-this.width/1000);
			this.render();
		}
	 }

	 function autoSize(){
		var center = this.slider.x+this.slider.width/2,
			x = this.mousePos.x;
		if(x > center){
			this.view.endTime += (x-this.slider.endx)*this.view.zoom/10;
		}else if(x < center){
			this.view.startTime += (x-this.slider.startx)*this.view.zoom/10;
		}else{return;}
		this.render();
	 }
	 
	function mouseMove(ev) {
		var pos = {x: ev.offsetX || ev.layerX, y: ev.offsetY || ev.layerY},
			that = this;

		this.mousePos = pos;
		
		if(this.scrollInterval){
			this.delta = 10*(pos.x/this.width-.5)*this.view.zoom;
			this.canvas.style.cursor = this.cursors[(this.mousePos.x < this.width/2)?'resizeL':'resizeR'];
		}else if(this.sizeInterval){
			this.canvas.style.cursor = this.cursors[(this.mousePos.x < this.slider.x + this.slider.width/2)?'resizeL':'resizeR'];
		}else if(this.currentTool == Timeline.REPEAT
			&& this.repeatA != null && !this.abRepeatOn){
			this.updateB(pos);
		}else if(this.sliderActive){
			this.slider.mouseMove(pos);
		}else if(this.activeElement){
			this.activeElement.mouseMove(pos);
		}else{
			updateCursor.call(this,pos);
		}
		
		ev.preventDefault();
		return false;
	}

	function mouseUp(ev) {
		var pos = {x: ev.offsetX || ev.layerX, y: ev.offsetY || ev.layerY},
			id;
		
		if(this.scrollInterval){
			clearInterval(this.scrollInterval);
			this.scrollInterval = null;
			for(id in this.audio){ this.audio[id].redraw(); }
		}else if(this.sizeInterval){
			clearInterval(this.sizeInterval);
			this.sizeInterval = null;
			for(id in this.audio){ this.audio[id].redraw(); }
		}else if(this.currentTool == Timeline.REPEAT // Are we creating a repeat?
			&& !this.abRepeatOn && this.repeatA != this.repeatB) {
			this.setB(pos);
		}else if(this.sliderActive) {
			this.slider.mouseUp(pos);
			this.sliderActive = false;
			for(id in this.audio){ this.audio[id].redraw(); }
		}else if(this.activeElement) {
			this.activeElement.mouseUp(pos);
			this.activeElement = null;
		}
		
		ev.preventDefault();
		return false;
	}

	function mouseDown(ev) {
		var pos = {x: ev.offsetX || ev.layerX, y: ev.offsetY || ev.layerY},
			track,seg,i,j;

		this.mouseDownPos = pos;
		this.mousePos = pos;
		
		if(pos.y > this.height - this.sliderHeight - this.trackPadding){ // Check the slider
			if(this.slider.containsPoint(pos)) {
				this.slider.mouseDown(pos);
				this.sliderActive = true;
			}else if(this.currentTool == Timeline.SCROLL){
				this.sizeInterval = setInterval(autoSize.bind(this),1);
			}else{
				this.slider.x = pos.x - this.slider.width/2;
				this.render();
				if(pos.y > this.height - this.sliderHeight){
					this.slider.mouseDown(pos);
					this.sliderActive = true;
				}
			}
		}else if(pos.y < this.keyHeight+this.trackPadding) { // Check the key
			i = this.view.pixelToTime(pos.x);
			this.updateTimeMarker(i);
			this.emit('jump',i);
			this.emit('timeupdate',i);
		}else switch(this.currentTool){
			case Timeline.CREATE:
				track = this.trackFromPos(pos);
				if(track && track.active && !track.locked){
					this.activeElement = new Timeline.Placeholder(this, track, pos.x);
				}
				break;
			case Timeline.REPEAT:
				if(this.abRepeatOn){ this.clearRepeat(); }
				else if(this.repeatA == null){ this.setA(pos); }
				else{ this.setB(pos); }
				break;
			case Timeline.SCROLL:
				this.delta = 10*(pos.x/this.width-.5)*this.view.zoom;
				this.scrollInterval = setInterval(autoScroll.bind(this),1);
		}
		
		// Check all the segments
		track_loop: for(i=0;track=this.tracks[i];i++) {
			//search backwards 'cause later segments are on top
			for(j=track.visibleSegments.length-1;seg = track.visibleSegments[j];j--) {
				if(!seg.containsPoint(pos)) { continue; }
				this.activeElement = seg;
				seg.mouseDown(pos);
				break track_loop;
			}
		}
		
		ev.preventDefault();
		return false;
	}

	Proto.addTextTrack = function(cues, id, language) {
		var track;
		if(id in this.trackIndices){ throw new Error("Track with that id already loaded."); }
		if(cues instanceof Timeline.TextTrack){
			track = cues;
			id = track.id;
		}else{
			track = new Timeline.TextTrack(this, cues, id, language);
		}
		this.trackIndices[id] = this.tracks.length;
		this.tracks.push(track);

		// Adjust the height
		this.height += this.trackHeight + this.trackPadding;
		this.canvas.height = this.height;
		this.overlay.height = this.height;
		this.render();
		this.emit("addtrack",track);
	};
	
	Proto.removeTextTrack = function(id) {
		var i,track,aid,loc;
		if(id in this.trackIndices){
			loc = this.trackIndices[id];
			aid = this.tracks[loc].audioId;
			if(aid in this.audio){ this.audio[aid].references--; }
			if(aid in this.audio){ this.audio[aid].references--; }
			track = this.tracks.splice(loc, 1)[0];
			delete this.trackIndices[id];
			
			for(i=loc;track=this.tracks[i];i++){
				this.trackIndices[track.id] = i;		
			}
			
			// Adjust the height
			this.height -= this.trackHeight + this.trackPadding;
			this.canvas.height = this.height;
			this.overlay.height = this.height;
			this.render();
			this.emit("removetrack",track);
		}
	};
	
	Proto.addAudioTrack = function(wave, id) {
		var track;
		if(id in this.audio){ throw new Error("Track with that id already loaded."); }
		if(wave instanceof Timeline.AudioTrack){
			track = wave;
			id = wave.id;
		}else{
			track = new Timeline.AudioTrack(this, wave, id);
		}
		this.audio[id] = track;
		this.render();
	};
	
	Proto.setAudioTrack = function(tid, aid){
		var track;
		if(!(tid in this.trackIndices)){ return; }
		track = this.tracks[this.trackIndices[tid]];
		if(track.audioId in this.audio){ this.audio[track.audioId].references--; }
		track.audioId = aid;
		if(aid in this.audio){
			this.audio[aid].references++;
			this.audio[aid].render();
		}
	};
	
	Proto.removeAudioTrack = function(id){
		var i, top, ctx, track;
		if(!(id in this.audio)){ return; }
		if(this.audio[id].references){
			top = this.keyHeight+this.trackPadding,
			ctx = this.octx;
			for(i=0;track=this.tracks[i];i++){
				if(track.active && track.audioId === id){
					ctx.clearRect(0, top, this.width, this.trackHeight);
				}
				top += this.trackHeight + this.trackPadding;
			}
		}
		delete this.audio[id];
	};
	
	// Drawing functions
	Proto.renderKey = function() {
		var ctx = this.ctx,
			view = this.view,
			zoom = view.zoom,
			power, d=0,
			hours, mins, secs, pixels,
			start, end, position, offset, increment;
		
		ctx.save();
		ctx.font         = this.fonts.keyFont;
		ctx.textBaseline = 'top';
		ctx.fillStyle    = this.fonts.keyTextColor;
		ctx.strokeStyle    = this.fonts.keyTextColor;

		// Find the smallest increment in powers of 2 that gives enough room for 1-second precision
		power = Math.ceil(Math.log(ctx.measureText(" 0:00:00").width*zoom)/0.6931471805599453);
		increment = Math.pow(2,power);
		pixels = increment/zoom;

		//if we're below 1-second precision, adjust the increment to provide extra room
		if(power < 0){
			d = power<-2?3:-power;
			if(pixels < ctx.measureText(" 0:00:0"+(0).toFixed(d)).width){
				increment*=2;
				pixels*=2;
				d--;
			}
		}
		
		start = view.startTime;
		start -= start%increment;
		end = view.endTime;
		offset = this.canvas.dir === 'ltr' ? 2 : -2;
		
		for (position = this.view.timeToPixel(start); start < end; start += increment, position += pixels) {

			// Draw the tick
			ctx.beginPath();
			ctx.moveTo(position, this.keyTop);
			ctx.lineTo(position, this.keyTop + this.keyHeight);
			ctx.stroke();

			// Now put the number on
			secs = start % 60;
			mins = Math.floor(start / 60);
			hours = Math.floor(mins / 60);
			mins %= 60;
			
			ctx.fillText(
				hours + (mins<10?":0":":") + mins + (secs<10?":0":":") + secs.toFixed(d), position + offset,
				this.keyTop + 2
			);
		}
		ctx.restore();
	};

	Proto.renderBackground = function() {
		var ctx = this.ctx,
			grd = ctx.createLinearGradient(0,0,0,this.height);

		// Draw the backround color
		grd.addColorStop(0,this.colors.bgTop);
		grd.addColorStop(0.5,this.colors.bgMid);
		grd.addColorStop(1,this.colors.bgBottom);
		ctx.save();
		ctx.fillStyle = grd;
		ctx.globalCompositeOperation = "source-over";
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.restore();
	};

	Proto.renderTimeMarker = function() {
		var ctx, x = this.view.timeToPixel(this.timeMarkerPos)-1;
		if(x < -1 || x > this.width){ return; }
		ctx = this.ctx
		ctx.save();
		ctx.fillStyle = this.colors.timeMarker;
		ctx.fillRect(x, 0, 2, this.height);
		ctx.restore();
	};
		
	Proto.renderABRepeat = function() {
		if(this.repeatA != null) {
			var left = this.view.timeToPixel(this.repeatA),
				right = this.view.timeToPixel(this.repeatB),
				ctx = this.ctx;
			ctx.save();
			ctx.fillStyle = this.colors[this.abRepeatOn?'abRepeat':'abRepeatLight'];
			ctx.fillRect(left, 0, right-left, this.height);
			ctx.restore();
		}
	};

	Proto.render = function() {
		var aid, audio;
		if(this.images.complete){
			clearInterval(this.renderInterval);
			this.renderInterval = null;
			this.renderBackground();
			this.renderKey();
			this.tracks.forEach(function(track){ track.render(); });
			for(aid in this.audio){ this.audio[aid].render(); }
			this.renderABRepeat();
			this.renderTimeMarker();
			this.slider.render();
		}else if(!this.renderInterval){
			this.renderInterval = setInterval(this.render.bind(this),1);
		}
	};
	
	Proto.renderTrack = function(track) {		
		var ctx, x = this.view.timeToPixel(this.timeMarkerPos)-1;
		
		track.render();
		
		//redo the peice of the timeMarker that we drew over
		if(x < -1 || x > this.width){ return; }
		ctx = this.ctx;
		ctx.save();
		ctx.fillStyle = this.colors.timeMarker;
		ctx.fillRect(x, this.getTrackTop(track), 2, this.trackHeight);
		ctx.restore();
	};
	
	Proto.updateTimeMarker = function(time) {
		if(time == this.timeMarkerPos){ return; }
		
		// Check the repeat
		if(this.abRepeatOn && time > this.repeatB) {
			time = this.repeatA;
			this.emit('jump',this.repeatA);
		}

		this.timeMarkerPos = time;
		this.updateCurrentSegments();
		this.emit('timeupdate', time);
		
		if(time < this.view.startTime || time > this.view.endTime) {
			// Move the view
			this.slider.x = Math.round(time*(this.width - this.slider.width)/this.length);
		}
		
		this.render();
	};

	Proto.updateCurrentSegments = function(){
		var that = this,
			time = this.timeMarkerPos,
			oldsegs = this.currentSegments,
			cursegs = [];
		this.tracks.forEach(function(track){
			if(track.active){Array.prototype.push.apply(cursegs,track.searchRange(time,time));}
		});
		this.currentSegments = cursegs;
		this.emit('segments',{
			valid:cursegs,
			invalid:oldsegs.filter(function(seg){
				return !seg.track.active || seg.startTime > time || seg.endTime < time;
			})
		});
	};

	Proto.setA = function(pos) {
		var time = this.view.pixelToTime(pos.x);
		this.repeatA = time;
		this.repeatB = time;
	};

	Proto.setB = function(pos) {
		var t;
		this.repeatB = this.view.pixelToTime(pos.x);
		if(this.repeatB < this.repeatA) {
			t = this.repeatB;
			this.repeatB = this.repeatA;
			this.repeatA = t;
		}
		this.abRepeatOn = true;
		this.render();
		this.emit('abRepeatEnabled');
	};

	Proto.updateB = function(pos) {
		this.repeatB = this.view.pixelToTime(pos.x);
		this.render();
	};

	Proto.clearRepeat = function() {
		this.repeatA = null;
		this.repeatB = null;
		this.abRepeatOn = false;
		this.render();
	};
	
	Proto.save = function(type, id) { this.persistence.save(type, id); };
	Proto.loadTextTrack = function(url) { this.persistence.loadTextTrack(url); };
	
	return Timeline;
}());