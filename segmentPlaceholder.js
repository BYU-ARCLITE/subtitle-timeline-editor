function SegmentPlaceholder(tl, x, track) {
	this.tl = tl;
	this.startX = x;
	this.endX = 0;
	this.track = track;
}

SegmentPlaceholder.prototype.render = function() {
	var tl = this.tl,
		ctx = tl.ctx,
		top = tl.getTrackTop(this.track);
	ctx.save();
	ctx.fillStyle = tl.placeholderColor;
	ctx.globalAlpha = .5;
	ctx.fillRect(this.startX, top, this.endX - this.startX, tl.segmentTrackHeight);
	ctx.restore();
};

SegmentPlaceholder.prototype.containsPoint = function(pos) { return false; };

SegmentPlaceholder.prototype.mouseMove = function(pos) {
	this.endX = pos.x;
	this.tl.renderTrack(this.track);
	this.render();
};

SegmentPlaceholder.prototype.mouseUp = function(pos) {
	var tl = this.tl,
		seg, e;
		
	this.endX = pos.x;

	// Create a new segment
	if(this.startX < this.endX){
		start = tl.pixelToTime(this.startX);
		end   = tl.pixelToTime(this.endX);
	}else{
		start = tl.pixelToTime(this.endX);
		end   = tl.pixelToTime(this.startX);
	}
	
	seg = new Segment(this.tl, start, end, "", ""+start);

	// Add the segment to its track
	tl.tracks[this.track].add(seg);
};