segmentTrack = (function(){
	"use strict";
	function segmentTrack(tl, cues, id, language, karaoke){
		var active = false;
		this.tl = tl;
		this.id = id;
		this.language = language;
		this.karaoke = !!karaoke;
		this.segments = cues.map(function(cue){
			var seg = (cue instanceof Segment)?cue:new Segment(tl, cue);
			seg.track = id;
			return seg;
		});
		this.segments.sort(Segment.order);
		this.visibleSegments = [];
		this.active = false;
		this.audio = null;
	}
	
	segmentTrack.prototype.add = function(seg){
		var tl = this.tl;
		
		seg.track = this.id;
		this.segments.push(seg);
		this.segments.sort(Segment.order);
		
		// Save the event 
		tl.tracker.addEvent(new TimelineEvent("create",{
			id:seg.id,
			track:this.track,
			startTime:start,
			endTime:end
		}));
		tl.renderTrack(this.id);
		tl.emit('update');
	};
	
	segmentTrack.prototype.searchRange = function(low, high){
		//TODO: Higher efficiency binary search
		return this.segments.filter(function(seg){
			return !seg.deleted && seg.startTime < high && seg.endTime > low;
		});
	};

	segmentTrack.prototype.render = function(){
		var that = this,
			tl = this.tl,
			startTime = tl.view.startTime,
			top = tl.getTrackTop(this.id),
			ctx = tl.ctx,
			audio = this.audio,
			selected = null;
		
		ctx.drawImage(tl.trackBg, 0, top, tl.view.width, tl.segmentTrackHeight);
		this.visibleSegments = this.searchRange(startTime,tl.view.endTime).sort(Segment.order);
		this.visibleSegments.forEach(function(seg){
			if(seg.selected){ selected = seg; }
			else{ seg.render(); }
		});
		selected && selected.render();
		if(audio && this.active){
			audio.shift(startTime/1000,tl.view.length/1000);
			ctx.save();
			ctx.globalAlpha = .5;
			ctx.drawImage(audio.buffer, 0, top);		
			ctx.restore();
		}
	};
	
	return segmentTrack;
}());