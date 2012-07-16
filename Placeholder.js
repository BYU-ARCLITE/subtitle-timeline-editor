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
		this.endx = x;
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

	Proto.mouseMove = function(pos) {
		this.endx = pos.x;
		this.tl.renderTrack(this.track);
		this.render();
	};

	Proto.mouseUp = function(pos) {
		var view = this.tl.view,
			startx, endx;

		if(this.startx < pos.x){
			startx = this.startx;
			endx = pos.x;
		}else{
			startx = pos.x;
			endx = this.startx;
		}
		this.track.add(view.pixelToTime(startx), view.pixelToTime(endx), "", "", true);
	};
	
	Timeline.Placeholder = Placeholder;
}(Timeline));