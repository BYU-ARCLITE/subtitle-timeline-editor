(function(Timeline){
	"use strict";
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function View(tl, startTime, endTime){
		this.tl = tl;
		if(startTime < endTime){
			this.startTime = startTime;
			this.endTime = endTime;
		}else{
			this.endTime = startTime;
			this.startTime = endTime;
		}
	}

	Object.defineProperties(View.prototype,{
		length: {
			get: function(){
				var tl = this.tl,
					width = tl.width,
					minwidth = tl.sliderHandleWidth*3;
				return width/1000+(tl.length-width/1000)*(tl.slider.width - minwidth)/(width - minwidth);
			}, enumerable: true
		},
		// (secs per pixel)
		zoom: { get: function(){ return this.length/this.tl.width; }, enumerable:true },
		startTime: {
			get: function(){
				var tl = this.tl;
				return tl.slider.startx*(tl.length-tl.width/1000)/(tl.width-tl.sliderHandleWidth*3);
			},
			set: function(val){
				var tl = this.tl;
				return tl.slider.startx = val*(tl.width-tl.sliderHandleWidth*3)/(tl.length-tl.width/1000)
			}, enumerable: true
		},
		endTime: {
			get: function(){
				var tl = this.tl,
					width = tl.width,
					minwidth = tl.sliderHandleWidth*3;
				return width/1000+(tl.length-width/1000)*(tl.slider.endx - minwidth)/(width - minwidth);
			},
			set: function(val){
				var tl = this.tl,
					width = tl.width,
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
	
	Timeline.View = View;
}(Timeline));