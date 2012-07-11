(function(Timeline){
	"use strict";
	var Proto;
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function Slider(tl) {
		var x = 0,
			width = tl.sliderHandleWidth*3;
		this.tl = tl;
		this.active = false;
		this.resizeSide = 0;

		Object.defineProperties(this, {
			width: {
				get: function(){ return width; },
				set: function(val){
					width = Math.min(Math.max(val, tl.sliderHandleWidth*3), tl.width - x);//, 1800*tl.width/tl.length);
					return width;
				}
			},
			x: {
				get: function(){ return x; },
				set: function(val){ return x = Math.min(tl.width-width, Math.max(0,val)); }
			},
			startx: {
				get: function(){ return x; },
				set: function(val){
					var nx = Math.min(tl.width-width, Math.max(0,val));
					width = Math.min(Math.max(width + x - nx, tl.sliderHandleWidth*3), tl.width - x);
					return x = nx;
				},
				enumerable: true
			},
			endx: {
				get: function(){ return x+width; },
				set: function(val){
					width = Math.min(Math.max(val - x, tl.sliderHandleWidth*3), tl.width - x);//, 1800*tl.view.width/tl.length);
					return x + width;
				},enumerable: true
			}
		});
		
		this.startingX = 0;
		this.startingWidth = 0;
	}

	Proto = Slider.prototype;
	
	// Event handlers
	Proto.mouseDown = function(pos) {
		this.startingX = this.x;
		this.startingWidth = this.width;

		// Check to see if the handle was clicked
		this.resizeSide = this.onHandle(pos);
		this.active = true;
	};

	Proto.mouseMove = function(pos) {
		var diff;
		if(this.active) {
			diff = pos.x - this.tl.mouseDownPos.x;
			switch(this.resizeSide){
				case -1:
					this.x = Math.min(Math.max(this.startingX + diff,0), this.startingX+this.startingWidth-this.tl.sliderHandleWidth*3);
					//, this.startingX+this.startingWidth - 1800*this.tl.width/this.tl.length);
					this.width = this.startingWidth + (this.startingX - this.x);
					break;
				case 0: this.x = this.startingX + diff;
					break;
				case 1: this.width = this.startingWidth + diff;
			}
			this.tl.render();
		}
	};

	Proto.mouseUp = function(pos) {
		this.active = false;
	};

	Proto.containsPoint = function(pos) {
		var y = this.tl.height - this.tl.sliderHeight;
		return (pos.x >= this.startx && pos.x <= this.endx && pos.y >= y && pos.y <= y + this.tl.sliderHeight);
	};

	Proto.onHandle = function(pos) {
		var tl = this.tl,
			y = tl.height - tl.sliderHeight;
		return	(pos.y < y || pos.y > y + this.tl.sliderHeight || pos.x < this.startx || pos.x > this.endx)?0:
				(pos.x <= this.startx + tl.sliderHandleWidth)?-1:
				(pos.x >= this.endx - tl.sliderHandleWidth)?1:
				0;
	};

	Proto.render = function() {
		var i, k, tl = this.tl,
			images = tl.images,
			ctx = tl.ctx,
			start = Math.round(this.startx),
			end = Math.round(this.endx),
			top = tl.height - tl.sliderHeight;
		
		ctx.drawImage(images.sliderLeft, start, top);
		ctx.save();
		ctx.translate(start + tl.sliderHandleWidth, top);
		ctx.fillStyle = ctx.createPattern(images.sliderMid, "repeat-x");
		ctx.fillRect(0, 0, Math.ceil(this.width) - 2*tl.sliderHandleWidth, tl.sliderHeight);
		ctx.restore();
		ctx.drawImage(images.sliderRight, end - tl.sliderHandleWidth, top);
	};
	
	Timeline.Slider = Slider;
}(Timeline));