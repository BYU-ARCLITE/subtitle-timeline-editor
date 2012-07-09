/*
http://www.whatwg.org/specs/web-apps/current-work/webvtt.html
*/
var WebVTT = (function(){
	"use strict";
	var set_pat = /(align|vertical|line|size|position):(\S+)/g,
		time_pat = /\s*(\d*:?[0-5]\d:[0-5]\d\.\d{3})\s*-->\s*(\d*:?[0-5]\d:[0-5]\d\.\d{3})\s*(.*)/;

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
	
	function serialize(cue){
		var text = cue.id+"\n"
			+VTTtime(cue.startTime)+" --> "+VTTtime(cue.endTime);
		if(cue.vertical !== ''){ text+=" vertical:"+cue.vertical; }
		if(cue.align !== 'middle'){ text+=" align:"+cue.align; }
		if(cue.rawLine !== 'auto'){ text+=" line:"+cue.line; }
		if(cue.size !== 100){ text+=" line:"+cue.size+"%"; }
		if(cue.position !== 50){ text+=" position:"+cue.position+"%"; }
		return text+"\n"+cue.text+"\n\n";
	}
	
	function parse_timestamp(input){
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
		serialize: serialize
	};
}());