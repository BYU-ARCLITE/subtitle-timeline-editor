var TimelineView = (function(){
	function TimelineView(tl){
		this.tl = tl;
		this.width = 0;
	}

	Object.defineProperties(TimelineView.prototype,{
		length: {
			get: function(){
				var tl = this.tl,
					width = this.width,
					minwidth = tl.sliderHandleWidth*3;
				return width/1000+(tl.length-width/1000)*(tl.slider.width - minwidth)/(width - minwidth);
			}, enumerable: true
		},
		// (secs per pixel)
		zoom: { get: function(){ return this.length/this.width; }, enumerable:true },
		startTime: {
			get: function(){
				var tl = this.tl;
				return tl.slider.startx*(tl.length-this.width/1000)/(this.width-tl.sliderHandleWidth*3);
			},
			set: function(val){
				var tl = this.tl;
				return tl.slider.startx = val*(this.width-tl.sliderHandleWidth*3)/(tl.length-this.width/1000)
			}, enumerable: true
		},
		endTime: {
			get: function(){
				var tl = this.tl,
					width = this.width,
					minwidth = tl.sliderHandleWidth*3;
				return width/1000+(tl.length-width/1000)*(tl.slider.endx - minwidth)/(width - minwidth);
			},
			set: function(val){
				var tl = this.tl,
					width = this.width,
					minwidth = tl.sliderHandleWidth*3;
				return tl.slider.endx = minwidth + (width - minwidth)*(val - width/1000)/(tl.length-width/1000);
			}, enumerable:true
		},
		pixelToTime: {
			value: function(pixel) {
				return pixel * this.zoom + this.startTime;
			}, enumerable: true
		},
		timeToPixel: {
			value: function(time) {
				return Math.round((time-this.startTime) / this.zoom);
			}, enumerable: true
		}
	});
	
	return TimelineView;
}());