var SegmentPlaceholder = (function(){
	function SegmentPlaceholder(tl, x, track) {
		this.tl = tl;
		this.startx = x;
		this.endx = 0;
		this.track = track;
	}

	SegmentPlaceholder.prototype.render = function() {
		var tl = this.tl,
			ctx = tl.ctx,
			top = tl.getTrackTop(this.track);
		ctx.save();
		ctx.fillStyle = tl.placeholderColor;
		ctx.globalAlpha = .5;
		ctx.fillRect(this.startx, top, this.endx - this.startx, tl.segmentTrackHeight);
		ctx.restore();
	};

	SegmentPlaceholder.prototype.containsPoint = function(pos) { return false; };

	SegmentPlaceholder.prototype.mouseMove = function(pos) {
		this.endx = pos.x;
		this.tl.renderTrack(this.track);
		this.render();
	};

	SegmentPlaceholder.prototype.mouseUp = function(pos) {
		var tl = this.tl,
			seg, e;
			
		this.endx = pos.x;

		// Create a new segment
		if(this.startx < this.endx){
			start = tl.view.pixelToTime(this.startx);
			end   = tl.view.pixelToTime(this.endx);
		}else{
			start = tl.view.pixelToTime(this.endx);
			end   = tl.view.pixelToTime(this.startx);
		}
		
		seg = new Segment(this.tl, start, end, "");

		// Add the segment to its track
		this.track.add(seg);
		// Automatically select new segments
		tl.select(seg);
	};
	
	return SegmentPlaceholder;
}());