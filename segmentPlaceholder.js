function SegmentPlaceholder() {
  this.startX = 0;
  this.endX = 0;
  this.track = 0;
  this.elementTrack = 0;
  
  this.init = function(pos) {
    this.startPos = pos;
  }
  
  this.render = function() {
    timelineGlobal.canvasContext.fillStyle = timelineGlobal.placeholderColor;
    var top = timelineGlobal.getTrackTop(this.track);
    timelineGlobal.canvasContext.fillRect(this.startX, top, this.endX - this.startX, timelineGlobal.segmentTrackHeight);
  }
  this.containsPoint = function(pos) {
    return false;
  }
  this.mouseMove = function(pos) {
    this.endX = pos.x;
    timelineGlobal.render();
  }
  this.mouseUp = function(pos) {
    this.endX = pos.x;
    
    // Clear the element from the timeline
    timelineGlobal.elements.splice(this.elementTrack, 1);
    
    // Create a new segment
    start = timeFunctions.pixelToTime( (this.startX < this.endX)?this.startX:this.endX );
    end   = timeFunctions.pixelToTime( (this.startX < this.endX)?this.endX:this.startX );
    var index = timelineGlobal.elements[this.track].length;
    var seg = new Segment(start, end, "", index);
    seg.track = this.track;
    
    // Add the segment to its track
    timelineGlobal.elements[this.track].push(seg);
    timelineGlobal.render();
	
	// Save the event
	var e = new TimelineEvent("create");
	e.attributes.id = index;
	e.attributes.track = this.track;
	e.attributes.startTime = start;
	e.attributes.endTime = end;
	timelineGlobal.tracker.addEvent(e);
	
	timelineGlobal.update();
  }
}