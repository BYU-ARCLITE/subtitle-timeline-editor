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
		ctx.fillStyle = tl.colors.placeholder;
		ctx.globalAlpha = .5;
		ctx.fillRect(this.startx, top, this.endx - this.startx, tl.trackHeight);
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
			seg;

		// Create a new segment
		if(this.startx < pos.x){
			seg = this.track.add(tl.view.pixelToTime(this.startx), tl.view.pixelToTime(pos.x), "");
		}else{
			seg = this.track.add(tl.view.pixelToTime(pos.x), tl.view.pixelToTime(this.startx), "");
		}
		// Automatically select new segments
		tl.select(seg);
	};
	
	Timeline.Placeholder = Placeholder;
}(Timeline));