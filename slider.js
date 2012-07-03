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
	this.resizeSide = this.onHandle(pos);
	this.move = !this.resizeSide;
};

Slider.prototype.mouseMove = function(pos) {
	var x, width, lim, tl = this.tl;
	if(this.move) {
		x = pos.x + (this.startingPos.x - this.mouseDownPos.x);
		if(x < 0){ x = 0; }
		else{
			lim = tl.view.width - this.width;
			if(x > lim){ x = lim; }
		}
		this.x = x;
		tl.render();
	}else if(this.resizeSide == 1) {
		width = this.startingWidth + (pos.x - this.mouseDownPos.x);
		lim = tl.sliderHandleWidth * 3;
		if(width < lim){ width = lim; }
		else{
			lim = tl.view.width;
			if(width > lim){ width = lim; }
		}
		this.width = width;
		this.updateLength();
		tl.render();
	}else if(this.resizeSide == -1) {
		x = pos.x + (this.startingPos.x - this.mouseDownPos.x);
		if(x < 0){ x = 0; }
		else{
			lim = this.startingPos.x + this.startingWidth - tl.sliderHandleWidth * 3;
			if(x > lim){ x = lim; }
		}
		this.x = x;
		this.width = this.startingWidth + (this.startingPos.x - x);
		this.updateLength();
		tl.render();
	}
};

Slider.prototype.mouseUp = function(pos) {
	this.move = false;
	this.resizeSide = 0;
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

Slider.prototype.onHandle = function(pos) {
	var tl = this.tl,
		y = this.tl.height - this.tl.sliderHeight;
	return	(pos.y < y || pos.y > y + this.height || pos.x < this.x || pos.x > this.x + this.width)?0:
			(pos.x <= this.x + tl.sliderHandleWidth)?-1:
			(pos.x >= this.x + this.width - tl.sliderHandleWidth)?1:
			0;
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