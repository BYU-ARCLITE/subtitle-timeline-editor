(function(Timeline){
	"use strict";
	var Proto;
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function Placeholder(tl, track, x) {
		this.tl = tl;
		this.track = track;
		this.startx = x;
		this.endx = 0;
	}

	Proto = Placeholder.prototype;
	
	Proto.render = function() {
		var tl = this.tl,
			ctx = tl.ctx,
			top = tl.getTrackTop(this.track);
		ctx.save();
		ctx.fillStyle = tl.placeholderColor;
		ctx.globalAlpha = .5;
		ctx.fillRect(this.startx, top, this.endx - this.startx, tl.segmentTrackHeight);
		ctx.restore();
	};

	Proto.containsPoint = function(pos) { return false; };

	Proto.mouseMove = function(pos) {
		this.endx = pos.x;
		this.tl.renderTrack(this.track);
		this.render();
	};

	Proto.mouseUp = function(pos) {
		var tl = this.tl,
			seg, start, end;
			
		this.endx = pos.x;

		// Create a new segment
		if(this.startx < this.endx){
			start = tl.view.pixelToTime(this.startx);
			end   = tl.view.pixelToTime(this.endx);
		}else{
			start = tl.view.pixelToTime(this.endx);
			end   = tl.view.pixelToTime(this.startx);
		}
		
		seg = new Timeline.Segment(this.tl, start, end, "");

		// Add the segment to its track
		this.track.add(seg);
		// Automatically select new segments
		tl.select(seg);
	};
	
	Timeline.Placeholder = Placeholder;
}(Timeline));