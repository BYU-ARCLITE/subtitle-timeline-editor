(function(Timeline,TimedText){
	"use strict";

	var idCounter = 0;

	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}

	function order(a,b){
		//sort first by start time, then by length
		return (a.startTime - b.startTime) || (b.endTime - a.endTime);
	}

	function TlTextTrack(tl, cueTrack, mime){
		var that = this,
			locked = false,
			autoCue = false,
			typeInfo = TimedText.getTypeInfo(mime);

		cueTrack.cues.forEach(function(cue){
			if(!typeInfo.isCueCompatible(cue)){
				throw new Error("TextTrackCue objects do not match the given mime type");
			}
		});

		this.tl = tl;
		this.segments = cueTrack.cues.map(function(cue){ return new Segment(that, cue); });
		this.visibleSegments = [];
		this.shiftSegments = [];
		this.audioId = null;
		this.placeholder = null;
		this.lastPos = null;
		this.ctrl = false;
		this.autoFill = false;
		this.linebuffer = [];

		function set_mime(newmime, newSegs){
			var oldmime = mime;

			mime = newmime;
			typeInfo = TimedText.getTypeInfo(mime);
			this.segments = newSegs;

			cueTrack.cues.length = 0;
			cueTrack.cues.loadCues(newSegs.map(function(s){ return s.cue; }));
			cueTrack.activeCues.refreshCues();

			tl.trackCache.get(that.textTrack).mime = mime;
			tl.renderTrack(this);
			tl.emit(new Timeline.Event("convert",{track:this,oldtype:oldmime}));
			if(newSegs.some(function(seg){ return seg.active; })){
				tl.emit(new Timeline.Event("activechange"));
			}
		}

		Object.defineProperties(this,{
			cueType: { get: function(){ return typeInfo.cueType; }, enumerable: true },
			typeName: { get: function(){ return typeInfo.name; }, enumerable: true },
			typeInfo: { get: function(){ return typeInfo; }, enumerable: true },
			textTrack: {get: function(){ return cueTrack; }, enumerable: true },
			autoCue: {
				get: function(){ return autoCue; },
				set: function(val){
					val = !!val;
					if(val === autoCue){ return val; }
					autoCue = val;
					if(!autoCue && this.tl.autoCueStatus === Timeline.AutoCueCueing){
						this.placeholder = null;
						this.tl.renderTrack(this);
					}
					return autoCue;
				}, enumerable: true
			},
			locked: {
				get: function(){ return locked; },
				set: function(val){
					val = !!val;
					if(val !== locked){
						locked = val;
						this.segments.forEach(function(seg){ seg.selected = false; });
						tl.renderTrack(this);
						if(this.audioId){ tl.audio[this.audioId].draw(); }
					}
					return locked;
				}, enumerable: true
			},
			mime: {
				get: function(){ return mime; },
				set: function(newmime){
					var that = this, oldmime = mime,
						converter, oldSegs, newSegs;
					if(newmime === mime){ return mime; }
					converter = TimedText.getCueConverter(oldmime, newmime),

					oldSegs = this.segments;
					newSegs = oldSegs
							.filter(function(s){ return !s.deleted; })
							.map(function(s){ return new Segment(that, converter(s.cue)); });

					tl.commandStack.push({
						file: cueTrack.label,
						context: this,
						redo: set_mime.bind(this,newmime,newSegs),
						undo: set_mime.bind(this,oldmime,oldSegs)
					});

					set_mime.call(this, newmime, newSegs);

					return mime;
				}, enumerable: true
			}
		});
	}

	function Segment(track, cue) {
		var deleted = false;
		this.tl = track.tl;
		this.track = track;
		this.cue = cue;
		this.moving = false;
		this.selected = false;
		this.resizeSide = 0;
		this.uid = (idCounter++).toString(36);

		// For undo/redo
		this.initialStart = 0;
		this.initialEnd = 0;

		// For mouse control
		this.startingPos = 0;
		this.startingLength = 0;

		this.shape = {};

		Object.defineProperties(this,{
			deleted: {
				set: function(d){
					d = !!d;
					if(d !== deleted){
						track.textTrack[d?'removeCue':'addCue'](this.cue);
						deleted = d;
					}
					return d;
				},
				get: function(){ return deleted; },
				enumerable: true
			}
		});
	}

	function Placeholder(tl, track, x) {
		this.tl = tl;
		this.track = track;
		this.startx = x;
		this.endx = x;
		tl.emit(new Timeline.Event("segstart",{track:track}));
	}

	Timeline.TextTrack = TlTextTrack;

	function deleteSeg(){
		var i, tl = this.tl, visible = this.visible, active = this.active,
			s_segs = this.tl.selectedSegments;
		this.deleted = true;
		this.selected = false;
		i = s_segs.indexOf(this);
		if(~i){ s_segs.splice(i,1); }
		tl.emit(new Timeline.Event("delete",{segments:[this]}));
		if(active){
			this.track.textTrack.activeCues.refreshCues();
			tl.emit(new Timeline.Event('activechange'));
		}
		if(visible){ tl.renderTrack(this.track); }
	}

	function recreateSeg(){
		var tl = this.tl;
		this.deleted = false;
		tl.emit(new Timeline.Event("create",{segments:[this]}));
		if(this.active){
			this.track.textTrack.activeCues.refreshCues();
			tl.emit(new Timeline.Event('activechange'));
		}
		if(this.visible){ tl.renderTrack(this.track); }
	}

	function remerge(segs,mseg,text){
		var tl = this.tl;
		segs.forEach(function(seg){ seg.deleted = true; });
		mseg.cue.text = text;
		mseg.cue.endTime = segs[segs.length-1].endTime;
		tl.emit(new Timeline.Event('merge',{merged:mseg,removed:segs}));
		tl.emit(new Timeline.Event('delete',{segments:segs}));
		if(mseg.active){
			this.textTrack.activeCues.refreshCues();
			tl.emit(new Timeline.Event('activechange'));
		}
		if(mseg.visible){ tl.renderTrack(this); }
	}

	function unmerge(segs,mseg,text,end){
		var tl = this.tl,
			visible = mseg.visible,
			active = mseg.active;
		segs.forEach(function(seg){	seg.deleted = false; });
		mseg.cue.text = text;
		mseg.cue.endTime = end;
		tl.emit(new Timeline.Event('unmerge',{merged:mseg,removed:segs}));
		tl.emit(new Timeline.Event('create',{segments:segs}));
		if(active){
			this.textTrack.activeCues.refreshCues();
			tl.emit(new Timeline.Event('activechange'));
		}
		if(mseg.visible || visible){ tl.renderTrack(this); }
	}

	function merge(list){
		var tl = this.tl,
			append = this.typeInfo.appendText,
			ssegs = tl.selectedSegments,
			mseg, oldend, oldtext, newtext;

		if(list.length === 0){ return; }
		if(typeof append !== 'function'){
			append = function(a,b){ return a+b; };
		}

		list.sort(order);
		newtext = list
					.map(function(seg){ return seg.text; })
					.reduce(append);

		mseg = list.shift();
		oldend = mseg.endTime;
		mseg.cue.endTime = list[list.length-1].endTime;
		oldtext = mseg.text;
		mseg.cue.text = newtext;

		list.forEach(function(seg){
			seg.deleted = true;
			seg.selected = false;
			ssegs.splice(ssegs.indexOf(seg),1);
		});

		tl.commandStack.push({
			file: this.textTrack.label,
			context: this,
			redo: remerge.bind(this,list,mseg,newtext),
			undo: unmerge.bind(this,list,mseg,oldtext,oldend)
		});
		tl.emit(new Timeline.Event('merge',{merged:mseg,removed:list}));
		tl.emit(new Timeline.Event('delete',{segments:list}));
		if(mseg.active){
			this.textTrack.activeCues.refreshCues();
			tl.emit(new Timeline.Event('activechange'));
		}
		tl.renderTrack(this);
	}

	(function(TProto){

		function repaste(segs){
			var tl = this.tl, visible = false, active = false;
			segs.forEach(function(seg){
				seg.deleted = false;
				visible = visible || seg.visible;
				active = active || seg.active;
			});
			tl.emit(new Timeline.Event('paste',{segments:segs}));
			tl.emit(new Timeline.Event('create',{segments:segs}));
			if(active){
				this.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			if(visible){ tl.renderTrack(this); }
		}

		function unpaste(segs){
			var tl = this.tl, visible = false, active = false;
			segs.forEach(function(seg){
				visible = visible || seg.visible;
				active = active || seg.active;
				seg.deleted = true;
			});
			tl.emit(new Timeline.Event('unpaste',{segments:segs}));
			tl.emit(new Timeline.Event('delete',{segments:segs}));
			if(active){
				this.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			if(visible){ tl.renderTrack(this); }
		}

		function reshift(selected,delta){
			var tl = this.tl, change = false;
			selected.forEach(function(seg){
				var active = seg.active;
				seg.startTime += delta;
				seg.endTime += delta;
				tl.emit(new Timeline.Event('move',{segment:seg}));
				change = change || active === seg.active;
			});
			tl.emit(new Timeline.Event('shift',{segments:selected,delta:delta}));
			if(change){
				this.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			tl.renderTrack(this);
		}

		Object.defineProperties(TProto,{
			id: {
				get: function(){ return this.textTrack.label; },
				set: function(val){
					var tl = this.tl,
						oldid = this.textTrack.label;
					if(oldid === val){ return oldid; }
					if(tl.trackIndices.hasOwnProperty(val)){
						throw new Error("Track name already in use.");
					}
					tl.trackIndices[val] = tl.trackIndices[oldid];
					delete tl.trackIndices[oldid];
					tl.commandStack.renameEvents(oldid,val);
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

		TProto.cloneTimeCodes = function(kind,lang,name,mime){
			var tl = this.tl,
				ntt = new TextTrack(kind||this.kind,name,lang||this.language),
				cueType = mime?TimedText.getTypeInfo(mime).cueType:this.cueType;
			ntt.cues.loadCues(this.textTrack.cues.map(function(cue){
				return new cueType(cue.startTime,cue.endTime,"");
			}));
			ntt.readyState = TextTrack.LOADED;
			ntt.mode = "showing";
			tl.trackCache.set(ntt,{mime:mime, location: void 0});
			return new TlTextTrack(tl,ntt,mime||this.mime);
		};

		TProto.cloneTrack = function(kind,lang,name,mime){
			var tl = this.tl,
				ntt = new TextTrack(kind||this.kind,name,lang||this.language);
			if(!mime){ mime = this.mime; }
			ntt.cues.loadCues(this.textTrack.cues.map(
				TimedText.getCueConverter(this.mime, mime)
			));
			ntt.readyState = TextTrack.LOADED;
			ntt.mode = "showing";
			tl.trackCache.set(ntt,{mime:mime, location: void 0});
			return new TlTextTrack(tl,ntt,mime);
		};

		function cue2seg(cue, select){
			var tl = this.tl, seg;

			this.textTrack.addCue(cue);

			seg = new Segment(this, cue);
			this.segments.push(seg);
			this.segments.sort(order);

			if(select){ seg.select(); }

			tl.emit(new Timeline.Event('addcue',{cue:cue,segment:seg}));
			tl.emit(new Timeline.Event('create',{segments:[seg]}));
			if(seg.active){
				this.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			tl.renderTrack(this);
			return seg;
		}

		TProto.add = function(cue, select){
			var seg = cue2seg.call(this, cue, select);
			this.tl.commandStack.push({
				file: this.textTrack.label,
				context: seg,
				undo: deleteSeg,
				redo: recreateSeg
			});
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
			if(typeof pos !== 'object'){ return; }
			var seg;

			if(this.locked){ return 'locked'; }
			if(this.tl.currentTool === Timeline.CREATE){ return 'add'; }

			seg = this.segFromPos(pos);
			return seg?seg.getCursor(pos):'pointer';
		};

		TProto.clearSelection = function(){
			var tl = this.tl, that = this,
				visible = false,
				selected = tl.selectedSegments.filter(function(seg){return seg.track === that;});
			selected.forEach(function(seg){
				visible = visible || seg.visible;
				seg.selected = false;
				tl.selectedSegments.splice(tl.selectedSegments.indexOf(seg),1);
			});
			tl.emit(new Timeline.Event('unselect',{segments:selected}));
			if(visible){ tl.renderTrack(this); }
		};

		function deleteMultiSeg(track){
			var tl = track.tl;
			return function(){
				var visible = false, active = false,
					s_segs = tl.selectedSegments;
				this.forEach(function(seg){
					var i = s_segs.indexOf(seg);
					if(~i){ s_segs.splice(i,1); }
					visible = visible || seg.visible;
					active = active || seg.active;
					seg.deleted = true;
					seg.selected = false;
				});
				tl.emit(new Timeline.Event('delete',{segments:this}));
				if(active){
					track.textTrack.activeCues.refreshCues();
					tl.emit(new Timeline.Event('activechange'));
				}
				if(visible){ tl.renderTrack(track); }
			};
		}

		function recreateMultiSeg(track){
			var tl = track.tl;
			return function(){
				var visible = false, active = false;
				this.forEach(function(seg){
					seg.deleted = false;
					visible = visible || seg.visible;
					active = active || seg.active;
				});
				tl.emit(new Timeline.Event('create',{segments:this}));
				if(active){
					track.textTrack.activeCues.refreshCues();
					tl.emit(new Timeline.Event('activechange'));
				}
				if(visible){ tl.renderTrack(track); }
			};
		}

		TProto.setPlaceholder = function(start, end){
			var view = this.tl.view;
			if(this.placeholder === null){
				this.placeholder = new Placeholder(this.tl, this, view.timeToPixel(start));
			}else{
				this.placeholder.startx = view.timeToPixel(start);
			}
			this.placeholder.endx = view.timeToPixel(end);
			this.tl.renderTrack(this);
		};

		TProto.resolvePlaceholder = function(){
			if(this.placeholder === null){ return; }
			var seg, text, start, end,
				tl = this.tl,
				view = tl.view,
				placeholder = this.placeholder,
				startx = placeholder.startx,
				endx = placeholder.endx;

			this.placeholder = null;
			if(startx === endx){ return; }
			start = view.pixelToTime(startx);
			end = view.pixelToTime(endx);
			if(this.autoFill && this.linebuffer.length){
				text = this.linebuffer.pop();
				seg = cue2seg.call(this, new this.cueType(start,end,text), tl.autoSelect);
				tl.commandStack.push({
					file: this.textTrack.label,
					context: seg,
					undo: function(){
						this.track.linebuffer.push(text);
						deleteSeg.call(this);
					},
					redo: function(){
						this.track.linebuffer.pop();
						recreateSeg.call(this);
					}
				});
			}else{
				seg = cue2seg.call(this, new this.cueType(start,end,""), tl.autoSelect);
				tl.commandStack.push({
					file: this.textTrack.label,
					context: seg,
					undo: deleteSeg,
					redo: recreateSeg
				});
			}

			if(tl.autoCueRepeat){ tl.setRepeat(start+.02,end-.02); }
			if(tl.automove){ tl.currentTool = Timeline.MOVE; }
			tl.emit(new Timeline.Event("segcomplete",{track:this,segment:seg}));
		};

		TProto.deleteSelected = function(){
			var that = this, tl = this.tl,
				visible = false, active = false,
				s_segs = tl.selectedSegments,
				selected = s_segs.filter(function(seg){return seg.track === that;});
			selected.forEach(function(seg){
				s_segs.splice(s_segs.indexOf(seg),1);
				visible = visible || seg.visible;
				active = active || seg.active;
				seg.deleted = true;
				seg.selected = false;
			});
			// Save the delete
			tl.commandStack.push({
				file: this.textTrack.label,
				context: selected,
				redo: deleteMultiSeg(this),
				undo: recreateMultiSeg(this)
			});
			tl.emit(new Timeline.Event('delete',{segments:selected}));
			if(active){
				this.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			tl.renderTrack(this);
		};

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

		TProto.paste = function(toCopy, time){
			var ncues, added, tshift,
				toMime = this.mime,
				that = this, tl = this.tl,
				textTrack = this.textTrack,
				segments = this.segments;

			if(toCopy.length < 1){ return; }
			ncues = toCopy.map(function(seg){ return TimedText.getCueConverter(seg.track.mime, toMime)(seg.cue); });
			time = +time;
			if(!isFinite(time)){
				ncues.forEach(function(cue){ textTrack.addCue(cue); });
			}else{
				tshift = ncues[0].startTime - time;
				ncues.forEach(function(cue){
					cue.startTime -= tshift;
					cue.endTime -= tshift;
					textTrack.addCue(cue);
				});
			}

			added = ncues.map(function(cue){ return new Segment(that, cue); });
			[].push.apply(segments, added);
			segments.sort(order);

			tl.commandStack.push({
				context: this,
				file: this.textTrack.label,
				redo: repaste.bind(this,added),
				undo: unpaste.bind(this,added)
			});
			tl.emit(new Timeline.Event('paste',{segments:added}));
			tl.emit(new Timeline.Event('create',{segments:added}));
			if(added.some(function(seg){return seg.active;})){
				this.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			tl.renderTrack(this);
		};

		TProto.shift = function(delta, all){
			var change = false, tl = this.tl,
				segments = this.segments;
			delta = +delta;
			if(!delta){ return; }
			if(all !== true){ segments = segments.filter(function(seg){ return seg.selected; }); }
			if(segments.length === 0){ return; }

			//Don't go out of bounds; depends on assumption of sorting
			if(segments[0].startTime + delta < 0){
				if(segments[0].startTime === 0){ return; }
				delta = -segments[0].startTime;
			}

			segments.forEach(function(seg){
				var activeStart = seg.active;
				seg.startTime = seg.startTime + delta;
				seg.endTime = seg.endTime + delta;
				tl.emit(new Timeline.Event('move',{segment:this}));
				change = change || (activeStart !== seg.active);
			});
			if(change){
				this.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			tl.commandStack.push({
				file: this.textTrack.label,
				context: this,
				redo: reshift.bind(this,segments,delta),
				undo: reshift.bind(this,segments,-delta)
			});
			tl.emit(new Timeline.Event('shift',{segments:segments,delta:delta}));
			tl.renderTrack(this);
		};

		TProto.render = function(){
			var segs, dir, idstr,
				id_width, type_pos,
				tl = this.tl,
				ctx = tl.ctx,
				font = tl.fonts.title,
				selected = [];

			ctx.save();

			ctx.translate(0,tl.getTrackTop(this));

			ctx.fillStyle = ctx.createPattern(tl.images[this.kind]||tl.images.subtitles, "repeat-x");
			ctx.fillRect(0, 0, tl.width, tl.trackHeight);

			ctx.textBaseline = 'middle';
			ctx.font = font.font;
			ctx.fillStyle = font.color;

			idstr = this.id + " -- " + this.kind + " (" + this.language + ")";
			id_width = ctx.measureText(idstr).width + tl.width/25;
			type_pos = tl.width*0.99 - ctx.measureText(this.typeName).width;

			ctx.fillText(idstr, tl.width/100, tl.trackHeight/2);
			ctx.fillText(this.typeName, Math.max(type_pos, id_width), tl.trackHeight/2);

			ctx.fillStyle = tl.colors[tl.commandStack.isFileSaved(this.id,tl.saveLocation)?'tintSaved':'tintUnsaved'];
			ctx.fillRect(0, 0, tl.width, tl.trackHeight);

			ctx.restore();
			ctx.save();

			ctx.textBaseline = 'top';

			dir = tl.cache.dir;
			segs = this.segments.filter(function(seg){return seg.visible;});
			this.visibleSegments = segs;
			segs.forEach(function(seg){
				if(seg.selected){ selected.push(seg); }
				else{ seg.render(); }
			});
			selected.forEach(function(seg){ seg.render(); });
			if(this.placeholder !== null){ this.placeholder.render(); }
			tl.cache.dir = dir;

			ctx.restore();
		};

		TProto.serialize = function(){
			return TimedText.serialize(this.mime, this.textTrack);
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
			if(pos.ctrl){ //copy on click / drag
				this.ctrl = true;
				seg = this.segFromPos(pos);
				if(seg === null){ return; }
				if(seg.selected){ this.copySelected(); }
				else{ seg.copy(); }
				return;
			}
			if(tl.currentTool === Timeline.CREATE){
				this.placeholder = tl.activeElement = new Placeholder(tl, this, pos.x);
			}else if(tl.currentTool === Timeline.SHIFT){
				selected = this.segments.filter(function(seg){ return seg.selected; });
				this.shiftSegments = (selected.length < 2)?this.segments:selected;
				this.shiftSegments.forEach(function(seg){
					seg.initialStart = seg.startTime;
					seg.initialEnd = seg.endTime;
				});
				tl.activeElement = this;
			}else{
				seg = this.segFromPos(pos);
				if(seg !== null){
					tl.activeElement = seg;
					seg.mouseDown(pos);
				}
			}
		};

		TProto.mouseMove = function(pos){
			var delta, tl = this.tl,
				change = false,
				segments = this.shiftSegments;
			if(typeof pos !== 'object' || this.locked || this.ctrl || tl.currentTool !== Timeline.SHIFT){ return; }
			delta = tl.view.distanceToTime(pos.x - tl.mouseDownPos.x);

			//Don't go out of bounds; depends on assumption of sorting
			if(segments[0].initialStart + delta < 0){
				if(segments[0].startTime === 0){ return; }
				delta = -segments[0].initialStart;
			}

			segments.forEach(function(seg){
				var activeStart = seg.active;
				seg.startTime = seg.initialStart + delta;
				seg.endTime = seg.initialEnd + delta;
				tl.emit(new Timeline.Event('move',{segment:this}));
				change = change || (activeStart !== seg.active);
			});
			if(change){
				this.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			tl.renderTrack(this);
		};

		TProto.mouseUp = function(pos){
			var segments, delta, target, tl = this.tl;
			if(typeof pos !== 'object' || this.locked){ return; }
			if(this.ctrl){ //copy on drag
				this.ctrl = false;
				target = tl.trackFromPos(pos);
				if(this !== target){ target.paste(tl.toCopy); }
			}else if(tl.currentTool === Timeline.SHIFT){
				segments = this.shiftSegments;
				delta = segments[0].startTime - segments[0].initialStart;
				tl.commandStack.push({
					file: this.textTrack.label,
					context: this,
					redo: reshift.bind(this,segments,delta),
					undo: reshift.bind(this,segments,-delta)
				});
				tl.emit(new Timeline.Event('shift',{segments:segments,delta:delta}));
				tl.renderTrack(this);
			}
		};
	}(TlTextTrack.prototype));

	(function(SProto){

		function textChangeGenerator(text){
			return function(){
				this.cue.text = text;
				this.tl.renderTrack(this.track);
			};
		}

		function idChangeGenerator(id){
			return function(){
				this.cue.id = id;
				this.tl.renderTrack(this.track);
			};
		}

		function moveGenerator(start,end){
			return function(){
				var active = this.active;
				this.startTime = start;
				this.endTime = end;
				this.track.segments.sort(order);
				this.tl.emit(new Timeline.Event('move',{segment:this}));
				if(this.active !== active){
					this.track.textTrack.activeCues.refreshCues();
					this.tl.emit(new Timeline.Event('activechange'));
				}
				if(this.visible){ this.tl.renderTrack(this.track); }
			};
		}

		function resplitSeg(s1,s2,stime){
			var tl = this.tl,
				active = s1.active,
				visible = s1.visible;

			s2.deleted = false;
			s1.cue.endTime = stime;

			tl.emit(new Timeline.Event('split',{first:s1,second:s2}));
			if(active){
				this.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			if(visible){ tl.renderTrack(this); }
		}

		function unsplitSeg(s1,s2){
			var i, tl = this.tl,
				s_segs = tl.selectedSegments;

			s2.deleted = true;

			i = s_segs.indexOf(s2);
			if(~i){ s_segs.splice(i,1); }

			s1.cue.endTime = s2.cue.endTime;

			tl.emit(new Timeline.Event('merge',{segments:[s1,s2]}));
			if(s1.active){
				this.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			if(s1.visible){ tl.renderTrack(this); }
		}

		Object.defineProperties(SProto,{
			selectable: { get: function(){ return !this.track.locked; }, enumerable: true },
			active: { get: function(){ return this.cue.active;}, enumerable: true },
			visible: {
				get: function(){
					var cue = this.cue,
						view = this.tl.view;
					return !this.deleted && cue.startTime < view.endTime && cue.endTime > view.startTime;
				}, enumerable: true
			},
			id: {
				set: function(id){
					var tl = this.tl,
						cue = this.cue;
					if(cue.id === id){ return id; }
					tl.commandStack.push({
						file: this.track.id,
						context:this,
						undo: idChangeGenerator(cue.id),
						redo: idChangeGenerator(id)
					});
					cue.id = id;
					tl.renderTrack(this.track);
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
					if(cue.text === t){ return t; }
					tl.commandStack.push({
						file: this.track.id,
						context:this,
						undo: textChangeGenerator(cue.text),
						redo: textChangeGenerator(t)
					});
					cue.text = t;
					tl.renderTrack(this.track);
					return t;
				},
				get: function(){return this.cue.text;},
				enumerable: true
			}
		});

		SProto.getCursor = function(pos){
			if(typeof pos !== 'object'){ return; }
			switch(this.tl.currentTool){
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
			var tl = this.tl,
				trackmap = {};
			if(this.selected){ return; }
			this.selected = true;
			if(this.visible){ trackmap[this.track.id] = this.track; }
			tl.selectedSegments.push(this);
			Object.keys(trackmap).forEach(function(id){
				tl.renderTrack(trackmap[id]);
			});
			tl.emit(new Timeline.Event('select',{segments:[this]}));
		};

		SProto.unselect = function(){
			if(!this.selected){ return; }
			var tl = this.tl;
			this.selected = false;
			tl.selectedSegments.splice(tl.selectedSegments.indexOf(this),1);
			if(this.visible){ tl.renderTrack(this.track); }
			tl.emit(new Timeline.Event('unselect',{segments:[this]}));
		};

		SProto.toggle = function(){
			if(this.selected){ this.unselect(); }
			else{ this.select(); }
		};

		SProto.copy = function(){ this.tl.toCopy = [this]; };

		SProto.del = function(){
			var i, tl = this.tl,
				active = this.active,
				s_segs = tl.selectedSegments;

			this.deleted = true;

			i = s_segs.indexOf(this);
			if(~i){ s_segs.splice(i,1); }

			// Save the delete
			tl.commandStack.push({
				file: this.track.textTrack.label,
				context: this,
				redo: deleteSeg,
				undo: recreateSeg
			});
			tl.emit(new Timeline.Event('delete',{segments:[this]}));
			if(active){
				this.track.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event('activechange'));
			}
			tl.renderTrack(this.track);
		};

		SProto.split = function(pos){
			var cp, seg,
				tl = this.tl,
				stime = tl.view.pixelToTime(pos.x),
				track = this.track,
				cue = this.cue;

			cp = new track.cueType(stime+0.001, cue.endTime, cue.text);

			cue.endTime = stime;

			seg = track.add(cp,false);

			// Save the split
			tl.commandStack.push({
				file: track.textTrack.label,
				redo: resplitSeg.bind(track,this,seg,stime),
				undo: unsplitSeg.bind(track,this,seg)
			});
			tl.emit(new Timeline.Event('split',{first:this,second:seg}));
			tl.renderTrack(track);
		};

		SProto.mergeWithSelected = function(){
			var track = this.track,
				selected = this.tl.selectedSegments.filter(function(seg){return seg.track === track;});
			if(selected.length === 0){ return; }
			if(selected.indexOf(this) === -1){ selected.push(this); }
			merge.call(this.track, selected);
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
				shape = this.shape,
				hwidth = handleWidths(this, tl.images);

			x = pos.x - shape.x;
			return	(x < hwidth.left)?-1:
					(x > shape.width - hwidth.right)?1:
					0;
		};

		// Event handlers
		SProto.mouseDown = function(pos) {
			var tl = this.tl;
			if(this.deleted || !this.selectable){ return; }

			this.startingPos = this.tl.view.timeToPixel(this.startTime);
			this.startingLength = this.endTime - this.startTime;

			tl.activeElement = this;

			switch(tl.currentTool){
			case Timeline.MOVE:
				this.resizeSide = this.getMouseSide(pos);
				this.moving = true;
				this.initialStart = this.startTime;
				this.initialEnd = this.endTime;
				break;
			case Timeline.SPLIT:
				this.split(pos);
				break;
			}
		};

		SProto.move = function(start,end){
			var redo = moveGenerator(start,end);
			this.tl.commandStack.push({
				context: this,
				file: this.track.textTrack.label,
				undo: moveGenerator(this.startTime,this.endTime),
				redo: redo
			});
			redo.call(this);
			this.tl.renderTrack(this.track);
		};

		SProto.mouseUp = function(pos) {
			var tl = this.tl, track;
			if(this.deleted || !this.selectable){ return; }
			switch(tl.currentTool) {
				case Timeline.SELECT:
					track = tl.trackFromPos(pos);
					if(track === this.track && track.segFromPos(pos) === this){
						this.toggle();
					}else if(track){
						track.paste([this]);
					}
					break;
				case Timeline.MOVE:
					this.moving = false;
					track = this.track;
					track.segments.sort(order);
					track.render();
					// Save the move
					tl.commandStack.push({
						context: this,
						file: track.textTrack.label,
						redo: moveGenerator(this.startTime,this.endTime),
						undo: moveGenerator(this.initialStart,this.initialEnd)
					});
					tl.renderTrack(track);
					break;
				case Timeline.DELETE:
					this.del();
					break;
			}
		};

		SProto.mouseMove = function(pos) {
			var tl = this.tl,
				activeStart = this.active,
				newTime, maxStartTime;

			if(this.deleted || !this.selectable || !this.moving || tl.currentTool !== Timeline.MOVE){ return; }

			newTime = tl.view.pixelToTime(this.startingPos + pos.x - tl.mouseDownPos.x);

			switch(this.resizeSide){
			case 0:
				maxStartTime = tl.length - this.startingLength;
				if(newTime < 0){ newTime = 0; }
				else if(newTime > maxStartTime){ newTime = maxStartTime; }
				this.startTime = newTime;
				this.endTime = newTime + this.startingLength;
				tl.emit(new Timeline.Event('move',{segment:this}));
				break;
			case -1:
				if(newTime < 0){ newTime = 0; }
				else if(newTime >= this.endTime){ newTime = this.endTime - 0.001; }
				this.startTime = newTime;
				tl.emit(new Timeline.Event('resizel',{segment:this}));
				break;
			case 1:
				newTime += this.startingLength;
				if(newTime <= this.startTime){ newTime = this.startTime + 0.001; }
				else if(newTime > tl.length){ newTime = tl.length; }
				this.endTime = newTime;
				tl.emit(new Timeline.Event('resizer',{segment:this}));
				break;
			default:
				throw new Error("Invalid State");
			}
			tl.renderTrack(this.track);
			if(activeStart !== this.active){
				this.track.textTrack.activeCues.refreshCues();
				tl.emit(new Timeline.Event("activechange"));
			}
		};

		// Rendering

		function renderImage(ctx, shape, imageLeft, imageRight, imageMid) {
			ctx.drawImage(imageLeft, 0, 0, imageLeft.width, shape.height);
			ctx.drawImage(imageRight, shape.width - imageRight.width, 0, imageRight.width, shape.height);
			if(shape.width > imageRight.width + imageLeft.width){
				ctx.fillStyle = ctx.createPattern(imageMid, "repeat-x");
				ctx.fillRect(imageLeft.width - 1, 0, shape.width - (imageRight.width + imageLeft.width) + 1, shape.height);
			}
		}

		function renderSubPreview(ctx, shape, fonts, tl){
			var direction, text, y;
			if(this.id){
				direction = TimedText.getTextDirection(this.id+"");
				tl.cache.dir = direction;

				ctx.font = fonts.idFont;
				ctx.fillStyle = fonts.idColor;
				ctx.fillText(this.id, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, 0);
				y = Math.max(fonts.idSize,tl.segmentTextPadding);
			}else{
				y = tl.segmentTextPadding;
			}

			text = TimedText.getPlainText(this.cue);
			direction = TimedText.getTextDirection(text);
			tl.cache.dir = direction;

			ctx.font = fonts.textFont;
			ctx.fillStyle = fonts.textColor;
			ctx.fillText(text, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, y);
		}

		function renderDescPreview(ctx, shape, fonts, tl){
			var direction, text, y;
			if(this.id){
				direction = TimedText.getTextDirection(this.id);
				tl.cache.dir = direction;

				ctx.font = fonts.idFont;
				ctx.fillStyle = fonts.idColor;
				ctx.fillText(this.id, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, 0);
				y = Math.max(fonts.idSize,tl.segmentTextPadding);
			}else{
				y = tl.segmentTextPadding;
			}

			text = TimedText.getPlainText(this.cue);
			direction = TimedText.getTextDirection(text);
			tl.cache.dir = direction;

			ctx.font = fonts.textFont;
			ctx.fillStyle = fonts.textColor;
			ctx.fillText(text, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, y);
		}

		function renderMetaPreview(ctx, shape, fonts, tl){
			var direction, text, y;
			if(this.id){
				direction = TimedText.getTextDirection(this.id);
				tl.cache.dir = direction;

				ctx.font = fonts.idFont;
				ctx.fillStyle = fonts.idColor;
				ctx.fillText("Meta: " + this.id, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, 0);
				y = Math.max(fonts.idSize,tl.segmentTextPadding);
			}else{
				y = tl.segmentTextPadding;
			}

			text = this.cue.text;
			direction = TimedText.getTextDirection(text);
			tl.cache.dir = direction;

			ctx.font = fonts.textFont;
			ctx.fillStyle = fonts.textColor;
			ctx.fillText(text, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, y);
		}

		SProto.render = function() {
			if(this.deleted){ return; }

			var tl = this.tl,
				images = tl.images,
				fonts = tl.fonts,
				ctx = tl.ctx,
				shape = this.calcShape(),
				x = shape.x,
				y = shape.y,
				padding = tl.segmentTextPadding;

			ctx.save();
			ctx.translate(x, y);

			if(this.selected){
				renderImage(ctx, shape, images.segmentLeftSel, images.segmentRightSel, images.segmentMidSel);
			}else if(this.selectable){
				renderImage(ctx, shape, images.segmentLeft, images.segmentRight, images.segmentMid);
			}else{
				renderImage(ctx, shape, images.segmentLeftDark, images.segmentRightDark, images.segmentMidDark);
			}

			if(shape.width > 2*padding){
				// Set the clipping bounds
				ctx.beginPath();
				ctx.rect(padding, 0, shape.width - 2*padding, shape.height);
				ctx.clip();

				switch(this.track.kind){
				case 'captions':
					renderSubPreview.call(this, ctx, shape, fonts.captions, tl);
					break;
				case 'descriptions':
					renderDescPreview.call(this, ctx, shape, fonts.descriptions, tl);
					break;
				case 'chapters':
					renderSubPreview.call(this, ctx, shape, fonts.chapters, tl);
					break;
				case 'metadata':
					renderMetaPreview.call(this, ctx, shape, fonts.metadata, tl);
					break;
				case 'subtitles':
				default:
					renderSubPreview.call(this, ctx, shape, fonts.subtitles, tl);
					break;
				}
			}
			ctx.restore();
		};
	}(Segment.prototype));

	(function(PProto){

		PProto.render = function() {
			var tl = this.tl,
				ctx = tl.ctx,
				top = tl.getTrackTop(this.track);
			ctx.save();
			ctx.fillStyle = tl.colors.placeholder;
			ctx.globalAlpha = 0.5;
			ctx.fillRect(this.startx, top, this.endx - this.startx, tl.trackHeight);
			ctx.restore();
		};

		PProto.mouseMove = function(pos) {
			var tl = this.tl;
			this.endx = pos.x;
			tl.renderTrack(this.track);
		};

		PProto.mouseUp = function(pos) {
			this.startx = Math.min(this.startx, pos.x);
			this.endx = Math.max(this.startx, pos.x);
			this.track.resolvePlaceholder();
		};
	}(Placeholder.prototype));

}(window.Timeline,window.TimedText));
