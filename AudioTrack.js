(function(Timeline){
	"use strict";
	var Proto;
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function AudioTrack(tl, wave, id){
		var refs = 0;
		this.tl = tl;
		this.id = id;
		this.wave = wave;
		
		tl.tracks.forEach(function(track){
			if(track.audioId === id) refs++;
		});
		
		this.references = refs;
		wave.on('redraw',this.draw.bind(this));
	}

	Proto = AudioTrack.prototype;
	
	Proto.render = function(){
		var view;
		if(this.references){
			view = this.tl.view;
			this.wave.moveToTime(view.startTime,view.endTime);
		}
	};
	
	Proto.draw = function(){
		var id = this.id,
			tl = this.tl,
			buffer = this.wave.buffer,
			width = tl.width,
			height = tl.trackHeight,
			padding = tl.trackPadding,
			top = tl.keyHeight + padding,
			ctx = tl.octx;
		
		if(!this.references){ return; }
		
		ctx.save();
		ctx.globalAlpha = .5;
		tl.tracks.forEach(function(track){
			if(track.audioId === id){
				ctx.clearRect(0, top, width, height);
				if(!track.locked){ ctx.drawImage(buffer, 0, top); }
			}
			top += height + padding;
		});
		ctx.restore();
	};
	
	Proto.redraw = function(){
		if(this.references){ this.wave.redraw(); }
	};

	Timeline.AudioTrack = AudioTrack;
}(Timeline));