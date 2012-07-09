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
	function Timeline(location, length, viewstart, viewend) {
		var canvas = document.createElement('canvas'),
			overlay = document.createElement('canvas'),
			node = document.createElement('div');
		
		this.length = length; // In seconds
			
		this.events = {};
		this.tracks = [];
		this.audio = {};
		this.trackIndices = {};
		
		this.activeElement = null;
		this.selectedSegment = null;
		this.currentSegments = [];
		
		this.slider = new Slider(this);
			this.sliderActive = false;
		
		this.toolbar = null;
		
		this.tracker = new TimelineTracker(this);
		
		this.timeMarkerPos = 0;
		this.direction = $(location).css("direction");
		this.repeatA = null;
		this.repeatB = null;
		this.abRepeatOn = false;
	  
		// Sizing
		this.height = this.keyHeight + this.segmentTrackPadding + this.sliderHeight;
		
		//cursor & tool selection
		this.currentTool = Timeline.SELECT;
		
		//mouse control
		this.mouseDownPos = {x: 0, y: 0};
		
		// Canvas
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');	
		this.overlay = overlay;
		this.octx = overlay.getContext('2d');
		canvas.addEventListener('mousemove', mouseMove.bind(this), false);
		canvas.addEventListener('mouseup', mouseUp.bind(this), false);
		canvas.addEventListener('mouseout', mouseUp.bind(this), false);
		canvas.addEventListener('mousedown', mouseDown.bind(this), false);
		
		//put stuff on the page
		this.view = new TimelineView(this);
			this.view.width = window.innerWidth;
			this.view.startTime = viewstart;
			this.view.endTime = viewend;
			
		canvas.height = this.height;
		canvas.width = window.innerWidth;
		overlay.height = this.height;
		overlay.width = window.innerWidth;
		overlay.style.position = "absolute";
		overlay.style.top = 0;
		overlay.style.left = 0;
		overlay.style.pointerEvents = "none";
		window.addEventListener("resize", windowResize.bind(this), false);
		
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

	function windowResize() {
		var id, width = window.innerWidth;
		if(width != this.view.width){
			this.view.width = width;
			this.canvas.width = width;
			this.overlay.width = width;
			for(id in this.audio){
				this.audio[id].width = width;
			}
			
			// Re-render the timeline
			this.render();
		}
	}
	
	// Sizing
	Timeline.prototype.segmentTrackHeight = 50;
	Timeline.prototype.segmentTrackPadding = 10;
	Timeline.prototype.sliderHeight = 25;
	Timeline.prototype.sliderHandleWidth = 10;
	Timeline.prototype.keyTop = 0;
	Timeline.prototype.keyHeight = 25;
	Timeline.prototype.toolbarHeight = 0;

	// Coloring
	Timeline.prototype.backgroundColor = "rgba(64, 66, 69, 1)";
		Timeline.prototype.backgroundColorTop = "#3e3f43";
		Timeline.prototype.backgroundColorBottom = "#292a2d";
	Timeline.prototype.trackColor = "rgba(75, 75, 255, 0.1)";
		Timeline.prototype.trackColorTop = "#292a2d";
		Timeline.prototype.trackColorBottom = "#55585c";
	Timeline.prototype.segmentColor = "rgba(98, 129, 194, 0.3)";
		Timeline.prototype.secondarySegmentColor = "rgba(142, 148, 160, 0.3)";
		Timeline.prototype.placeholderColor = "rgba(255, 255, 160, 0.5)";
		Timeline.prototype.highlightedColor = "#134dc8";
	Timeline.prototype.sliderColor = "#134dc8";
		Timeline.prototype.sliderHandleColor = "#008";
	Timeline.prototype.timeMarkerColor = "rgba(255, 255, 160, 0.5)";
	Timeline.prototype.abRepeatColor = "rgba(255, 0, 0, 0.4)";
		Timeline.prototype.abRepeatColorLight = "rgba(255, 0, 0, 0.25)";
		
	//Fonts
	Timeline.prototype.keyFont = "italic 14px sans-serif";
	Timeline.prototype.keyTextColor = "#fff";
	Timeline.prototype.titleFont = "italic 14px sans-serif";
	Timeline.prototype.titleTextColor = "#ddd";
	Timeline.prototype.segmentFont = "20px sans-serif";
	Timeline.prototype.segmentFontPadding = 5;
	Timeline.prototype.segmentTextColor = "#000";
	
	// Cursors
	Timeline.prototype.cursors = {
		pointer:	"url(\"./images/cursors/cursor.png\"), auto",
		resizeR:	"url(\"./images/cursors/resize-right.png\") 10 15, col-resize",
		resizeL:	"url(\"./images/cursors/resize-left.png\") 22 15, col-resize",
		move:		"url(\"./images/cursors/move.png\") 15 15, move",
		skip:		"url(\"./images/cursors/skip.png\") 0 5, auto",
		repeatA:	"url(\"./images/cursors/repeat-a.png\"), auto",
		repeatB:	"url(\"./images/cursors/repeat-b.png\"), auto",
		add:		"url(\"./images/cursors/add.png\"), auto",
		select:		"url(\"./images/cursors/cursor-highlight.png\"), auto",
		remove:		"url(\"./images/cursors/delete.png\") 15 15, pointer",
		locked:		"not-allowed"
	};
	
	// Images
	Timeline.prototype.loadImages = function(srcs) {
		var imgName, img;
		for(imgName in srcs){
			img = new Image;
			img.src = srcs[imgName];
			this[imgName] = img;
		}
	};
	
	Timeline.prototype.loadImages.call(Timeline.prototype,{
		// normal images
		segmentLeft: "./images/event_left.png",
		segmentRight: "./images/event_right.png",
		segmentMid: "./images/event_mid.png",
		// selected images
		segmentLeftSel: "./images/event_left_sel.png",
		segmentRightSel: "./images/event_right_sel.png",
		segmentMidSel: "./images/event_mid_sel.png",
		// dark images
		segmentLeftDark: "./images/event_left_dark.png",
		segmentRightDark: "./images/event_right_dark.png",
		segmentMidDark: "./images/event_mid_dark.png",
		// slider images
		sliderLeft: "./images/slider_left.png",
		sliderRight: "./images/slider_right.png",
		sliderMid: "./images/slider_mid.png",
		// track images
		trackBg: "./images/track_bg.png"
	});	
	
	Object.defineProperties(Timeline.prototype,{
		currentTime: {
			set: function(val){
				this.updateTimeMarker(val);
				return this.timeMarkerPos;
			},
			get: function(){return this.timeMarkerPos;}
		}
	});
	
	Timeline.prototype.getTrack = function(id){
		return this.tracks[this.trackIndices[id]];
	};
	
	/* Event Triggers */

	Timeline.prototype.emit = function(evt, data){
		var that = this, fns = this.events[evt];
		fns && fns.forEach(function(cb){ cb.call(that,data); });
	};

	Timeline.prototype.on = function(name, cb){
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
		if(pos.y < this.keyHeight+this.segmentTrackPadding) {
			cursor = this.cursors.skip;
		}else if(this.currentTool === Timeline.REPEAT){
			if(!this.abRepeatOn){
				cursor = this.cursors[this.repeatA == null?'repeatA':'repeatB'];
			}
		}else if(this.currentTool === Timeline.SCROLL){
			cursor = this.cursors[(
						(this.mousePos.y < this.height - this.sliderHeight - this.segmentTrackPadding)
						&& (this.mousePos.x < this.view.width/2)
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
	 
	Timeline.prototype.select = function(seg){
		if(this.selectedSegment != null){
			this.selectedSegment.selected = false;
		}
		this.selectedSegment = seg;
		seg.selected = true;
		this.render();
		this.emit('select', seg);
	};

	Timeline.prototype.unselect = function(){
		var seg = this.selectedSegment;
		this.selectedSegment = null;
		seg.selected = false;
		this.renderTrack(seg.track);
		this.emit('unselect');
	};

	Timeline.prototype.setText = function(text) {
		if(this.selectedSegment != null) {
			this.selectedSegment.text = text;
		}
	};

	// Helper functions

	Timeline.prototype.getTrackTop = function(track) {
		return this.keyHeight + this.segmentTrackPadding + (this.trackIndices[track.id] * (this.segmentTrackHeight + this.segmentTrackPadding));
	};

	Timeline.prototype.trackFromPos = function(pos) {
		var i, bottom,
			padding = this.segmentTrackPadding,
			height = this.segmentTrackHeight,
			top = this.keyHeight + this.segmentTrackPadding;
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
			this.slider.x += this.delta*(this.view.width-this.sliderHandleWidth*3)/(this.length-this.view.width/1000);
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
		var offset = $(this.ctx.canvas).offset(),
			pos = {x: ev.pageX-offset.left, y: ev.pageY-offset.top},
			that = this;

		this.mousePos = pos;
		
		if(this.scrollInterval){
			this.delta = 10*(pos.x/this.view.width-.5)*this.view.zoom;
			this.canvas.style.cursor = this.cursors[(this.mousePos.x < this.view.width/2)?'resizeL':'resizeR'];
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
		var offset = $(this.ctx.canvas).offset(),
			pos = {x: ev.pageX-offset.left, y: ev.pageY-offset.top},
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
		var offset = $(this.ctx.canvas).offset(),
			pos = {x: ev.pageX-offset.left, y: ev.pageY-offset.top},
			track,seg,i,j;

		this.mouseDownPos = pos;
		this.mousePos = pos;
			
		if(pos.y > this.height - this.sliderHeight - this.segmentTrackPadding){ // Check the slider
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
		}else if(pos.y < this.keyHeight+this.segmentTrackPadding) { // Check the key
			i = this.view.pixelToTime(pos.x);
			this.updateTimeMarker(i);
			this.emit('jump',i);
			this.emit('timeupdate',i);
		}else switch(this.currentTool){
			case Timeline.CREATE: // Are we creating a segment?
				track = this.trackFromPos(pos);
				if(track && track.active && !track.locked){
					this.activeElement = new SegmentPlaceholder(this, pos.x, track);
				}
				break;
			case Timeline.REPEAT: // Are we creating a repeat?
				if(this.abRepeatOn){ this.clearRepeat(); }
				else if(this.repeatA == null){ this.setA(pos); }
				else{ this.setB(pos); }
				break;
			case Timeline.SCROLL: //are we scrolling?
				this.delta = 10*(pos.x/this.view.width-.5)*this.view.zoom;
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

	Timeline.prototype.addSegmentTrack = function(cues, id, language, karaoke) {
		var track;
		if(id in this.trackIndices){ throw new Error("Track with that id already loaded."); }
		if(cues instanceof SegmentTrack){
			track = cues;
			id = track.id;
			karaoke = track.karaoke;
		}else{
			track = new SegmentTrack(this, cues, id, language, karaoke);
		}
		this.trackIndices[id] = this.tracks.length;
		this.tracks.push(track);
		if(karaoke == true) { this.kTracks++; }

		// Adjust the height
		this.height += this.segmentTrackHeight + this.segmentTrackPadding;
		this.canvas.height = this.height;
		this.overlay.height = this.height;
		this.render();
	};
	
	Timeline.prototype.removeSegmentTrack = function(id) {
		var i,track,aid,loc;
		if(id in this.trackIndices){
			loc = this.trackIndices[id];
			aid = this.tracks[loc].audioId;
			if(aid in this.audio){ this.audio[aid].references--; }
			if(this.tracks[loc].karaoke){ this.kTracks--; }
			this.tracks.splice(loc, 1);
			delete this.trackIndices[id];
		}
		for(i=loc;track=this.tracks[i];i++){
			this.trackIndices[track.id] = i;		
		}
		
		// Adjust the height
		this.height -= this.segmentTrackHeight + this.segmentTrackPadding;
		this.canvas.height = this.height;
		this.overlay.height = this.height;
		this.render();
	};
	
	Timeline.prototype.addAudioTrack = function(wave, id) {
		var track;
		if(id in this.audio){ throw new Error("Track with that id already loaded."); }
		if(wave instanceof AudioTrack){
			track = wave;
			id = wave.id;
		}else{
			track = new AudioTrack(this, wave, id);
		}
		this.audio[id] = track;
		this.render();
	};
	
	Timeline.prototype.setAudioTrack = function(tid, aid){
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
	
	Timeline.prototype.removeAudioTrack = function(id){
		var i, top, ctx, track;
		if(!(id in this.audio)){ return; }
		if(this.audio[id].references){
			top = this.keyHeight+this.segmentTrackPadding,
			ctx = this.octx;
			for(i=0;track=this.tracks[i];i++){
				if(track.active && track.audioId === id){
					ctx.clearRect(0, top, this.view.width, this.segmentTrackHeight);
				}
				top += this.segmentTrackHeight + this.segmentTrackPadding;
			}
		}
		delete this.audio[id];
	};
	
	// Drawing functions
	Timeline.prototype.renderKey = function() {
		var ctx = this.ctx,
			view = this.view,
			zoom = view.zoom,
			power, d=0,
			hours, mins, secs, pixels,
			start, end, position, increment;
		
		ctx.save();
		ctx.font         = this.keyFont;
		ctx.textBaseline = 'top';
		ctx.fillStyle    = this.keyTextColor;
		ctx.strokeStyle    = this.keyTextColor;

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
				hours + (mins<10?":0":":") + mins + (secs<10?":0":":") + secs.toFixed(d),
				(this.direction == "ltr") ? position + 2 : position - 2,
				this.keyTop + 2
			);
		}
		ctx.restore();
	};

	Timeline.prototype.renderBackground = function() {
		var ctx = this.ctx,
			grd = ctx.createLinearGradient(0,0,0,this.height);

		// Draw the backround color
		grd.addColorStop(0,this.backgroundColorBottom);
		grd.addColorStop(0.5,this.backgroundColorTop);
		grd.addColorStop(1,this.backgroundColorBottom);
		ctx.save();
		ctx.fillStyle = grd;
		ctx.globalCompositeOperation = "source-over";
		ctx.fillRect(0, 0, this.view.width, this.height);
		ctx.restore();
	};

	Timeline.prototype.renderTimeMarker = function() {
		var ctx, x = this.view.timeToPixel(this.timeMarkerPos)-1;
		if(x < -1 || x > this.view.width){ return; }
		ctx = this.ctx
		ctx.save();
		ctx.fillStyle = this.timeMarkerColor;
		ctx.fillRect(x, 0, 2, this.height);
		ctx.restore();
	};
		
	Timeline.prototype.renderABRepeat = function() {
		if(this.repeatA != null) {
			var left = this.view.timeToPixel(this.repeatA),
				right = this.view.timeToPixel(this.repeatB),
				ctx = this.ctx;
			ctx.save();
			ctx.fillStyle = this.abRepeatOn?this.abRepeatColor:this.abRepeatColorLight;
			ctx.fillRect(left, 0, right-left, this.height);
			ctx.restore();
		}
	};

	Timeline.prototype.render = function() {
		var aid, audio;
		this.renderBackground();
		this.renderKey();
		this.tracks.forEach(function(track){ track.render(); });
		for(aid in this.audio){ this.audio[aid].render(); }
		this.renderABRepeat();
		this.renderTimeMarker();
		this.slider.render();
	};
	
	Timeline.prototype.renderTrack = function(track) {		
		var ctx, x = this.view.timeToPixel(this.timeMarkerPos)-1;
		
		track.render();
		
		//redo the peice of the timeMarker that we drew over
		if(x < -1 || x > this.view.width){ return; }
		ctx = this.ctx;
		ctx.save();
		ctx.fillStyle = this.timeMarkerColor;
		ctx.fillRect(x, this.getTrackTop(track), 2, this.segmentTrackHeight);
		ctx.restore();
	};
	
	Timeline.prototype.updateTimeMarker = function(time) {
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
			this.slider.x = Math.round(time*(this.view.width - this.slider.width)/this.length);
		}
		
		this.render();
	};

	Timeline.prototype.updateCurrentSegments = function(){
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

	Timeline.prototype.setA = function(pos) {
		var time = this.view.pixelToTime(pos.x);
		this.repeatA = time;
		this.repeatB = time;
	};

	Timeline.prototype.setB = function(pos) {
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

	Timeline.prototype.updateB = function(pos) {
		this.repeatB = this.view.pixelToTime(pos.x);
		this.render();
	};

	Timeline.prototype.clearRepeat = function() {
		this.repeatA = null;
		this.repeatB = null;
		this.abRepeatOn = false;
		this.render();
	};
	
	return Timeline;
}());