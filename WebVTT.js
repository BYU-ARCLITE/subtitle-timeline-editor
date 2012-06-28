/*
http://www.whatwg.org/specs/web-apps/current-work/webvtt.html
*/
//http://html5-demos.appspot.com/static/whats-new-with-html5-media/template/index.html#14 TextTrackCue
var WebVTT = (function(){
	var set_pat = /(align|vertical|line|size|position):(\S+)/g,
		time_pat = /\s*(\d*:?[0-5]\d:[0-5]\d\.\d{3})\s*-->\s*(\d*:?[0-5]\d:[0-5]\d\.\d{3})\s*(.*)/;

	function validate_percentage(value){
		"use strict";
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
		"use strict";
		var fields;
		set_pat.lastIndex = 0;
		while(!!(fields = set_pat.exec(line))){
			cue[fields[1]] = fields[2];
		}
	}
	
	function Cue(id,startTime,endTime,text,settings){
		"use strict";
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
	
	function VTTtime(time){
		var seconds = Math.floor(time),
			minutes = Math.floor(seconds/60),
			hh,mm,ss,ms,text;
		hh = Math.floor(minutes/60);
		mm = (minutes%60);
		ss = (seconds%60);
		ms = Math.floor(1000*(time-seconds));
		text = (hh>0?(hh>9?hh:"0"+hh)+":":"");
		return text+(mm>9?mm:"0"+mm)+":"+(ss>9?ss:"0"+ss)+"."+(ms>99?ms:(ms>9?"0"+ms:"00"+ms));
	}
	
	Cue.prototype.toVTT = function(){
		var text = this.id+"\n"
			+VTTtime(this.startTime)+" --> "+VTTtime(this.endTime);
		if(this.vertical !== ''){ text+=" vertical:"+this.vertical; }
		if(this.align !== 'middle'){ text+=" align:"+this.align; }
		if(this.rawLine !== 'auto'){ text+=" line:"+this.line; }
		if(this.size !== 100){ text+=" line:"+this.size+"%"; }
		if(this.position !== 50){ text+=" position:"+this.position+"%"; }
		return text+"\n"+this.text+"\n\n";
	}
	
	function SRTtime(time){
		var seconds = Math.floor(time),
			minutes = Math.floor(seconds/60),
			hh,mm,ss,ms;
		hh = Math.floor(minutes/60);
		mm = (minutes%60);
		ss = (seconds%60);
		ms = Math.floor(1000*(time-seconds));
		return (hh>9?hh:"0"+hh)+":"
				+(mm>9?mm:"0"+mm)+":"
				+(ss>9?ss:"0"+ss)+","
				+(ms>99?ms:(ms>9?"0"+ms:"00"+ms));
	}
	
	Cue.prototype.toSRT = function(){
		return (parseInt(this.id,10)||"0")+"\n"
			+SRTtime(this.startTime)+" --> "+SRTtime(this.endTime)
			+"\n"+this.text+"\n\n";
	}
	
	function parse_timestamp(input){
		"use strict";
		var ret,p,fields;
		if(input[0]===':'){throw new SyntaxError("Unexpected Colon");}
		fields = input.split(/[:.]/);
		if(fields.length===4){
			ret = parseInt(fields[0],10)*3600+parseInt(fields[3],10)/1000;
			p = 1;
		}else{
			ret = parseInt(fields[2],10)/1000;
			p = 0;
		}
		return ret + parseInt(fields[p],10)*60 + parseInt(fields[++p],10);
	}
	
	function add_cue(p,input,id,fields,cue_list){
		var s, l, len=input.length;
		get_text: {
			if(	(input[p] === '\r') && //Skip CR
				(++p === len)	){break get_text;}
			if(	(input[p] === '\n')	&& //Skip LF
				(++p === len)	){break get_text;}
			s = p;
			do{	//Cue text loop:
				l=p; //Collect a sequence of characters that are not CR or LF characters.
				while(p < len && input[p] !== '\r' && input[p] !== '\n'){p++;}
				if(l===p){break;} //terminate on an empty line
				if(	(input[p] === '\r') && //Skip CR
					(++p === len)	){break;}
				if(input[p] === '\n'){ ++p; } //Skip LF
			}while(p < len); 
		}
		//Cue text processing:
		//This where we ought to construct the cue-text DOM
		cue_list.push(
			new Cue(id,
					parse_timestamp(fields[1]), //startTime
					parse_timestamp(fields[2]), //endTime
					//Replace all U+0000 NULL characters in input by U+FFFD REPLACEMENT CHARACTERs.
					input.substring(s,p).replace('\0','\uFFFD'),
					fields[3] //settings
			));
		return p;
	}
	
	function parse_cues(input,p){
		"use strict";
		var line,l,id,fields,
			cue_list = [],
			len = input.length;
		
		function crlf(){
			if(	(input[p] === '\r') && //Skip CR
				(++p === len)	){throw 0;}
			if(	(input[p] === '\n')	&& //Skip LF
				(++p === len)	){throw 0;}
		}
		
		function collect_line(){
			l=p; //Collect a sequence of characters that are not CR or LF characters.
			while(input[p]!=='\r' && input[p] !=='\n'){
				if(++p === len){throw 0;}
			}
		}
		
		try {
			cue_loop: do{
				//Skip CR & LF characters.
				while(input[p]==='\r' || input[p]==='\n'){
					if(++p === len){break cue_loop;}
				}
				collect_line();
				line = input.substring(l,p);
				//If line does not contain "-->", treat it as an id & get a new line
				if(line.indexOf('-->')===-1){
					crlf();
					collect_line();
					if(l===p){continue cue_loop;} //If line is the empty string, start over.
					id = line; //Let cue's text track cue identifier be the previous line.
					line = input.substring(l,p);
				}else{id = '';}
				
				//Collect WebVTT cue timings and settings from line
				if(fields = time_pat.exec(line)){
					p = add_cue(p,input,id,fields,cue_list);
				}else{ //Bad cue loop:
					do{	crlf();
						collect_line();
					}while(l!==p); //Look for a blank line to terminate
				}
			}while(p < len);
		}finally{//End: The file has ended. The WebVTT parser has finished.
			return cue_list;
		}
	}

	function parse(input){
		"use strict";
		var line,l,p,
			len = input.length;

		//If the first character is a BYTE ORDER MARK, skip it.
		l = p = +(input[0] === '\uFEFF');
		//Collect a sequence of chars that are not CR or LF.
		while(p < len && input[p] !== '\r' && input[p] !== '\n'){p++;}
		//If line is less than 6 chars long, this is not a WebVTT file.
		if(p-l<6){throw new Error("Not WebVTT Data");}
		line = input.substring(l,p);
		//If the first 6 chars !== "WEBVTT", or line > 6 chars long
		//and the 7th char is neither U+0020 SPACE nor U+0009 TABULATION, this is not a WebVTT file.
		if(!/^WEBVTT([\u0020\u0009].*|$)/.test(line)){throw new Error("Not WebVTT Data");}
		
		//If position is past the end of input, end.
		if(p === len){return [];}
		do{	//Header:
			if(	(input[p] === '\r') && //Skip CR
				(++p === len)	){return [];}
			if(	(input[p] === '\n')	&& //Skip LF
				(++p === len)	){return [];}
			l=p; //Collect a sequence of characters that are not CR or LF characters.
			while(input[p] !== '\r' && input[p] !== '\n'){
				if(++p === len){return [];}
			}
		}while(l!==p);	//Look for an empty line to finish the header
		return parse_cues(input,p);
	}	
	
	return {
		parse: parse,
		Cue: Cue
	};
}());