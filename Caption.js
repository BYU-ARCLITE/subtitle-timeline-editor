(function(Ayamel){
	"use strict";
	if(!Ayamel){
		throw new Error("Ayamel Uninitialized");
	}
	
	function caption_menu(){
		var selection;
		return Object.create(Object,{
				element: {value: document.createElement('span')},
				selection: {
					set: function(s){
						selection = s;
						this.element.innerText = s.toString();
					},
					get: function(){return selection;}
				}
			});
	}
	
	function Caption(params){
		Ayamel.Text.call(this,params);
		this.start = params.start;
		this.stop = params.stop;
	};
	
	Caption.prototype.Update = function(cue){
		var style = this.el.style,
			self = this,
			size,l,alr,
			indent,
			direction,
			position = cue.position;
			
		style.position = 'absolute';
		this.start = cue.startTime;
		this.stop = cue.endTime;
		this.id = cue.id;
		this.text = cue.text;
		
		/*
		Apply the Unicode Bidirectional Algorithm's Paragraph Level steps to the text to determine the paragraph embedding level of the first Unicode paragraph of the cue. [http://www.unicode.org/reports/tr9/]
		If the paragraph embedding level determined in the previous step is even (the paragraph direction is left-to-right), let direction be 'ltr', otherwise, let it be 'rtl'.
		This is a bit of a cheat for now.
		*/
		alr = /^[\u200F\u0590–\u07BF\uFB50–\uFDFF\uFE70–\uFEFF]/.test(cue.text); //AL & R characters
		direction = alr?'rtl':'ltr';
		/*
		A WebVTT vertical text cue setting configures the defines the ordering of lines, not the direction of symbols.
		*/
		
		//Determine the maximum possible size based on alignment
		switch(cue.align){
			case 'start':
				style.textAlign = 'left';
				size = (cue.vertical !== '' || direction !== 'rtl')?100-position:position;
				break;
			case 'end':
				style.textAlign = 'right';
				size = (cue.vertical !== '' || direction !== 'rtl')?position:100-position;
				break;
			case 'middle':
				style.textAlign = 'center';
				size = 2*(position>50?100-position:position);
				break;
			default:
				throw "Invalid Alignment Value";
		}
		if(cue.size<size){size=cue.size;}
		
		//Determine the writing direction and actual size and position
		style.width = "auto";
		style.height = "auto";
		style.top = "";
		style.bottom = "";
		style.left = "";
		style.right = "";
		style.lineHeight = 1;
		if(cue.vertical === ''){
			style.writingMode = "horizontal-tb";
			lineOffset('top','bottom');
			style.width = size+"%";
			switch(cue.align){
				case 'start': indent = direction==='ltr'?position:(100-position-size);
					break;
				case 'end': indent = direction==='ltr'?(position-size):(100-position);
					break;
				default: indent = (direction==='ltr'?position:100-position)-size/2;
			}
			style.left = indent+"%";
		}else{
			switch(cue.vertical){
				case 'rl':
					style.writingMode = "tb-rl";
					style.webkitWritingMode = "vertical-rl";
					lineOffset('right','left');
					break;
				case 'lr':
					style.writingMode = "tb-lr";
					style.webkitWritingMode = "vertical-lr";
					lineOffset('left','right');
					break;
				default:
					throw "Invalid Writing Direction";
			}
			style.height = size+"%";
			switch(cue.align){
				case 'start': indent = position;
					break;
				case 'end': indent = position-size;
					break;
				default: indent = position-size/2;
			}
			style.top = indent+"%";
		}
		
		function lineOffset(top,bottom){
			var pos,unit,lh;
			if(cue.rawLine === 'auto'){
				style[bottom] = 0;
			}else{
				if(cue.snapToLines){
					lh = parseInt(getComputedStyle(self.el).lineHeight,10);
					pos = cue.rawLine*lh;
					if(pos < 0){ style[bottom] = (-pos-lh)+"px"; }
					else{ style[top] = pos+"px"; }
				}else{
					style[top] = cue.rawLine+"%";
				}
			}
		}
	};
	
	Caption.FromCue = function(wrapper,processor,cue){
		var cap = new Caption({
				wrapper:wrapper,
				menu:caption_menu(),
				processor:processor,
				text:cue.text,
				start:cue.startTime,
				stop:cue.endTime
			});
			
		cap.Update(cue);		
		return cap;
	};

	Caption.Track = function(clist, smode, stime){
		var mode, match,
			time = +stime||0,
			captions = clist||[],
			active = [],
			hidden = [];
		
		match = /showing|disabled|hidden/.exec(""+smode);
		mode = match?match[0]:'showing';
		
		captions.forEach(function(c){
			if(c.start <= time && time <= c.stop){
				active.push(c);
			}else{ hidden.push(c); }
		});
				
		Object.defineProperties(this,{
			captions: {get: function(){return cues;}},
			activeCaptions: {get: function(){return active;}},
			mode: {
				set: function(val){
					val = ""+val;
					if(mode !== val){
						switch(mode){
							case 'showing':
								active.forEach(function(c){c.display(this.target);});
								break;
							case 'disabled':
							case 'hidden':
								active.forEach(function(c){c.hide();});
							default:
								return mode;
						}
						mode = val;
					}
					return mode;
				},
				get: function(){return mode;}
			},
			time: {
				set: function(t){
					time = +t;
					var i, c, newhidden = [];
					for(i=0;c = active[i];){
						if(c.stop < time || time < c.start){
							c.hide();
							newhidden.push(active.splice(i,1)[0]);
						}else{i++;}
					}
					if(mode === 'showing'){
						for(i=0;c = hidden[i];){
							if(c.start <= time && time <= c.stop){
								c.display(this.target);
								active.push(hidden.splice(i,1)[0]);
							}else{i++;}
						}
					}else{
						for(i=0;c = hidden[i];){
							if(c.start <= time && time <= c.stop){
								active.push(hidden.splice(i,1)[0]);
							}else{i++;}
						}
					}
					hidden.push.apply(hidden,newhidden);
				},
				get: function(){return time;}
			}
		});
		this.target = null;
		this.addCaption = function(cap){
			captions.push(cap);
			if(cap.start <= time && cap.stop >= time){
				active.push(cap);
				if(mode === 'showing'){cap.display(this.target);}
			}else{ hidden.push(cap); }
		};
	};
	
	Caption.Track.FromCues = function(wrapper, processor, clist, smode, stime){
		return new Caption.Track(clist.map(Caption.FromCue.bind(null,wrapper,processor)),smode,stime);
	};
	
	Ayamel.Caption = Caption;
}(Ayamel));