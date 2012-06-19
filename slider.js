function Slider() {
	this.x= 0;
	this.y = 0;
	this.width = 150; // will change
  this.height = 25;
	this.length = 25; // Percentage
	this.move = false;
	this.resize = false;
	
	this.mouseDownPos = {x: 0, y: 0};
	this.startingPos = {x: 0, y: 0};
	this.startingWidth = 0;
	
	// Event handlers
	this.mouseDown = function(pos) {
    this.mouseDownPos = pos;
		this.startingPos = {x: this.x, y: this.y};
		this.startingWidth = this.width;
    
    // Check to see if the handle was clicked
		if(pos.x >= this.width + this.x - timelineGlobal.sliderHandleWidth)
			this.resize = true;
		else
			this.move = true;
	}
	
	this.mouseMove = function(pos) {
		if(this.move) {
			this.x = this.startingPos.x + pos.x - this.mouseDownPos.x;
			if(this.x < 0)
				this.x = 0;
			if(this.x + this.width > timelineGlobal.view.width)
				this.x = timelineGlobal.view.width - this.width;
		}
		if(this.resize) {
			this.width = this.startingWidth + pos.x - this.mouseDownPos.x;
			if(this.width < timelineGlobal.sliderHandleWidth * 2)
				this.width = timelineGlobal.sliderHandleWidth * 2;
			if(this.width > timelineGlobal.view.width)
				this.width = timelineGlobal.view.width; 
			this.updateLength();
		}
    if(this.move || this.resize)
      timelineGlobal.render();
	}
	
	this.mouseUp = function(pos) {
		this.move = false;
		this.resize = false;
	}
	
	this.updateLength = function() {
		// First check to see if the width is still valid
		if(this.width > timelineGlobal.view.width)
			this.width = timelineGlobal.view.width;
		if(this.width < timelineGlobal.sliderHandleWidth * 2)
			this.width = timelineGlobal.sliderHandleWidth * 2;
	
		// Compute the new length
		this.length = this.width / timelineGlobal.view.width;
		timelineGlobal.view.length = Math.round(this.length * timelineGlobal.length);
		
		// Now update the timeline zoom
		timelineGlobal.view.zoom = timeFunctions.computeZoom(timelineGlobal.view.length, timelineGlobal.view.width);
	}
	
  this.containsPoint = function(pos) {
    var y = timelineGlobal.height - timelineGlobal.sliderHeight;
    return (pos.x >= this.x && pos.x <= this.x + this.width && pos.y >= y && pos.y <= y + this.height);
  }
	
	this.init = function() {
		// Compute the length
		this.length = timelineGlobal.view.length / timelineGlobal.length;
		this.width = Math.max(timelineGlobal.sliderHandleWidth + 10, Math.round(timelineGlobal.view.width * this.length));
                this.height = timelineGlobal.sliderHeight;
	}
  
  this.render2 = function() {
		var endPos = this.x + this.width;
		var top = timelineGlobal.height - timelineGlobal.toolbarHeight - timelineGlobal.sliderHeight;
			
		// Draw the bar
		timelineGlobal.canvasContext.fillStyle = timelineGlobal.sliderColor;
		timelineGlobal.canvasContext.fillRect(this.x, top, (endPos - this.x), timelineGlobal.sliderHeight);
		
		// Now draw the handles
		timelineGlobal.canvasContext.fillStyle = timelineGlobal.sliderHandleColor;
		timelineGlobal.canvasContext.fillRect(endPos - timelineGlobal.sliderHandleWidth, top, timelineGlobal.sliderHandleWidth, timelineGlobal.sliderHeight); // Right handle
  }
  this.render = function() {
		var top = timelineGlobal.height - timelineGlobal.toolbarHeight - timelineGlobal.sliderHeight;
		var width = this.width - timelineGlobal.sliderLeft.width - timelineGlobal.sliderRight.width;
			
		// Draw the bar
		// timelineGlobal.canvasContext.fillStyle = timelineGlobal.sliderColor;
		// timelineGlobal.canvasContext.fillRect(this.x, top, (endPos - this.x), timelineGlobal.sliderHeight);
		
		// Now draw the handles
		// timelineGlobal.canvasContext.fillStyle = timelineGlobal.sliderHandleColor;
		// timelineGlobal.canvasContext.fillRect(endPos - timelineGlobal.sliderHandleWidth, top, timelineGlobal.sliderHandleWidth, timelineGlobal.sliderHeight); // Right handle
		
		if(width < 0)
			width = 0;
		
		timelineGlobal.canvasContext.drawImage(timelineGlobal.sliderLeft, this.x, top);
		timelineGlobal.canvasContext.drawImage(timelineGlobal.sliderMid, this.x + timelineGlobal.sliderLeft.width, top, width, timelineGlobal.sliderHeight);
		timelineGlobal.canvasContext.drawImage(timelineGlobal.sliderRight, this.x + width + timelineGlobal.sliderLeft.width, top);
  }
}