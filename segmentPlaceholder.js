function SegmentPlaceholder(tl, x, track) {
	this.tl = tl;
	this.startX = x;
	this.endX = 0;
	this.track = track;
	this.renderIndex = tl.misc.length;
	tl.misc.push(this);
}

SegmentPlaceholder.prototype.render = function() {
	this.tl.ctx.fillStyle = this.tl.placeholderColor;
	var top = this.tl.getTrackTop(this.track);
	this.tl.ctx.fillRect(this.startX, top, this.endX - this.startX, this.tl.segmentTrackHeight);
};

SegmentPlaceholder.prototype.containsPoint = function(pos) { return false; };

SegmentPlaceholder.prototype.mouseMove = function(pos) {
	this.endX = pos.x;
	this.tl.render();
};

SegmentPlaceholder.prototype.mouseUp = function(pos) {
	this.endX = pos.x;

	// Clear the element from the timeline
	this.tl.misc.splice(this.renderIndex, 1);

	// Create a new segment
	start = this.tl.pixelToTime( (this.startX < this.endX)?this.startX:this.endX );
	end   = this.tl.pixelToTime( (this.startX < this.endX)?this.endX:this.startX );
	var seg = new Segment(this.tl, start, end, "");

	// Add the segment to its track
	this.tl.tracks[this.track].add(seg);
	this.tl.render();

	// Save the event
	var e = new TimelineEvent("create");
	e.attributes.id = index;
	e.attributes.track = this.track;
	e.attributes.startTime = start;
	e.attributes.endTime = end;
	this.tl.tracker.addEvent(e);

	this.tl.emit('update');
};