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
		this.tl = tl;
		this.textTrack = cuetrack;
		this.segments = cuetrack.cues.map(function(cue){ return new Segment(that, cue); });
		this.segments.sort(order);
		this.visibleSegments = [];
		this.audioId = null;
		this.placeholder = null;
		this.lastPos = null;
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
			get: function(){ return this.textTrack.label; },
			set: function(val){
				var tl = this.tl,
					oldid = this.textTrack.label;
				if(tl.trackIndices.hasOwnProperty(val)){
					throw new Error("Track name already in use.");
				}
				tl.trackIndices[val] = tl.trackIndices[oldid];
				delete tl.trackIndices[oldid];
				tl.cstack.renameEvents(oldid,val);
				this.textTrack.label = val;
				tl.render();
				return val;
			},enumerable: true
		},
		language: {
			get: function(){ return this.textTrack.language; },
			set: function(val){ return this.textTrack.language = val; },
			enumerable: true
		},
		kind: {
			get: function(){ return this.textTrack.kind; },
			set: function(val){
				this.textTrack.kind = val;
				this.tl.render();
				return val;
			},
			enumerable: true
		}
	});

	function recreateSeg(){
		this.deleted = false;
		this.track.textTrack.addCue(this.cue);
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
		this.track.textTrack.removeCue(this.cue);
		vis && this.tl.renderTrack(this.track);
		this.tl.emit('delete',this);
	}

	TProto.add = function(cue, select){
		var tl = this.tl, seg;

		if(!(cue instanceof TextTrackCue)){
			cue = new TextTrackCue(
				cue.startTime, cue.endTime,
				(typeof cue.text === 'string')?cue.text:""
			);
		}

		this.textTrack.addCue(cue);

		seg = new Segment(this, cue);
		this.segments.push(seg);
		this.segments.sort(order);

		// Save the action
		tl.cstack.push({
			file: this.textTrack.label,
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
		var i, seg, segs,
			tl = this.tl,
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
		
		segs = this.segments.filter(function(seg){return seg.visible;});
		this.visibleSegments = segs;
		for(i=0;seg=segs[i];i++){
			if(seg.selected){ selected.push(seg); }
			else{ seg.render(); }
		}
		for(i=0;seg=selected[i];i++){ seg.render(); }
		this.placeholder && this.placeholder.render();
	};

	TProto.serialize = function(type){
		return TimedText.serializeTrack(type, this.textTrack);
	};
	
	TProto.segFromPos = function(pos){
		var j, seg, 
			segs = this.visibleSegments,
			selected = segs.filter(function(seg){ return seg.selected; });
		for(j=selected.length-1;seg=selected[j];j--) {
			if(seg.containsPoint(pos)){ return seg; }
		}
		for(j=segs.length-1;seg=segs[j];j--) {
			if(seg.containsPoint(pos)){ return seg; }
		}
		return null;
	};
	
	TProto.mouseDown = function(pos){
		if(typeof pos !== 'object'){ return; }
		var tl = this.tl, seg;
		if(tl.currentTool === Timeline.CREATE){
			if(this.active && !this.locked){
				this.placeholder = tl.activeElement = new Placeholder(tl, this, pos.x);
			}
		}else if(tl.currentTool === Timeline.SHIFT){
			if(this.active && !this.locked){
				this.segments.forEach(function(seg){ seg.mouseDown(pos); });
			}
		}else{	//search backwards 'cause later segments are on top
			seg = this.segFromPos(pos);
			if(seg !== null){
				tl.activeElement = seg;
				seg.mouseDown(pos);
			}
		}		
	};
	
	TProto.mouseMove = function(pos){
		if(typeof pos !== 'object'){ return; }
		if(this.tl.currentTool === Timeline.SHIFT && this.active && !this.locked){
			this.segments.forEach(function(seg){ seg.mouseMove(pos); });
			this.render();
		}
	};
	
	TProto.mouseUp = function(pos){
		if(typeof pos !== 'object'){ return; }
		if(this.tl.currentTool === Timeline.SHIFT && this.active && !this.locked){
			this.segments.forEach(function(seg){ seg.move = false; });
			//generate undo/redo event
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
		
		this.shape = {};
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
					file: this.track.textTrack.label,
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
					file: this.track.textTrack.label,
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
	
	SProto.del = function(){
		var i, tl = this.tl,
			s_segs = tl.selectedSegments;
			
		this.track.textTrack.removeCue(this.cue);
		this.deleted = true;

		i = s_segs.indexOf(this);
		if(i !== -1){ s_segs.splice(i,1); }

		// Save the delete
		tl.cstack.push({
			file: this.track.textTrack.label,
			context: this,
			redo: deleteSeg,
			undo: recreateSeg
		});
		tl.renderTrack(this.track);
		tl.emit('delete',this);
	};

	function resplitSeg(s1,s2,stime){
		var tl = this.tl;
			
		this.textTrack.addCue(s2.cue);
		s2.deleted = false;
		
		s1.cue.endTime = stime;

		if(s1.visible || s2.visible){ tl.renderTrack(this); }
		tl.emit('split',s1,s2);
	}
	
	function unsplitSeg(s1,s2){
		var i, tl = this.tl,
			s_segs = tl.selectedSegments;
			
		this.textTrack.removeCue(s2.cue);
		s2.deleted = true;

		i = s_segs.indexOf(s2);
		if(i !== -1){ s_segs.splice(i,1); }
		
		s1.cue.endTime = s2.cue.endTime;

		if(s1.visible){ this.tl.renderTrack(this); }
		this.tl.emit('merge',s1,s2);	
	}
	
	SProto.split = function(pos){
		var cp, seg,
			tl = this.tl,
			stime = tl.view.pixelToTime(pos.x),
			track = this.track,
			cue = this.cue;
			
		cp = new TextTrackCue(stime+.001, cue.endTime, cue.text);		
		cp.snapToLines = cue.snapToLines;
		cp.pauseOnExit = cue.pauseOnExit;
		
		cue.endTime = stime;
		
		track.textTrack.addCue(cp);
		seg = new Segment(track, cp);
		track.segments.push(seg);
		track.segments.sort(order);
		
		// Save the split
		tl.cstack.push({
			file: track.textTrack.label,
			redo: resplitSeg.bind(track,this,seg,stime),
			undo: unsplitSeg.bind(track,this,seg)
		});
		tl.renderTrack(track);
		tl.emit('split',this,seg);
	};
	
	SProto.serialize = function(type){
		return this.deleted?"":TimedText.serializeCue(type, this.cue);
	};

	function handleWidths(seg, images){
		return seg.selected?{
			left:images.segmentLeftSel.width,
			right:images.segmentRightSel.width
		}:seg.selectable?{
			left:images.segmentLeft.width,
			right:images.segmentRight.width
		}:{
			left:images.segmentLeftDark.width,
			right:images.segmentRightDark.width
		};
	}
	
	// Location computation
	SProto.calcShape = function() {
		var x, tl = this.tl,
			shape = this.shape,
			xl = tl.view.timeToPixel(this.startTime),
			xr = tl.view.timeToPixel(this.endTime),
			mid = (xl+xr)/2,
			hwidth = handleWidths(this, tl.images);
		
		x = Math.min(xl,mid-hwidth.left-1);
		return (this.shape = {
			x: x,
			y: tl.getTrackTop(this.track),
			width: Math.max(xr,mid+hwidth.right+1) - x,
			height: tl.trackHeight
		});
	};

	SProto.containsPoint = function(pos) {
		var s = this.shape;
		return (pos.x >= s.x && pos.x <= s.x + s.width && pos.y >= s.y && pos.y <= s.y + s.height);
	};

	SProto.getMouseSide = function(pos) {
		var x, tl = this.tl,
			images = tl.images,
			shape = this.shape,
			hwidth = handleWidths(this, tl.images);
			
		x = pos.x - shape.x;
		return	(x < hwidth.left)?-1:
				(x > shape.width - hwidth.right)?1:
				0;
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
				break;
			case Timeline.SHIFT:
				this.move = true;
				this.initialStart = this.startTime;
				this.initialEnd = this.endTime;
				break;
			case Timeline.SPLIT:
				this.split(pos);
				break;
		}
	};

	function moveGenerator(type,start,end){
		return function(){
			this.startTime = start;
			this.endTime = end;
			this.track.textTrack.activeCues.refreshCues();
			this.tl.renderTrack(this.track);
			this.tl.emit(type,this);
		};
	}

	SProto.mouseUp = function(pos) {
		if(this.deleted || !this.selectable)
			return;

		var tl = this.tl,
			action = {file: this.track.textTrack.label, context: this},
			etype, s_segs, i;

		switch(tl.currentTool) {
			case Timeline.MOVE:
				this.move = false;
				this.track.segments.sort(order);
				this.track.textTrack.activeCues.refreshCues();
				this.track.render();
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
				this.del()
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
		if(tl.currentTool === Timeline.SHIFT){
			maxStartTime = tl.length - this.startingLength;
			if(newTime < 0){ newTime = 0; }
			else if(newTime > maxStartTime){ newTime = maxStartTime; }
			this.startTime = newTime;
			this.endTime = newTime + this.startingLength;
			tl.emit('move',this);
		}else{
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
		}
		if(activeStart != this.active){
			this.track.textTrack.activeCues.refreshCues();
		}
	};

	// Rendering

	function renderImage(shape, imageLeft, imageRight, imageMid) {
		var ctx = this.tl.ctx;
		ctx.drawImage(imageLeft, 0, 0, imageLeft.width, shape.height);
		ctx.drawImage(imageRight, shape.width - imageRight.width, 0, imageRight.width, shape.height);
		if(shape.width > imageRight.width + imageLeft.width){
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
			shape = this.calcShape(),
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
					direction = Ayamel.Text.getDirection(this.id+"");
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

		this.track.placeholder = null;
		if(this.startx === pos.x){ return; }
		if(this.startx < pos.x){
			startx = this.startx;
			endx = pos.x;
		}else{
			startx = pos.x;
			endx = this.startx;
		}
		this.track.add({
			startTime: view.pixelToTime(startx),
			endTime: view.pixelToTime(endx)
		}, this.tl.autoSelect);
	};
	
	Timeline.TextTrack = TextTrack;
}(Timeline));