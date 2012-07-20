(function(Timeline){
	"use strict";
	var Proto;
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function Slider(tl) {
		var view = tl.view;
		this.tl = tl;
		this.active = false;
		this.resizeSide = 0;		
		this.initStart = 0;
		this.initEnd = 0;
	}
	
	function move(diff){
		if(diff > 0){
			if(this.initEnd+diff <= this.tl.width){
				this.endx = this.initEnd+diff;
				this.startx = this.initStart+diff;
			}else{
				this.endx = this.tl.width;
				this.startx = this.initStart+this.tl.width-this.initEnd;
			}
		}else{
			if(this.initStart+diff >= 0){
				this.startx = this.initStart+diff;
				this.endx = this.initEnd+diff;
			}else{
				this.startx = 0;
				this.endx = this.initEnd-this.initStart;
			}
		}
	}
	
	Proto = Slider.prototype;
	
	Object.defineProperties(Proto, {
		startx: {
			get: function(){
				var tl = this.tl;
				return Math.round(tl.view.startTime*(tl.width-3*tl.sliderHandleWidth)/(tl.length-tl.width/1000));
			},
			set: function(px){
				var tl = this.tl;
				tl.view.startTime = px*(tl.length-tl.width/1000)/(tl.width-3*tl.sliderHandleWidth);
			},enumerable: true
		},
		endx: {
			get: function(){
				var tl = this.tl,
					tw = tl.width/1000,
					mw = 3*tl.sliderHandleWidth;
				return mw + Math.round((tl.view.endTime-tw)*(tl.width-mw)/(tl.length-tw));
			},
			set: function(px){
				var tl = this.tl,
					tw = tl.width/1000,
					mw = 3*tl.sliderHandleWidth;
				tl.view.endTime = tw + (px - mw)*(tl.length-tw)/(tl.width-mw);
			},enumerable: true
		},
		middle: {
			get: function(){
				var tl = this.tl,
					view = tl.view,
					tw = tl.width/1000,
					mw = 3*tl.sliderHandleWidth;
				return (mw + (tl.view.endTime + tl.view.startTime - tw)*(tl.width-mw)/(tl.length-tw))/2;
			},
			set: function(px){
				var diff = px - this.middle;
				this.initEnd = this.endx;
				this.initStart = this.startx;
				move.call(this,diff);
			},enumerable: true
		}
	});
	
	// Event handlers
	Proto.mouseDown = function(pos) {
		this.initStart = this.startx;
		this.initEnd = this.endx;

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
					this.startx = this.initStart + diff;
					break;
				case 0:
					move.call(this,diff);
					break;
				case 1:
					this.endx = this.initEnd + diff;
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
		var tl = this.tl,
			images = tl.images,
			ctx = tl.ctx,
			start = this.startx,
			end = this.endx - tl.sliderHandleWidth;
		
		
		ctx.save();
		ctx.translate(0, tl.height - tl.sliderHeight);
		ctx.drawImage(images.sliderLeft, start, 0);
		ctx.drawImage(images.sliderRight, end, 0);
		ctx.fillStyle = ctx.createPattern(images.sliderMid, "repeat-x");
		ctx.fillRect(start + tl.sliderHandleWidth, 0, end - start - tl.sliderHandleWidth, tl.sliderHeight);
		ctx.restore();
	};
	
	Timeline.Slider = Slider;
}(Timeline));