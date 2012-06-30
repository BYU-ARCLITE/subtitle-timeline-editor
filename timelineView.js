function timelineView(tl){
	this.tl = tl;
	this.width = 0;
	this.startPixel = 0;
	this.startTime = 0;
	this.length = 5;
}

Object.defineProperties(timelineView.prototype,{
	// (secs per pixel)
	zoom: { get: function(){ return this.length/this.width; }, enumerable:true },
	endPixel: { get: function(){ return this.width+this.startPixel; }, enumerable:true },
	startTime: {get: function(){ return this.tl.sliderOffset; }, enumerable:true },
	endTime: { get: function(){ return this.length+this.tl.sliderOffset; }, enumerable:true }
});