//http://html5-demos.appspot.com/static/whats-new-with-html5-media/template/index.html#14 TextTrackCue
var Cue = (function(){
	"use strict";
	var set_pat = /(align|vertical|line|size|position):(\S+)/g,
		time_pat = /\s*(\d*:?[0-5]\d:[0-5]\d\.\d{3})\s*-->\s*(\d*:?[0-5]\d:[0-5]\d\.\d{3})\s*(.*)/;

	function validate_percentage(value){
		var number;
		if(/^\d+%$/.test(value)){
			number = parseInt(value,10);
			if(number>=0 && number<=100){
				return number;
			}
		}
		throw new Error("Invalid percentage.");
	}
	
	function parse_settings(cue,line){
		var fields;
		set_pat.lastIndex = 0;
		while(!!(fields = set_pat.exec(line))){
			cue[fields[1]] = fields[2];
		}
	}
	
	function Cue(id,startTime,endTime,text,settings){
		if(!(this instanceof Cue)){ return new Cue(id,startTime,endTime,text,settings); }
		var dir='',
			snap=true,
			line='auto',
			position=50,
			size=100,
			align='middle';
		
		this.startTime = +startTime||0;
		this.endTime = +endTime||0;
		
		text = text.replace(/[\n\r]+/g,'\n');
		
		Object.defineProperties(this,{
			id: {value:id||''},
			text: {
				set: function(t){ return text = t.replace(/[\n\r]+/g,'\n');	},
				get: function(){ return text; }
			},
			vertical: {
				set: function(value){
					return dir = (	value === 'rl' ||
									value === 'lr'	)?value:'';
				},get: function(){return dir;}
			},
			align: {
				set: function(value){
					if(	value==='start' ||
						value==='middle' ||
						value==='end'){ return align=value; }
					throw new Error("Invalid value for align attribute.");
				},get: function(){return align;}
			},
			line: {
				set: function(value){
					var number;
						snap=true;
						if(typeof value === 'number'){ return (line = value)+""; }
						if(value==='auto'){ return line='auto'; }
						if(/^-?\d+%?$/.test(value)){
							number = parseInt(value,10);
							if(value[value.length-1] === '%'){	//If the last character in value is %
								if(number<0 || number>100){ throw new Error("Invalid percentage."); }
								snap = false;
							}
							line = number;
							return value;
						}
						throw new Error("Invalid value for line attribute.");
				},get: function(){return snap?line:(line+"%");}
			},
			rawLine: {
				set: function(value){
					if(value === 'auto'){ return line = 'auto'; }
					value = +value;
					return line = snap?value:(value>100?100:(value<0?0:value));
				},get: function(){ return line; }
			},
			snapToLines: {
				set: function(value){ return snap = !!value; },
				get: function(){ return snap; }
			},
			size: {
				set: function(value){
					return size = validate_percentage(value);
				},get: function(){return size;}
			},
			position: {
				set: function(value){
					return position = validate_percentage(value);
				},get: function(){return position;}
			}
		});
		
		if(settings){parse_settings(this,settings);}
	}
	
	return Cue;
}());