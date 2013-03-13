(function(Timeline){
	"use strict";
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	Timeline.MainMenu = function(timeline){
		return [
			{label:"Editing",submenu:[
				{label:"Undo",
					condition:function(){return this.cstack.undoDepth > 0; },
					action:function(){ this.cstack.undo(); }},
				{label:"Redo",
					condition:function(){return this.cstack.redoDepth > 0; },
					action:function(){ this.cstack.redo(); }},
				{label:"Tools",submenu:[
					{label:"Select",action:function(){ this.currentTool = Timeline.SELECT; }},
					{label:"Move",action:function(){ this.currentTool = Timeline.MOVE; }},
					{label:"Add",action:function(){ this.currentTool = Timeline.CREATE; }},
					{label:"Split",action:function(){ this.currentTool = Timeline.SPLIT; }},
					{label:"Delete",action:function(){ this.currentTool = Timeline.DELETE; }},
					{label:"Shift",action:function(){ this.currentTool = Timeline.SHIFT; }}
				]}
			]},
			{label:"Navigation",submenu:[
				{label:"Repeat Tool",action:function(){ this.currentTool = Timeline.REPEAT; }},
				{label:"Scroll Tool",action:function(){ this.currentTool = Timeline.ORDER; }},
				{label:"Order Tool",action:function(){ this.currentTool = Timeline.ORDER; }},
				{label:"Zoom In",action:function(pos){
					this.view.startTime += (this.view.pixelToTime(pos.x)-this.view.startTime)/2;
					this.view.endTime += (this.view.pixelToTime(pos.x)-this.view.endTime)/2;
					this.render();
				}},
				{label:"Zoom Out",action:function(pos){
					this.view.startTime -= (this.view.pixelToTime(pos.x)-this.view.startTime)/2;
					this.view.endTime -= (this.view.pixelToTime(pos.x)-this.view.endTime)/2;
					this.render();
				}}
			]},
			{label:"AB Repeat",submenu:[
				{label:"Enable",
					condition:function(){return this.abRepeatSet && !this.abRepeatOn; },
					action:function(){ this.abRepeatOn = true; }},
				{label:"Disable",
					condition:function(){return this.abRepeatOn; },
					action:function(){ this.abRepeatOn = false; }},
				{label:"Clear",
					condition:function(){return this.abRepeatSet; },
					action:function(){ this.clearRepeat(); }},
				{label:"Set Repeat Point",action:function(pos){
					(this.abRepeatSet?updateABPoints:resetABPoints).call(this,pos);
				}}
			]}
		];
	};
	
	Timeline.TrackMenu = function(timeline){
		return [
			{label:"Merge Selected",
				condition:function(pos){ return !this.trackFromPos(pos).locked; },
				action:function(pos){ this.trackFromPos(pos).mergeSelected(); }},
			{label:"Lock",
				condition:function(pos){ return !this.trackFromPos(pos).locked; },
				action:function(pos){ this.trackFromPos(pos).locked = true; }},
			{label:"Unlock",
				condition:function(pos){ return this.trackFromPos(pos).locked; },
				action:function(pos){ this.trackFromPos(pos).locked = false; }},
			{label:"Remove",
				action:function(pos){
					var track = this.trackFromPos(pos);
					if(!confirm("Are You Sure You Want To Remove "+track.id+"?")){ return; }
					this.removeTextTrack(track.id);
				}},
			{label:"Set Audio",
				condition: function(pos){ return Reader && WaveForm && Resampler && !this.trackFromPos(pos).locked; },
				submenu: {
					forEach: function(f){
						f({label: "From Disk",
							action: function(pos){
								var tl = this,
									f = document.createElement('input');
								f.type = "file";
								f.addEventListener('change',function(evt){
									var file = evt.target.files[0];
									addWaveToTimeline.call(tl,Reader.fromFile(file),file.name,tl.trackFromPos(pos));
								});
								f.click();	
							}
						});
						f({label: "From URL",
							action: function(pos){
								var tl = this,
									url = prompt("URL of Audio File:","http://"),
									name_match = /\/([^\/]+)$/.exec(url);
								addWaveToTimeline.call(
									tl,
									Reader.fromURL(url),
									name_match[1],
									tl.trackFromPos(pos)
								);
							}
						});
						Object.keys(timeline.audio).forEach(function(key){
							f({label: key,
								action: function(pos){ this.setAudioTrack(this.trackFromPos(pos).id,key); }
							});
						});
					}
				}}
		];
	}
	
	/** Audio Functions **/
	
	function addWaveToTimeline(reader,name,track){
		var tl = this,
			rate = 1001,
			wave = new WaveForm(
				this.width,
				this.trackHeight,
				1/*channels*/,rate
			);
		
		this.addAudioTrack(wave,name);
		this.setAudioTrack(track.id,name);
		console.log("Initializing Audio Decoder");
		initAudioReader(reader,10000/*bufsize*/,rate,wave);
	}
	
	function initAudioReader(reader,bufsize,rate,wave) {
		var chan, frame, buffer, channels, resampler;
		reader.on('format', function(data) {
			resampler = new Resampler(data.sampleRate,rate,1);
			channels = data.channelsPerFrame;
			bufsize -= bufsize%channels;
			buffer = new Float32Array(bufsize);
			chan = buffer.subarray(0,bufsize/channels);
			frame = new Float32Array(Math.ceil(bufsize*rate/(data.sampleRate*channels)));
		});
		reader.on('ready', function(){
			var startTime = Date.now(),
				repeat = setInterval(function(){
				var i, j;
				if(reader.get(buffer) !== 'filled'){
					clearInterval(repeat);
				}else{
					//deinterlace:
					for(i=0,j=0;j<bufsize;j+=channels){
						chan[i++] = buffer[j];
					}
					resampler.exec(chan,frame);
					wave.addFrame(frame); //addFrame emits redraw
				}
			},1);
		});
		reader.start();
	}
	
	Timeline.SegMenu = function(timeline){
		return [
			{label:"Select",
				condition:function(pos){ return !this.segFromPos(pos).selected; },
				action:function(pos){ this.segFromPos(pos).select(); }},
			{label:"Unselect",
				condition:function(pos){ return this.segFromPos(pos).selected; },
				action:function(pos){ this.segFromPos(pos).unselect(); }},
			{label:"Split", action:function(pos){ this.segFromPos(pos).split(pos); }},
			{label:"Delete", action:function(pos){ this.segFromPos(pos).del(); }},
			{label:"Match Repeat",
				condition:function(pos){ return this.abRepeatSet; },
				action:function(pos){ this.segFromPos(pos).move(this.repeatA,this.repeatB); }}
		];
	};
	
}(Timeline));