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
	var p, lim, tl = this.tl;
	if(this.move) {
		p = this.startingPos.x + pos.x - this.mouseDownPos.x;
		if(p < 0){ p = 0; }
		else{
			lim = tl.view.width - this.width;
			if(p > lim){ p = lim; }
		}
		this.x = p;
		tl.render();
	}else if(this.resize) {
		p = this.startingWidth + pos.x - this.mouseDownPos.x;
		lim = tl.sliderHandleWidth * 2;
		if(p < lim){ p = lim; }
		else{
			lim = tl.view.width;
			if(p > lim){ p = lim; }
		}
		this.width = p;
		this.updateLength();
		tl.render();
	}
};

Slider.prototype.mouseUp = function(pos) {
	this.move = false;
	this.resize = false;
};

Slider.prototype.updateLength = function() {
	var tl = this.tl,
		length = this.width/tl.view.width;
	this.length = length;
	tl.view.length = length * tl.length;
};

Slider.prototype.containsPoint = function(pos) {
	var y = this.tl.height - this.tl.sliderHeight;
	return (pos.x >= this.x && pos.x <= this.x + this.width && pos.y >= y && pos.y <= y + this.height);
};

Slider.prototype.render = function() {
	var tl = this.tl,
		ctx = tl.ctx,
		top = tl.height - tl.toolbarHeight - tl.sliderHeight,
		width = this.width - tl.sliderLeft.width - tl.sliderRight.width;
	
	if(width < 0)
		width = 0;
	
	ctx.drawImage(tl.sliderLeft, this.x, top);
	ctx.drawImage(tl.sliderMid, this.x + tl.sliderLeft.width, top, width, tl.sliderHeight);
	ctx.drawImage(tl.sliderRight, this.x + width + tl.sliderLeft.width, top);
};