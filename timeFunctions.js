var timeFunctions = {
	getSliderOffset: function() {
		var offset = timelineGlobal.slider.x / timelineGlobal.view.width;
		return Math.round(timelineGlobal.length * offset);
	},
	pixelToTime: function(pixel) {
		return Math.round(pixel * timelineGlobal.view.zoom) + this.getSliderOffset();
	},
	timeToPixel: function(time) {
		time -= this.getSliderOffset();
		return Math.round(time / timelineGlobal.view.zoom);
	},
	computeZoom: function(length, width) {
		// zoom is ms per pixel
		return length / width;
	}
};