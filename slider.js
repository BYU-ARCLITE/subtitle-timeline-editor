function Slider(tl) {
	var length = tl.view.length / tl.length;
	this.tl = tl;
	this.x = 0;
	this.y = 0;
	this.move = false;
	this.resize = false;
	
	this.length = length;
	this.width = Math.max(tl.sliderHandleWidth + 10, Math.round(tl.view.width * length));
	this.height = tl.sliderHeight;
	
	this.mouseDownPos = {x: 0, y: 0};
	this.startingPos = {x: 0, y: 0};
	this.startingWidth = 0;
}

// Event handlers
Slider.prototype.mouseDown = function(pos) {
	this.mouseDownPos = pos;
	this.startingPos = {x: this.x, y: this.y};
	this.startingWidth = this.width;

// Check to see if the handle was clicked
	if(pos.x >= this.width + this.x - this.tl.sliderHandleWidth)
		this.resize = true;
	else
		this.move = true;
};

Slider.prototype.mouseMove = function(pos) {
	if(this.move) {
		this.x = this.startingPos.x + pos.x - this.mouseDownPos.x;
		if(this.x < 0){ this.x = 0; }
		if(this.x + this.width > this.tl.view.width){
			this.x = this.tl.view.width - this.width;
		}
		this.tl.render();
	}else if(this.resize) {
		this.width = this.startingWidth + pos.x - this.mouseDownPos.x;
		if(this.width < this.tl.sliderHandleWidth * 2){
			this.width = this.tl.sliderHandleWidth * 2;
		}
		if(this.width > this.tl.view.width){
			this.width = this.tl.view.width;
		}
		this.updateLength();
		this.tl.render();
	}
};

Slider.prototype.mouseUp = function(pos) {
	this.move = false;
	this.resize = false;
};

Slider.prototype.updateLength = function() {
	// First check to see if the width is still valid
	if(this.width > this.tl.view.width)
		this.width = this.tl.view.width;
	if(this.width < this.tl.sliderHandleWidth * 2)
		this.width = this.tl.sliderHandleWidth * 2;

	// Compute the new length
	this.length = this.width / this.tl.view.width;
	this.tl.view.length = Math.round(this.length * this.tl.length);
};

Slider.prototype.containsPoint = function(pos) {
	var y = this.tl.height - this.tl.sliderHeight;
	return (pos.x >= this.x && pos.x <= this.x + this.width && pos.y >= y && pos.y <= y + this.height);
};

Slider.prototype.render2 = function() {
	var endPos = this.x + this.width;
	var top = this.tl.height - this.tl.toolbarHeight - this.tl.sliderHeight;
		
	// Draw the bar
	this.tl.ctx.fillStyle = this.tl.sliderColor;
	this.tl.ctx.fillRect(this.x, top, (endPos - this.x), this.tl.sliderHeight);
	
	// Now draw the handles
	this.tl.ctx.fillStyle = this.tl.sliderHandleColor;
	this.tl.ctx.fillRect(endPos - this.tl.sliderHandleWidth, top, this.tl.sliderHandleWidth, this.tl.sliderHeight); // Right handle
};
Slider.prototype.render = function() {
	var top = this.tl.height - this.tl.toolbarHeight - this.tl.sliderHeight;
	var width = this.width - this.tl.sliderLeft.width - this.tl.sliderRight.width;
		
	// Draw the bar
	// this.tl.ctx.fillStyle = this.tl.sliderColor;
	// this.tl.ctx.fillRect(this.x, top, (endPos - this.x), this.tl.sliderHeight);
	
	// Now draw the handles
	// this.tl.ctx.fillStyle = this.tl.sliderHandleColor;
	// this.tl.ctx.fillRect(endPos - this.tl.sliderHandleWidth, top, this.tl.sliderHandleWidth, this.tl.sliderHeight); // Right handle
	
	if(width < 0)
		width = 0;
	
	this.tl.ctx.drawImage(this.tl.sliderLeft, this.x, top);
	this.tl.ctx.drawImage(this.tl.sliderMid, this.x + this.tl.sliderLeft.width, top, width, this.tl.sliderHeight);
	this.tl.ctx.drawImage(this.tl.sliderRight, this.x + width + this.tl.sliderLeft.width, top);
};