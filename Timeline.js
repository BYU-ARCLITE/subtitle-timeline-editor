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
			length = params.length || 1800,
			abRepeatOn = false,
			that = this;

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
					var vlen, vend;
					if(val != length){
						length = val;
						vend = this.view.endTime;
						vlen = vend - this.view.startTime;
						if(length < vend){
							this.view.endTime = length;
							this.view.startTime = Math.max(0,length-vlen);
						}
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
			},timeMarkerPos: {
				value: 0, writable: true
			},cstack: {
				value: params.stack || new EditorWidgets.CommandStack()
			},
			abRepeatSet: {
				get: function(){ return !(this.repeatA === null || this.repeatB === null); }
			},
			abRepeatOn: {
				get: function(){ return abRepeatOn; },
				set: function(on){
					on = this.abRepeatSet && (!!on);
					if(abRepeatOn !== on){
						abRepeatOn = on;
						this.render();
						this.emit(on?'abRepeatEnabled':'abRepeatDisabled');
					}
					return on;
				}
			}
		});

		this.multi = !!params.multi;
		this.autoSelect = (typeof params.autoSelect === 'undefined') || !!params.autoSelect;
		this.currentTool = (typeof params.tool === 'number')?params.tool:Timeline.SELECT;
		
		this.selectedSegments = [];
		this.events = {};
		this.tracks = [];
		this.audio = {};
		this.trackIndices = {};

		this.activeElement = null;
		this.activeIndex = -1;
		this.sliderActive = false;
		this.scrubActive = false;

		this.slider = new Timeline.Slider(this);
		this.view = new Timeline.View(this, params.start || 0, params.end || 60);

		this.repeatA = null;
		this.repeatB = null;
		this.abRepeatSetting = false;

		// Sizing
		this.height = this.keyHeight + this.trackPadding + this.sliderHeight;

		//mouse control
		this.mouseDownPos = {x: 0, y: 0};
		this.mousePos = {x: 0, y: 0};
		this.scrollInterval = null;
		this.renderInterval = null;
		this.currentCursor = "pointer";
		
		//context menu
		this.activeMenu = null;
		
		// Canvas
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		canvas.width = width;
		canvas.height = this.height;
		canvas.addEventListener('mousemove', mouseMove.bind(this), false);
		canvas.addEventListener('mouseup', mouseUp.bind(this), false);
		canvas.addEventListener('mouseout', mouseUp.bind(this), false);
		canvas.addEventListener('mousedown', mouseDown.bind(this), false);
		canvas.addEventListener('mousewheel', mouseWheel.bind(this), false);
		canvas.addEventListener('DOMMouseScroll', mouseWheel.bind(this), false); //Firefox
		canvas.addEventListener('contextmenu', contextMenu.bind(this), false);
		document.addEventListener('click', function(){
			if(that.activeMenu){
				that.activeMenu.parentNode.removeChild(that.activeMenu);
				that.activeMenu = null;
			}
		},false);

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

	Timeline.ORDER = 0;
	Timeline.SELECT = 1;
	Timeline.MOVE = 2;
	Timeline.CREATE = 3;
	Timeline.DELETE = 4;
	Timeline.REPEAT = 5;
	Timeline.SCROLL = 6;
	Timeline.SHIFT = 7;
	Timeline.SPLIT = 8;

	Proto = Timeline.prototype;

	// Sizing
	Proto.trackHeight = 50;
	Proto.trackPadding = 10;
	Proto.sliderHeight = 25;
	Proto.sliderHandleWidth = 10;
	Proto.segmentTextPadding = 5;
	Proto.keyTop = 0;
	Proto.keyHeight = 25;
	
	Proto.mainMenuOptions = [
		{label:"Editing",submenu:[
			{label:"Undo",
				condition:function(){return this.cstack.undoDepth > 0; },
				action:function(){ this.cstack.undo(); }},
			{label:"Redo",
				condition:function(){return this.cstack.redoDepth > 0; },
				action:function(){ this.cstack.redo(); }},
			{label:"Tools",submenu:[
				{label:"Select",action:function(){ this.currentTool = Timeline.SELECT; }},
				{label:"Move",action:function(){ this.currentTool = Timeline.MOVE; }},
				{label:"Add",action:function(){ this.currentTool = Timeline.CREATE; }},
				{label:"Split",action:function(){ this.currentTool = Timeline.SPLIT; }},
				{label:"Delete",action:function(){ this.currentTool = Timeline.DELETE; }},
				{label:"Shift",action:function(){ this.currentTool = Timeline.SHIFT; }}
			]}
		]},
		{label:"Navigation",submenu:[
			{label:"Repeat Tool",action:function(){ this.currentTool = Timeline.REPEAT; }},
			{label:"Scroll Tool",action:function(){ this.currentTool = Timeline.ORDER; }},
			{label:"Order Tool",action:function(){ this.currentTool = Timeline.ORDER; }},
			{label:"Zoom In",action:function(pos){
				this.view.startTime += (this.view.pixelToTime(pos.x)-this.view.startTime)/2;
				this.view.endTime += (this.view.pixelToTime(pos.x)-this.view.endTime)/2;
				this.render();
			}},
			{label:"Zoom Out",action:function(pos){
				this.view.startTime -= (this.view.pixelToTime(pos.x)-this.view.startTime)/2;
				this.view.endTime -= (this.view.pixelToTime(pos.x)-this.view.endTime)/2;
				this.render();
			}}
		]},
		{label:"AB Repeat",submenu:[
			{label:"Enable",
				condition:function(){return this.abRepeatSet && !this.abRepeatOn; },
				action:function(){ this.abRepeatOn = true; }},
			{label:"Disable",
				condition:function(){return this.abRepeatOn; },
				action:function(){ this.abRepeatOn = false; }},
			{label:"Clear",
				condition:function(){return this.abRepeatSet; },
				action:function(){ this.clearRepeat(); }},
			{label:"Set Repeat Point",action:function(pos){
				this.abRepeatSetting = true;
				(this.abRepeatSet?updateABPoints:resetABPoints).call(this,pos);
			}}
		]}
	];
	
	Proto.trackMenuOptions = [
		{label:"Track",submenu:[
			{label:"Lock",
				condition:function(pos){ return !this.trackFromPos(pos).locked; },
				action:function(pos){ this.trackFromPos(pos).locked = true; }},
			{label:"Unlock",
				condition:function(pos){ return this.trackFromPos(pos).locked; },
				action:function(pos){ this.trackFromPos(pos).locked = false; }},
			{label:"Activate",
				condition:function(pos){
					var track = this.trackFromPos(pos);
					return !(track.locked || track.active);
				},
				action:function(pos){ this.trackFromPos(pos).active = true; }},
			{label:"Deactivate",
				condition:function(pos){
					var track = this.trackFromPos(pos);
					return !track.locked && track.active;
				},
				action:function(pos){ this.trackFromPos(pos).active = false; }}
		]}
	];
	
	Proto.segMenuOptions = [
		{label:"Segment",submenu:[
			{label:"Select",
				condition:function(pos){ return !this.segFromPos(pos).selected; },
				action:function(pos){ this.segFromPos(pos).select(); }},
			{label:"Unselect",
				condition:function(pos){ return this.segFromPos(pos).selected; },
				action:function(pos){ this.segFromPos(pos).unselect(); }},
			{label:"Split", action:function(pos){ this.segFromPos(pos).split(pos); }},
			{label:"Delete", action:function(pos){ this.segFromPos(pos).del(); }}
		]}
	];
	
	/** Event Triggers **/

	Proto.emit = function(evt, data){
		var that = this, fns = this.events[evt];
		fns && fns.forEach(function(cb){ try{cb.call(that,data);}catch(e){} });
	};

	Proto.on = function(name, cb){
		if(this.events.hasOwnProperty(name)){ this.events[name].push(cb); }
		else{ this.events[name] = [cb]; }
	};

	/** Context menu functions*/
	
	function clickMenu(action,pos){
		if(this.activeMenu){
			this.activeMenu.parentNode.removeChild(this.activeMenu);
			this.activeMenu = null;
		}
		action.call(this,pos);
	}
	
	function buildLevel(that, opts, pos){
		var menu = document.createElement('ul');
		opts.forEach(function(opt){
			if(opt.condition && !opt.condition.call(that,pos)){ return; }
			var li = document.createElement('li');
			li.innerHTML = "<a>"+opt.label+"</a>";
			(opt.submenu instanceof Array) &&
				li.appendChild(buildLevel(that, opt.submenu, pos));
			opt.action &&
				li.addEventListener('click',clickMenu.bind(that,opt.action,pos),false);
			menu.appendChild(li);
		});
		return menu;
	}
	
	Proto.showMenu = function(options,pos){
		var that = this,
			cvs = this.canvas,
			top = (pos.y + cvs.offsetTop),
			left = (pos.x + cvs.offsetLeft),
			menu = buildLevel(this,options,pos);
		if(top < cvs.offsetHeight/2){ menu.style.top = top + "px"; }
		else{ menu.style.bottom = (cvs.offsetHeight-top) + "px"; }
		if(left < cvs.offsetWidth/2){
			menu.className = "tl-context-menu";
			menu.style.left = left + 2 + "px";
		}else{
			menu.className = "tl-context-menu tl-menu-right";
			menu.style.right = (cvs.offsetWidth-left) + "px";
		}
		cvs.parentNode.appendChild(menu);
		this.activeMenu = menu;
	};
	
	/**
	 * Helper Functions
	 *
	 * These functions deal with manipulating the data
	 *
	 * Author: Joshua Monson
	 **/

	Proto.getTrackTop = function(track) {
		return this.keyHeight + this.trackPadding + (this.trackIndices[track.id] * (this.trackHeight + this.trackPadding));
	};

	Proto.getTrack = function(id){
		return this.trackIndices.hasOwnProperty(id)?this.tracks[this.trackIndices[id]]:null;
	};

	Proto.trackFromPos = function(pos) {
		return this.tracks[this.indexFromPos(pos)]||null;
	};
	
	Proto.segFromPos = function(pos) {
		var track = this.tracks[this.indexFromPos(pos)];
		if(!track){ return null; }
		return track.segFromPos(pos);
	};
	
	Proto.indexFromPos = function(pos){
		var i, bottom,
			padding = this.trackPadding,
			height = this.trackHeight,
			top = this.keyHeight + this.trackPadding;
		for(i = 0; i < this.tracks.length; i++, top = bottom + padding) {
			bottom = top + height;
			if(pos.y >= top && pos.y <= bottom)
				return i;
		}
		return -1;
	};

	function swaptracks(n,o){
		this.tracks[this.trackIndices[n.id]] = n;
		n.render();
		this.cstack.removeEvents(o.id);
		this.emit("removetrack",o);
		this.emit("addtrack",n);
	}
	
	Proto.addTextTrack = function(track,overwrite) {
		if(track instanceof Timeline.TextTrack){
			if(!overwrite && this.trackIndices.hasOwnProperty(track.id)){ throw new Error("Track name already in use."); }
		}else{
			if(!overwrite && this.trackIndices.hasOwnProperty(track.label)){ throw new Error("Track name already in use."); }
			track = new Timeline.TextTrack(this, track);
		}
		if(this.trackIndices.hasOwnProperty(track.id)){
			swaptracks.call(this,track,this.tracks[this.trackIndices[track.id]]);
		}else{
			this.trackIndices[track.id] = this.tracks.length;
			this.tracks.push(track);
			// Adjust the height
			this.height += this.trackHeight + this.trackPadding;
			this.canvas.height = this.height;
			this.overlay.height = this.height;
			this.render();
			this.emit("addtrack",track);
		}
	};

	Proto.removeTextTrack = function(id) {
		var i,t,track,aid,loc;
		if(this.trackIndices.hasOwnProperty(id)){
			loc = this.trackIndices[id];
			aid = this.tracks[loc].audioId;
			if(this.audio.hasOwnProperty(aid)){ this.audio[aid].references--; }
			track = this.tracks.splice(loc, 1)[0];
			delete this.trackIndices[id];

			for(i=loc;t=this.tracks[i];i++){
				this.trackIndices[t.id] = i;
			}

			// Adjust the height
			this.height -= this.trackHeight + this.trackPadding;
			this.canvas.height = this.height;
			this.overlay.height = this.height;
			this.render();
			this.cstack.removeEvents(track.id);
			this.emit("removetrack",track);
		}
	};
	
	Proto.alterTextTrack = function(tid, kind, lang, name, overwrite) {
		var track = this.tracks[this.trackIndices[tid]];
		if(!track){ throw new Error("Track does not exist"); }
		if(this.trackIndices.hasOwnProperty(name)){
			if(!overwrite){ throw new Error("Track name already in use."); }
			this.removeTextTrack(name);
		}
		track.textTrack.kind = kind;
		track.textTrack.language = lang;
		track.id = name; //re-rendering is a side-effect
	};
	
	Proto.addAudioTrack = function(wave, id) {
		var track;
		if(this.audio.hasOwnProperty(id)){ throw new Error("Track with that id already loaded."); }
		if(wave instanceof Timeline.AudioTrack){
			track = wave;
			id = wave.id;
		}else{
			track = new Timeline.AudioTrack(this, wave, id);
		}
		this.audio[id] = track;
		this.render();
	};

	Proto.removeAudioTrack = function(id){
		var i, top, ctx, track;
		if(!this.audio.hasOwnProperty(id)){ return; }
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

	Proto.setAudioTrack = function(tid, aid){
		var track;
		if(!this.trackIndices.hasOwnProperty(tid)){ return; }
		track = this.tracks[this.trackIndices[tid]];
		if(this.audio.hasOwnProperty(track.audioId)){ this.audio[track.audioId].references--; }
		track.audioId = aid;
		if(this.audio.hasOwnProperty(aid)){
			this.audio[aid].references++;
			this.audio[aid].render();
		}
	};

	Proto.unsetAudioTrack = function(tid){
		var track, audio;
		if(!this.trackIndices.hasOwnProperty(tid)){ return; }
		track = this.tracks[this.trackIndices[tid]];
		audio = this.audio[track.audioId];
		if(audio){
			track.audioId = null;
			audio.references--;
			audio.render();
		}
	};

	Proto.addSegment = function(tid, cue, select){
		if(!this.trackIndices.hasOwnProperty(tid)){ return; }
		this.tracks[this.trackIndices[tid]].add(cue, select);
	};
	
	/** Drawing functions **/

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
		offset = this.canvas.dir === 'rtl' ? -2 : 2;

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

	Proto.renderABRepeat = function() {
		if(this.abRepeatSet) {
			var left = this.view.timeToPixel(this.repeatA),
				right = this.view.timeToPixel(this.repeatB),
				ctx = this.ctx;
			ctx.save();
			ctx.fillStyle = this.colors[this.abRepeatOn?'abRepeat':'abRepeatLight'];
			ctx.fillRect(left, 0, right-left, this.height);
			ctx.restore();
		}
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

	/** Time functions **/

	Object.defineProperties(Proto,{
		currentTime: {
			set: function(time){
				var timewidth;
				if(time == this.timeMarkerPos){ return time; }
				if(this.abRepeatOn && time > this.repeatB) {
					time = this.repeatA;
					this.emit('jump',this.repeatA);
				}
				this.timeMarkerPos = time;
				this.tracks.forEach(function(track){ track.textTrack.currentTime = time; });
				this.emit('timeupdate', time);

				//move the view
				if(time < this.view.startTime){
					timewidth = this.view.length/4;
					this.view.endTime = time + timewidth;
					this.view.startTime = time - 3*timewidth;
				}else if(time > this.view.endTime) {
					timewidth = this.view.length/4;
					this.view.endTime = time + 3*timewidth;
					this.view.startTime = time - timewidth;
				}

				this.render();
				return this.timeMarkerPos;
			},
			get: function(){return this.timeMarkerPos;},
			enumerable: true
		},
		timeCode: {
			get: function(){
				var time = this.timeMarkerPos,
					secs = time % 60,
					mins = Math.floor(time / 60),
					hours = Math.floor(mins / 60);
				mins %= 60;
				return hours + (mins<10?":0":":") + mins + (secs<10?":0":":") + secs.toFixed(3);
			},enumerable: true
		}
	});

	function updateABPoints(pos){
		this[pos.x < this.view.timeToPixel((this.repeatA + this.repeatB) / 2)?'repeatA':'repeatB'] = this.view.pixelToTime(pos.x);
		this.render();
	}
	
	function resetABPoints(pos){
		this.repeatB = this.repeatA = this.view.pixelToTime(pos.x);
		this.emit('abRepeatSet');
	}

	Proto.clearRepeat = function() {
		this.repeatA = null;
		this.repeatB = null;
		this.abRepeatSetting = false;
		//the setter takes care of re-rendering
		if(this.abRepeatOn){ this.abRepeatOn = false; }
		else{ this.render(); }
		this.emit('abRepeatUnset');
	};

	/** Persistence functions **/
		
	Proto.exportTracks = function(mime, id) {
		var that = this;
		
		TimedText.checkType(mime);
			
		return (function(){
			var track;
			if(typeof id === 'string'){ //save a single track
				track = that.getTrack(id);
				if(track === null){ throw new Error("Track "+id+" Does Not Exist."); }
				return [track];
			}else if(id instanceof Array){ //save multiple tracks
				return id.map(function(tid){
					track = that.getTrack(tid);
					if(track === null){ throw new Error("Track "+tid+" Does Not Exist"); }
					return track;
				});
			}else{ //save all tracks
				return that.tracks;
			}
		})().map(function(track){
			return {
				collection:"tracks",
				mime: mime,
				name: TimedText.addExt(mime,track.id),
				data: track.serialize(mime)
			};
		});
	};
	
	Proto.loadTextTrack = function(url, kind, lang, name, overwrite){
		var that = this,
			params = {
				kind: kind,
				lang: lang,
				label: name,
				success: function(t){ that.addTextTrack(t,overwrite); },
				error: function(){ alert("There was an error loading the track."); }
			};
		params[(url instanceof File)?'file':'url'] = url;
		TextTrack.get(params);
	};

	/** Scroll Tool Functions **/

	function autoScroll(){
		var delta = this.mousePos.x/this.width-.5;
		if(delta){
			this.view.move(10*(delta)*this.view.zoom);
			this.render();
		}
	}

	function initScroll(){
		this.currentCursor = 'move';
		this.canvas.style.cursor = this.cursors.move;
		this.scrollInterval = setInterval(autoScroll.bind(this),1);
	}

	function autoSizeL(){
		var mx = this.mousePos.x,
			dx = mx - this.slider.startx;
		if(dx){
			this.view.startTime += dx*this.view.zoom/10;
			this.render();
		}
	}

	function autoSizeR(){
		var mx = this.mousePos.x,
			dx = mx - this.slider.endx;
		if(dx){
			this.view.endTime += dx*this.view.zoom/10;
			this.render();
		}
	}

	function initResize(){
		var diff = this.mouseDownPos.x - this.slider.middle;
		if(diff < 0){
			this.currentCursor = 'resizeL';
			this.canvas.style.cursor = this.cursors.resizeL;
			this.scrollInterval = setInterval(autoSizeL.bind(this),1);
		}else if(diff > 0){
			this.currentCursor = 'resizeR';
			this.canvas.style.cursor = this.cursors.resizeR;
			this.scrollInterval = setInterval(autoSizeR.bind(this),1);
		}
	}

	/**
	 * Event Listeners and Callbacks
	 *
	 * These listeners include mouseMove, mouseUp, and mouseDown.
	 * They check the mouse location and active elements and call their mouse listener function.
	 *
	 * Author: Joshua Monson
	 **/

	function updateCursor(pos) {
		if(typeof pos !== 'object')
			return;
		var i,j,track,seg,shape,
			cursor = 'pointer';

		// Check the slider
		i = this.slider.onHandle(pos);
		if(i === 1) {
			cursor = 'resizeR';
		}else if(i === -1) {
			cursor = 'resizeL';
		}else if(this.slider.containsPoint(pos)) {
			cursor = 'move';
		}else
		// Check the key
		if(pos.y < this.keyHeight+this.trackPadding) {
			cursor = 'skip';
		}else if(this.currentTool === Timeline.REPEAT){
			cursor = !(this.abRepeatOn || this.abRepeatSetting) || pos.x < this.view.timeToPixel((this.repeatA + this.repeatB) / 2)?'repeatA':'repeatB';
		}else if(this.currentTool === Timeline.SCROLL){
			cursor =	(this.mousePos.y < (this.height - this.sliderHeight - this.trackPadding))?'move':
						(this.mousePos.x < this.slider.middle)?'resizeL':'resizeR';
		}else if(track = this.trackFromPos(pos)){ // Are we on a track?
			cursor = 	(this.currentTool === Timeline.ORDER)?'order':
						(this.currentTool === Timeline.SHIFT)?'move':
						track.getCursor(pos);
		}
		if(this.currentCursor != cursor){
			this.currentCursor = cursor;
			this.canvas.style.cursor = this.cursors[cursor];
		}
	}

	function mouseMove(ev) {
		var i, delta, active, swap,
			pos = {x: ev.offsetX || ev.layerX, y: ev.offsetY || ev.layerY};

		this.mousePos = pos;

		if(this.scrollInterval){ return; }
		if(this.scrubActive){
			i = this.view.pixelToTime(pos.x);
			this.emit('jump',i);
			this.currentTime = i;
		}else if(this.currentTool == Timeline.REPEAT && this.abRepeatSetting){
			updateABPoints.call(this,pos);
			updateCursor.call(this,pos);
			this.render();
		}else if(this.currentTool == Timeline.ORDER
			&& this.activeIndex !== -1){
			i = this.indexFromPos(pos);
			if(i !== -1 && i !== this.activeIndex){			
				swap = this.tracks[i];
				active = this.tracks[this.activeIndex];
				
				this.tracks[i] = active;	
				this.tracks[this.activeIndex] = swap;
				
				this.trackIndices[swap.id] = this.activeIndex;
				this.trackIndices[active.id] = i;
				
				this.activeIndex = i;
				this.render(); //could gain efficiency by just copying image segments
			}
		}else if(this.sliderActive){
			this.slider.mouseMove(pos);
		}else if(this.activeElement){
			this.activeElement.mouseMove(pos);
		}else{
			updateCursor.call(this,pos);
		}

		ev.preventDefault();
	}

	function mouseUp(ev) {
		if(ev.button > 0){ return; }
		var id, pos = {x: ev.offsetX || ev.layerX, y: ev.offsetY || ev.layerY};

		if(this.scrubActive){
			this.scrubActive = false;
			updateCursor.call(this,pos);
		}else if(this.sliderActive) {
			this.slider.mouseUp(pos);
			this.sliderActive = false;
			for(id in this.audio){ this.audio[id].redraw(); }
		}else if(this.scrollInterval){
			clearInterval(this.scrollInterval);
			this.scrollInterval = null;
			for(id in this.audio){ this.audio[id].redraw(); }
		}else if(this.currentTool == Timeline.REPEAT) {
			this.abRepeatSetting = false;
			this.abRepeatOn = (this.repeatA !== this.repeatB);
		}else if(this.activeElement !== null) {
			this.activeElement.mouseUp(pos);
			this.activeElement = null;
		}
		
		this.activeIndex = -1;
		
		ev.preventDefault();
	}

	function mouseDown(ev) {
		if(ev.button > 0){ return; }
		var pos = {x: ev.offsetX || ev.layerX, y: ev.offsetY || ev.layerY},
			track,i;
		
		if(this.activeMenu){
			this.activeMenu.parentNode.removeChild(this.activeMenu);
			this.activeMenu = null;
		}
		
		this.mouseDownPos = pos;
		this.mousePos = pos;

		if(pos.y > this.height - this.sliderHeight - this.trackPadding){ // Check the slider
			if(this.slider.containsPoint(pos)) {
				this.slider.mouseDown(pos);
				this.sliderActive = true;
			}else if(this.currentTool == Timeline.SCROLL){
				initResize.call(this);
			}else{
				this.slider.middle = pos.x;
				this.render();
				if(pos.y > this.height - this.sliderHeight){
					this.slider.mouseDown(pos);
					this.sliderActive = true;
					this.canvas.style.cursor = this.cursors.move;
				}
			}
		}else if(pos.y < this.keyHeight+this.trackPadding) { // Check the key
			this.scrubActive = true;
			i = this.view.pixelToTime(pos.x);
			this.emit('jump',i);
			this.currentTime = i;
		}else switch(this.currentTool){
			case Timeline.REPEAT:
				this.abRepeatSetting = true;
				(this.abRepeatSet?updateABPoints:resetABPoints).call(this,pos);
				break;
			case Timeline.SCROLL:
				initScroll.call(this);
				break;
			case Timeline.ORDER:
				this.activeIndex = this.indexFromPos(pos);
				break;
			default: // Check tracks
				track = this.trackFromPos(pos);
				this.activeElement = track;
				track && track.mouseDown(pos);
		}
		ev.preventDefault();
	}
	
	function mouseWheel(ev) {
		var i, that = this,
			pos = {x: ev.offsetX || ev.layerX, y: ev.offsetY || ev.layerY},
			delta =  ev.detail?(ev.detail>0?-1:1):(ev.wheelDelta>0?1:-1);

		if(this.activeMenu){
			this.activeMenu.parentNode.removeChild(this.activeMenu);
			this.activeMenu = null;
		}
			
		this.mousePos = pos;

		if(pos.y > this.height - this.sliderHeight - this.trackPadding){ // Check the slider
			this.slider.middle += delta;
		}else if(pos.y < this.keyHeight+this.trackPadding) { // Check the key
			i = Math.min(Math.max(this.currentTime + delta*this.view.zoom,0),this.length);
			if(i !== this.currentTime){
				this.emit('jump',i);
				this.currentTime = i;
			}
		}else{
			delta /= 10;
			this.view.startTime += delta*(this.view.pixelToTime(pos.x)-this.view.startTime);
			this.view.endTime += delta*(this.view.pixelToTime(pos.x)-this.view.endTime);
		}
		this.render();
		Object.keys(this.audio).forEach(function(key){ that.audio[key].redraw(); });
		ev.preventDefault();
		return false;
	}
	
	function contextMenu(ev) {
		var pos = {x: ev.offsetX || ev.layerX, y: ev.offsetY || ev.layerY},
			seg, track = this.trackFromPos(pos),
			opts = this.mainMenuOptions;

		if(this.activeMenu){
			this.activeMenu.parentNode.removeChild(this.activeMenu);
			this.activeMenu = null;
		}
		if(track){
			opts = this.trackMenuOptions.concat(opts);
			seg = track.segFromPos(pos);
			if(seg){ opts = this.segMenuOptions.concat(opts); }
		}
		this.showMenu(opts,pos);
		ev.preventDefault();
	}

	return Timeline;
}());