(function(Timeline){
	"use strict";
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function Persistence(tl) {
		this.tl = tl;
		this.saved = true;
		
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function(){
			if (xhr.readyState==4){
				if(xhr.status>=200 &&  xhr.status<400){
					this.saveSuccess(xhr.responseText);
				}else{
					this.saveError(xhr.responseText);
				}
			}
		};
		
		Object.defineProperty(this,'xhr',{get: function(){ return xhr; }});
	}

	Persistence.prototype.target = "ajax/saver.php";
	
	function buildPart(fname, data, mime) {
		return 'Content-Disposition: form-data; name="tracks[]"; filename="'
			+ fname + '"\r\nContent-Type: '
			+ mime + '\r\n\r\n'
			+ data + '\r\n';
	}
	
	function sendParts(parts){
		var i, boundary, notunique,
			xhr = this.xhr;
		
		do{
			boundary = "TimeLineVTT----" + (new Date).getTime();
			for(notunique = false, i = 0; i < parts.length; i++){
				if(parts[i].indexOf(boundary) !== -1){
					notunique = true;
					break;
				}
			}
		}while(notunique);
		
		xhr.open("POST",this.target,true);
		xhr.setRequestHeader("Content-type","multipart/form-data; boundary=" + boundary);
		xhr.sendAsBinary(
			"--" + boundary + "\r\n"
			+ parts.join("--" + boundary + "\r\n")
			+ "--" + boundary + "--" + "\r\n"
		);
	}
	
	function addSuffix(name,suffix){
		return (name.toUpperCase().substr(name.length-suffix.length) === suffix)?
				name:name+"."+suffix;
	}
	
	Persistence.prototype.save = function(suffix, id) {
		var track, that = this,
			tl = this.tl,
			serializer, mime;
		suffix = suffix.toUpperCase();
		
		serializer = "to"+suffix;
		mime = {SRT:"text/srt",VTT:"text/vtt"}[suffix];
		if(!mime){ throw new Error("Unsupported file type."); }
			
		sendParts.call(this,
			(track = tl.getTrack(id))?
			[buildPart.call(this,addSuffix(track.id,suffix),track[serializer](),mime)]: //save a single track
			tl.tracks.map(function(track){	//save all the tracks
				return buildPart.call(that,addSuffix(track.id,suffix),track[serializer](),mime);
			})
		);
	};
	
	Persistence.prototype.saveSuccess = function(data){
		this.saved = true;
	};

	Persistence.prototype.saveError = function(data) {
		alert("An error was encountered while saving: " + data);
	};
	
	function parseTrackData(data,mime,name,language){
		var tl = this.tl,
			cues;
		try{
			switch(mime){
				case "text/vtt":
					cues = WebVTT.parse(data);
					break;
				case "text/srt":
					cues = SRT.parse(data);
					break;
				default:
					cues = WebVTT.parse(data);
			}
			
			tl.addTextTrack(cues, name, language);
			tl.render();
		}catch(e){
			alert("There was an error loading the track: "+e);
		}
	}
	
	Persistence.prototype.loadTextTrack = function(url, language){
		var tl = this.tl,
			that = this,
			reader, mime;
		if(url instanceof File){
			reader = new FileReader();
			reader.onload = function(evt) {
				parseTrackData.call(that, evt.target.result, url.type, url.name, language);
			};
			reader.onerror = function(e){alert(e);};
			reader.readAsText(url);
		}else{
			reader = new XMLHttpRequest();
			reader.onreadystatechange = function(){
				if (reader.readyState==4){
					if(reader.status>=200 &&  reader.status<400){
						parseTrackData.call(that,	reader.responseText,
													reader.getResponseHeader('content-type'),
													url.substr(url.lastIndexOf('/')));
					}else{
						alert("The track could not be loaded: " + reader.responseText);
					}
				}
			}
			reader.open("GET",url,true);
			reader.send();
		}
	};
	
	Timeline.Persistence = Persistence;
}(Timeline));