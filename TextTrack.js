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

	function TlTextTrack(tl, cuetrack){
		var locked = false,
			that = this;
		this.tl = tl;
		this.textTrack = cuetrack;
		this.segments = cuetrack.cues.map(function(cue){ return new Segment(that, cue); });
		this.segments.sort(order);
		this.visibleSegments = [];
		this.audioId = null;
		this.placeholder = null;
		this.lastPos = null;

		Object.defineProperty(this,'locked',{
			get: function(){ return locked; },
			set: function(val){
				val = !!val;
				if(val !== locked){
					locked = val;
					if(active){ this.segments.forEach(function(seg){ seg.selected = false; }); }
					tl.renderTrack(this);
					if(this.audioId){ tl.audio[this.audioId].draw(); }
				}
				return locked;
			}
		});
	}

	TProto = TlTextTrack.prototype;

	Object.defineProperties(TProto,{
		id: {
			get: function(){ return this.textTrack.label; },
			set: function(val){
				var tl = this.tl,
					oldid = this.textTrack.label;
				if(oldid == val){ return oldid; }
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

	TProto.cloneTimeCodes = function(kind,lang,name){
		var ntt = new TextTrack(kind,name,lang);
		ntt.cues.loadCues(this.textTrack.cues.map(function(cue){
			return new TextTrackCue(cue.startTime,cue.endTime,"");
		}));
		ntt.readyState = TextTrack.LOADED;
		ntt.mode = "showing";
		return new TlTextTrack(this.tl,ntt);
	};
	
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
		var seg;

		if(this.locked){ return 'locked'; }
		if(this.tl.currentTool === Timeline.CREATE){ return 'add'; }
		
		seg = this.segFromPos(pos);
		return seg?seg.getCursor(pos):'pointer';
	};
	
	function remerge(segs,mseg,text){
		var tl = this.tl, that = this;
		segs.forEach(function(seg){
			seg.deleted = true;
			that.textTrack.removeCue(seg.cue);
		});
		mseg.cue.text = text;
		mseg.cue.endTime = segs[segs.length-1].endTime;
		if(mseg.visible){ tl.renderTrack(this); }
		tl.emit('merge',mseg,segs);
	}
	
	function unmerge(segs,mseg,text,end){
		var tl = this.tl, that = this, visible = false;
		segs.forEach(function(seg){
			seg.deleted = false;
			that.textTrack.addCue(seg.cue);
			visible |= seg.visible;
		});
		mseg.cue.text = text;
		mseg.cue.endTime = end;
		if(mseg.visible || visible){ tl.renderTrack(this); }
		tl.emit('unmerge',mseg,segs);
	}
	
	function merge(list){
		var that = this,
			tl = this.tl,
			ssegs = tl.selectedSegments,
			mseg, oldend, oldtext, newtext;
		
		list.sort(order);
		newtext = list.map(function(seg){ return seg.text; }).join('');
		
		mseg = list.shift();
		oldend = mseg.endTime;
		mseg.cue.endTime = list[list.length-1].endTime;
		oldtext = mseg.text;
		mseg.cue.text = newtext;
		
		list.forEach(function(seg){
			seg.deleted = true;
			seg.selected = false;
			that.textTrack.removeCue(seg.cue);
			ssegs.splice(ssegs.indexOf(seg),1);
		});
		
		tl.renderTrack(this);
		tl.cstack.push({
			file: this.textTrack.label,
			context: this,
			redo: remerge.bind(this,list,mseg,newtext),
			undo: unmerge.bind(this,list,mseg,oldtext,oldend)
		});
		tl.emit('merge',mseg,list);
	}
	
	TProto.mergeSelected = function(){
		var that = this,
			selected = this.tl.selectedSegments.filter(function(seg){return seg.track === that;});
		if(selected.length === 0){ return; }
		merge.call(this,selected);
	};

	TProto.copySelected = function(){
		var that = this,
			tl = this.tl,
			copy = tl.selectedSegments.filter(function(seg){return seg.track === that;});
		if(copy.length > 0){ tl.toCopy = copy; }
	};
	
	TProto.paste = function(){
		//TODO: Make work with undo/redo
		var tl = this.tl, that = this, visible = false;
		tl.toCopy.forEach(function(seg){
			var cue = seg.cue,
				ncue = new TextTrackCue(cue.startTime,cue.endTime,cue.text);
			ncue.vertical = cue.vertical;
			ncue.align = cue.align;
			ncue.line = cue.line;
			ncue.size = cue.size;
			ncue.position = cue.position;
			that.add(ncue);
			visible |= seg.visible;
		});
	};
	
	TProto.render = function(){
		var segs,
			tl = this.tl,
			ctx = tl.ctx,
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
		segs.forEach(function(seg){
			if(seg.selected){ selected.push(seg); }
			else{ seg.render(); }
		});
		selected.forEach(function(seg){ seg.render(); });
		this.placeholder && this.placeholder.render();
	};

	TProto.serialize = function(type){
		return TimedText.serializeTrack(type, this.textTrack);
	};
	
	TProto.segFromPos = function(pos){
		var j, seg, 
			segs = this.visibleSegments,
			selected = segs.filter(function(seg){ return seg.selected; });
		//search backwards 'cause later segments are on top
		for(j=selected.length-1;seg=selected[j];j--) {
			if(seg.containsPoint(pos)){ return seg; }
		}
		for(j=segs.length-1;seg=segs[j];j--) {
			if(!seg.selected && seg.containsPoint(pos)){ return seg; }
		}
		return null;
	};
	
	TProto.mouseDown = function(pos){
		if(typeof pos !== 'object' || this.locked){ return; }
		var tl = this.tl, seg, selected;
		if(tl.currentTool === Timeline.CREATE){
			this.placeholder = tl.activeElement = new Placeholder(tl, this, pos.x);
		}else if(tl.currentTool === Timeline.SHIFT){
			selected = this.segments.filter(function(seg){ return seg.selected; });
			if(selected.length < 2){ selected = this.segments; }
			selected.forEach(function(seg){ seg.mouseDown(pos); });
		}else{
			seg = this.segFromPos(pos);
			if(seg !== null){
				tl.activeElement = seg;
				seg.mouseDown(pos);
			}
		}		
	};
	
	TProto.mouseMove = function(pos){
		if(typeof pos !== 'object' || this.locked){ return; }
		if(this.tl.currentTool === Timeline.SHIFT){
			this.segments.forEach(function(seg){ seg.mouseMove(pos); });
			this.render();
		}
	};
	
	function reshift(selected,delta){
		var tl = this.tl;
		selected.forEach(function(seg){
			seg.startTime += delta;
			seg.endTime += delta;
		});
		tl.renderTrack(this);
		tl.emit('shift',selected,delta);
	}
	
	TProto.mouseUp = function(pos){
		var selected, delta, tl = this.tl;
		if(typeof pos !== 'object' || this.locked){ return; }
		if(tl.currentTool === Timeline.SHIFT){
			selected = this.segments.filter(function(seg){ return seg.selected; });
			if(selected.length < 2){ selected = this.segments; }
			selected.forEach(function(seg){ seg.moving = false; });
			delta = selected[0].startTime - selected[0].initialStart;
			tl.cstack.push({
				file: this.textTrack.label,
				context: this,
				redo: reshift.bind(this,selected,delta),
				undo: reshift.bind(this,selected,-delta)
			});
			tl.emit('shift',selected,delta);
		}
	};

	function Segment(track, cue) {
		this.tl = track.tl;
		this.track = track;
		this.cue = cue;
		this.moving = false;
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
		selectable: { get: function(){ return !this.track.locked; }, enumerable: true },
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
		if(typeof pos !== 'object')	return;
		switch(this.tl.currentTool){
			case Timeline.SELECT: return 'select';
			case Timeline.DELETE: return 'remove';
			case Timeline.SPLIT: return 'split';
			case Timeline.MOVE:
				return (function(i){
					return	i === 1?'resizeR':
							i === -1?'resizeL':
							'move';
				}(this.getMouseSide(pos)));
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
	
	SProto.copy = function(){ this.tl.toCopy = [this]; };
	
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
	
	SProto.mergeWithSelected = function(pos){
		var track = this.track,
			selected = this.tl.selectedSegments.filter(function(seg){return seg.track === track;});
		if(selected.length === 0){ return; }
		if(selected.indexOf(this) === -1){ selected.push(this); }
		merge.call(this.track, selected);
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
				this.moving = true;
				this.initialStart = this.startTime;
				this.initialEnd = this.endTime;
				break;
			case Timeline.SHIFT:
				this.moving = true;
				this.initialStart = this.startTime;
				this.initialEnd = this.endTime;
				break;
			case Timeline.SPLIT:
				this.split(pos);
				break;
		}
	};

	function moveGenerator(start,end){
		return function(){
			this.startTime = start;
			this.endTime = end;
			this.track.textTrack.activeCues.refreshCues();
			if(this.visible){ this.tl.renderTrack(this.track); }
			this.tl.emit("move",this);
		};
	}
	
	SProto.move = function(start,end){
		var redo = moveGenerator(start,end);
		this.tl.cstack.push({
			context: this,
			file: this.track.textTrack.label,
			undo: moveGenerator(this.startTime,this.endTime),
			redo: redo
		});
		redo.call(this);
	};
	
	SProto.mouseUp = function(pos) {
		var tl = this.tl, track = this.track;
		if(this.deleted || !this.selectable)
			return;
		switch(tl.currentTool) {
			case Timeline.MOVE:
				this.moving = false;
				track.segments.sort(order);
				track.textTrack.activeCues.refreshCues();
				track.render();
				// Save the move
				tl.cstack.push({
					context: this,
					file: track.textTrack.label,
					redo: moveGenerator(this.startTime,this.endTime),
					undo: moveGenerator(this.initialStart,this.initialEnd)
				});
				tl.emit("move",this);
				break;
			case Timeline.DELETE:
				this.del()
		}
	};

	SProto.mouseMove = function(pos) {
		if(this.deleted || !this.selectable || !this.moving){ return; }
		var tl = this.tl,
			activeStart = this.active,
			newTime = tl.view.pixelToTime(this.startingPos + pos.x - tl.mouseDownPos.x),
			maxStartTime;

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
			ctx.fillRect(imageLeft.width - 1, 0, shape.width - (imageRight.width + imageLeft.width) + 1, shape.height);
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
			dir = tl.cache.dir;
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

				if(this.id){
					direction = Ayamel.Text.getDirection(this.id+"");
					tl.cache.dir = direction;

					ctx.font = fonts.idFont;
					ctx.fillStyle = fonts.idTextColor;
					ctx.fillText(this.id, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, 0);
					y = Math.max(fonts.idFontSize,tl.segmentTextPadding);
				}else{
					y = tl.segmentTextPadding;
				}

				text = TimedText.textPreviewers[this.track.kind](this.text);
				direction = Ayamel.Text.getDirection(text);
				tl.cache.dir = direction;

				ctx.font = fonts.segmentFont;
				ctx.fillStyle = fonts.segmentTextColor;
				ctx.fillText(text, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, y);
			}
			ctx.restore();
			tl.cache.dir = dir;
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
	
	Timeline.TextTrack = TlTextTrack;
}(Timeline));