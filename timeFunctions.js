var timeFunctions = {
	getSliderOffset: function() {
    var offset = timelineGlobal.slider.x / timelineGlobal.view.width;
    offset = Math.round(timelineGlobal.length * offset);
    return offset;
  },
  pixelToTime: function(pixel) {
		var time = Math.round(pixel * timelineGlobal.view.zoom);
		return time + this.getSliderOffset();
	},
	timeToPixel: function(time) {
		time -= this.getSliderOffset();
		var pixel = Math.round(time / timelineGlobal.view.zoom);
		return pixel;
	},
	computeZoom: function(length, width) {
		// zoom is ms per pixel
		var zoom = length / width;
		return zoom;
	}
}
