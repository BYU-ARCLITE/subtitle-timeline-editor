(function(Timeline){
	"use strict";

	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}

	var TProto, SProto, PProto;

	function order(a,b){
		//sort first by start time, then by length
		return (a.startTime - b.startTime) || (b.endTime - a.endTime);
	}

	function TextTrack(tl, cuetrack){
		var active = true,
			that = this;
		if(tl.trackIndices.hasOwnProperty(cuetrack.label)){
			throw new Error("Track name already in use.");
		}
		this.tl = tl;
		this.cues = cuetrack;
		this.segments = cuetrack.cues.map(function(cue){ return new Segment(that, cue); });
		this.segments.sort(order);
		this.visibleSegments = [];
		this.audioId = null;
		this.placeholder = null;
		this.locked = false;

		Object.defineProperty(this,'active',{
			get: function(){ return active; },
			set: function(val){
				if(!this.locked){
					val = !!val;
					if(val != active){
						active = val;
						if(!active){ this.segments.forEach(function(seg){ seg.selected = false; }); }
						tl.renderTrack(this);
						if(this.audioId){ tl.audio[this.audioId].draw(); }
					}
				}
				return active;
			}
		});
	}

	TProto = TextTrack.prototype;

	Object.defineProperties(TProto,{
		id: {
			get: function(){ return this.cues.label; },
			set: function(val){
				if(tl.trackIndices.hasOwnProperty(val)){
					throw new Error("Track name already in use.");
				}
				return this.cues.label = val;
			},enumerable: true
		},
		language: {
			get: function(){ return this.cues.language; },
			set: function(val){ return this.cues.language = val; },
			enumerable: true
		},
		kind: {
			get: function(){ return this.cues.kind; },
			set: function(val){ return this.cues.kind = val; },
			enumerable: true
		}
	});

	function recreateSeg(){
		this.deleted = false;
		this.track.cues.addCue(this.cue);
		this.visible && this.tl.renderTrack(this.track);
		this.tl.emit('create',this);
	}

	function deleteSeg(){
		var i, vis = this.visible,
			s_segs = this.tl.selectedSegments;
		this.deleted = true;
		this.selected = false;
		i = s_segs.indexOf(this);
		if(i !== -1){ s_segs.splice(i,1); }
		this.track.cues.removeCue(this.cue);
		vis && this.tl.renderTrack(this.track);
		this.tl.emit('delete',this);
	}

	TProto.add = function(cue, select){
		var tl = this.tl, seg;

		if(!(cue instanceof TimedText.Cue)){
			cue = new TimedText.Cue(
				(typeof cue.id === 'undefined')?"":cue.id,
				cue.startTime, cue.endTime,
				(typeof cue.text === 'string')?cue.text:""
			);
		}

		this.cues.addCue(cue);

		seg = new Segment(this, cue);
		this.segments.push(seg);
		this.segments.sort(order);

		// Save the action
		tl.cstack.push({
			context: seg,
			undo: deleteSeg,
			redo: recreateSeg
		});

		tl.emit('create', seg);
		if(select){ seg.select(); }
		else if(seg.visible){ tl.renderTrack(this); }
		return seg;
	};

	TProto.getSegment = function(id){
		var i, segs = this.segments,
			len = segs.length;
		for(i=0;i<len;i++){
			if(segs[i].uid === id){ return segs[i]; }
		}
	};

	TProto.getCursor = function(pos) {
		if(typeof pos !== 'object') return;
		var tl = this.tl,seg,j;

		if(!this.active || this.locked){ return 'locked'; }
		if(tl.currentTool === Timeline.CREATE){ return 'add'; }
		
		//Check segments; traverse backwards so you get the ones on top
		for(j=this.visibleSegments.length-1;seg=this.visibleSegments[j];j--){
			if(seg.containsPoint(pos)){	return seg.getCursor(pos); }
		}
		return 'pointer';
	};
	
	TProto.render = function(){
		var tl = this.tl,
			startTime = tl.view.startTime,
			ctx = tl.ctx,
			audio = this.audio,
			selected = [];

		ctx.save();

		ctx.translate(0,tl.getTrackTop(this));

		ctx.fillStyle = ctx.createPattern(tl.images.trackBg, "repeat-x");
		ctx.fillRect(0, 0, tl.width, tl.trackHeight);

		ctx.textBaseline = 'middle';
		ctx.font = tl.fonts.titleFont;
		ctx.fillStyle = tl.fonts.titleTextColor;
		ctx.fillText(this.id, tl.width/100, tl.trackHeight/2);

		ctx.restore();

		this.visibleSegments = this.segments.filter(function(seg){return seg.visible;});
		this.visibleSegments.forEach(function(seg){
			if(seg.selected){ selected.push(seg); }
			else{ seg.render(); }
		});
		selected.forEach(function(seg){ seg.render(); });
		this.placeholder && this.placeholder.render();
	};

	TProto.serialize = function(type){
		return TimedText.serializeTrack(type, this.cues);
	};
	
	TProto.mouseDown = function(pos){
		if(typeof pos !== 'object') return;
		var tl = this.tl,seg,j;
		if(tl.currentTool === Timeline.CREATE){
			if(this.active && !this.locked){
				this.placeholder = tl.activeElement = new Placeholder(tl, this, pos.x);
			}
		}else{	//search backwards 'cause later segments are on top
			for(j=this.visibleSegments.length-1;seg=this.visibleSegments[j];j--) {
				if(seg.containsPoint(pos)){
					tl.activeElement = seg;
					seg.mouseDown(pos);
					return;
				}
			}
		}		
	};

	function Segment(track, cue) {
		this.tl = track.tl;
		this.track = track;
		this.cue = cue;
		this.move = false;
		this.deleted = false;
		this.selected = false;
		this.resizeSide = 0;

		// For undo/redo
		this.initialStart = 0;
		this.initialEnd = 0;

		// For mouse control
		this.startingPos = 0;
		this.startingLength = 0;
	}

	SProto = Segment.prototype;

	function textChangeGenerator(text){
		return function(){
			this.cue.text = text;
			this.tl.renderTrack(this.track);
			this.tl.emit('textchange',this);
		};
	}

	function idChangeGenerator(id){
		return function(){
			this.cue.id = id;
			this.tl.renderTrack(this.track);
			this.tl.emit('idchange',this);
		};
	}

	Object.defineProperties(SProto,{
		selectable: { get: function(){ return !this.track.locked && this.track.active; }, enumerable: true },
		active: {
			get: function(){
				var mark = this.tl.timeMarkerPos;
				return mark > this.cue.startTime && mark < this.cue.endTime;
			},enumerable: true
		},
		visible: {
			get: function(){
				var cue = this.cue,
					view = this.tl.view;
				return !this.deleted && cue.startTime < view.endTime && cue.endTime > view.startTime;
			}, enumerable: true
		},
		uid: { get: function(){ return this.cue.uid; }, enumerable: true },
		id: {
			set: function(id){
				var tl = this.tl,
					cue = this.cue;
				if(cue.id === id){ return id; }
				tl.cstack.push({
					context:this,
					undo: idChangeGenerator(cue.id),
					redo: idChangeGenerator(id)
				});
				cue.id = id;
				tl.renderTrack(this.track);
				tl.emit('idchange',this);
				return id;
			},
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
				tl.cstack.push({
					context:this,
					undo: textChangeGenerator(cue.text),
					redo: textChangeGenerator(t)
				});
				cue.text = t;
				tl.renderTrack(this.track);
				tl.emit('textchange',this);
				return t;
			},
			get: function(){return this.cue.text;},
			enumerable: true
		}
	});

	SProto.getCursor = function(pos){
		var i;
		if(typeof pos !== 'object')	return;
		switch(this.tl.currentTool){
			case Timeline.SELECT: return 'select';
			case Timeline.DELETE: return 'remove';
			case Timeline.MOVE:
				i = this.getMouseSide(pos);
				return	i === 1?'resizeR':
							i === -1?'resizeL':
							'move';
			default: return 'pointer';
		}
	};
	
	SProto.select = function(){
		var id, tl = this.tl,
			trackmap = {};
		if(this.selected){ return; }
		this.selected = true;
		if(this.visible){ trackmap[this.track.id] = this.track; }
		if(!tl.multi){
			tl.selectedSegments.forEach(function(seg){
				seg.selected = false;
				if(seg.visible){ trackmap[seg.track.id] = seg.track; }
				tl.emit('unselect',seg);
			});
			tl.selectedSegments = [this];
		}else{
			tl.selectedSegments.push(this);
		}
		for(id in trackmap){
			tl.renderTrack(trackmap[id]);
		}
		tl.emit('select',this);
	};

	SProto.unselect = function(){
		if(!this.selected){ return; }
		var tl = this.tl;
		this.selected = false;
		tl.selectedSegments.splice(tl.selectedSegments.indexOf(this),1);
		if(this.visible){ tl.renderTrack(this.track); }
		tl.emit('unselect', this);
	};

	SProto.serialize = function(type){
		return this.deleted?"":TimedText.serializeCue(type, this.cue);
	};

	// Location computation
	SProto.getShape = function() {
		var tl = this.tl,
			x = tl.view.timeToPixel(this.startTime),
			y = tl.getTrackTop(this.track),
			width = tl.view.timeToPixel(this.endTime) - x;
		return {x: x, y: y, width: width, height: tl.trackHeight};
	};

	SProto.containsPoint = function(pos) {
		var s = this.getShape();
		return (pos.x >= s.x && pos.x <= s.x + s.width && pos.y >= s.y && pos.y <= s.y + s.height);
	};

	SProto.getMouseSide = function(pos) {
		var tl = this.tl,
			images = tl.images,
			shape = this.getShape(),
			x, left, right;

		if(this.selected){
			left = images.segmentLeftSel;
			right = images.segmentRightSel;
		}else if(this.selectable){
			left = images.segmentLeft;
			right = images.segmentRight;
		}else{
			left = images.segmentLeftDark;
			right = images.segmentRightDark;
		}
		if(shape.width < left.width + right.width){
			return 0;
		}else{
			x = pos.x - shape.x;
			return	(x < left.width)?-1:
					(x > shape.width - right.width)?1:
					0;
		}
	};

	// Event handlers
	SProto.mouseDown = function(pos) {
		if(this.deleted || !this.selectable)
			return;

		this.startingPos = this.tl.view.timeToPixel(this.startTime);
		this.startingLength = this.endTime - this.startTime;

		switch(this.tl.currentTool){
			case Timeline.SELECT:
				if(this.selected){ this.unselect(); }
				else{ this.select(); }
				break;
			case Timeline.MOVE:
				this.resizeSide = this.getMouseSide(pos);
				this.move = true;
				this.initialStart = this.startTime;
				this.initialEnd = this.endTime;
		}
	};

	function moveGenerator(type,start,end){
		return function(){
			this.startTime = start;
			this.endTime = end;
			this.track.cues.update();
			this.tl.renderTrack(this.track);
			this.tl.emit(type,this);
		};
	}

	SProto.mouseUp = function(pos) {
		if(this.deleted || !this.selectable)
			return;

		var tl = this.tl,
			action = {context: this},
			etype, s_segs, i;

		switch(tl.currentTool) {
			case Timeline.MOVE:
				this.move = false;
				this.track.segments.sort(Segment.order);
				this.track.cues.update();
				// Save the move
				switch(this.resizeSide){
					case 0:
						etype = 'move';
						action.redo = moveGenerator('move',this.startTime,this.endTime);
						break;
					case -1:
						etype = 'resizel';
						action.redo = moveGenerator('resizel',this.startTime,this.initialEnd);
						break;
					case 1:
						etype = 'resizel';
						action.redo = moveGenerator('resizel',this.initialStart,this.endTime);
				}
				action.undo = moveGenerator(etype,this.initialStart,this.initialEnd);
				tl.cstack.push(action);
				tl.emit(etype,this);
				break;
			case Timeline.DELETE:
				this.deleted = true;
				this.selected = false;
				this.track.cues.removeCue(this.cue);

				s_segs = tl.selectedSegments;
				i = s_segs.indexOf(this);
				if(i !== -1){ s_segs.splice(i,1); }

				// Save the delete
				tl.cstack.push({
					context: this,
					redo: deleteSeg,
					undo: recreateSeg
				});
				tl.renderTrack(this.track);
				tl.emit('delete',this);
		}
	};

	SProto.mouseMove = function(pos) {
		if(this.deleted || !this.selectable)
			return;

		var tl = this.tl,
			activeStart, newTime, maxStartTime;

		if(!this.move){ return; }

		activeStart = this.active;
		newTime = tl.view.pixelToTime(this.startingPos + pos.x - tl.mouseDownPos.x);
		switch(this.resizeSide){
			case 0:
				maxStartTime = tl.length - this.startingLength;
				if(newTime < 0){ newTime = 0; }
				else if(newTime > maxStartTime){ newTime = maxStartTime; }
				this.startTime = newTime;
				this.endTime = newTime + this.startingLength;
				tl.emit('move',this);
				break;
			case -1:
				if(newTime < 0){ newTime = 0; }
				else if(newTime >= this.endTime){ newTime = this.endTime - .001; }
				this.startTime = newTime;
				tl.emit('resizel',this);
				break;
			case 1:
				newTime += this.startingLength;
				if(newTime <= this.startTime){ newTime = this.startTime + .001; }
				else if(newTime > tl.length){ newTime = tl.length; }
				this.endTime = newTime;
				tl.emit('resizer',this);
				break;
			default:
				throw new Error("Invalid State");
		}
		tl.renderTrack(this.track);
		if(activeStart != this.active){ this.track.cues.update(); }
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

	SProto.render = function() {
		if(this.deleted)
			return;

		var tl = this.tl,
			images = tl.images,
			fonts = tl.fonts,
			ctx = tl.ctx,
			shape = this.getShape(),
			x = shape.x,
			y = shape.y,
			direction, dir, text;

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

				text = TimedText.textPreviewers[this.track.kind](this.text);
				direction = Ayamel.Text.getDirection(text);
				tl.canvas.dir = direction;

				ctx.font = fonts.segmentFont;
				ctx.fillStyle = fonts.segmentTextColor;
				ctx.fillText(text, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, y);

				tl.canvas.dir = dir; //restore
			}
			ctx.restore();
		}
	};

	function Placeholder(tl, track, x) {
		this.tl = tl;
		this.track = track;
		this.startx = x;
		this.endx = x;
		tl.emit("startcreate", tl.view.pixelToTime(x));
	}

	PProto = Placeholder.prototype;
	
	PProto.render = function() {
		var tl = this.tl,
			ctx = tl.ctx,
			top = tl.getTrackTop(this.track);
		ctx.save();
		ctx.fillStyle = tl.colors.placeholder;
		ctx.globalAlpha = .5;
		ctx.fillRect(this.startx, top, this.endx - this.startx, tl.trackHeight);
		ctx.restore();
	};

	PProto.mouseMove = function(pos) {
		var tl = this.tl;
		this.endx = pos.x;
		tl.emit("endcreate", tl.view.pixelToTime(pos.x));
		tl.renderTrack(this.track);
	};

	PProto.mouseUp = function(pos) {
		var view = this.tl.view,
			startx, endx;

		if(this.startx < pos.x){
			startx = this.startx;
			endx = pos.x;
		}else{
			startx = pos.x;
			endx = this.startx;
		}
		this.track.placeholder = null;
		this.track.add({
			id: "",
			startTime: view.pixelToTime(startx),
			endTime: view.pixelToTime(endx)
		}, this.tl.autoSelect);
	};
	
	Timeline.TextTrack = TextTrack;
}(Timeline));