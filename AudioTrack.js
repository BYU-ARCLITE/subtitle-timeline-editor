AudioTrack = (function(){
	"use strict";
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

	AudioTrack.prototype.render = function(){
		var view;
		if(this.references){
			view = this.tl.view;
			this.wave.moveToTime(view.startTime,view.endTime);
		}
	};
	
	AudioTrack.prototype.draw = function(){
		var i, track,
			tl = this.tl,
			width = tl.view.width,
			height = tl.segmentTrackHeight,
			padding = tl.segmentTrackPadding,
			top = tl.keyHeight + padding,
			ctx = tl.octx,
			wave = this.wave;
			
		ctx.save();
		ctx.globalAlpha = .5;
		for(i=0;track=tl.tracks[i];i++){
			ctx.clearRect(0, top, width, height);
			if(track.active && track.audioId === this.id){
				ctx.drawImage(wave.buffer, 0, top);
			}
			top += height + padding;
		}
		ctx.restore();
	};
	
	AudioTrack.prototype.redraw = function(){
		if(this.references){ this.wave.redraw(); }
	};

	return AudioTrack;
}());