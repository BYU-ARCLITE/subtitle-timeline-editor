(function(Timeline){
	"use strict";
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	function Persistence(tl) {
		var that = this;
		this.tl = tl;
		this.saved = true;		
		this.xhr = new XMLHttpRequest();
		this.xhr.onreadystatechange = function(){
			if(this.readyState==4){
				if(this.status>=200 &&  this.status<400){
					that.saveSuccess(this.responseText);
				}else{
					that.saveError(this.responseText);
				}
			}
		};
		
		Object.defineProperty(this,'xhr',{writable: false});
	}

	Persistence.prototype.target = "ajax/saver.php";
	
	function buildPart(fname, data, mime) {
		return 'Content-Disposition: form-data; name="tracks[]"; filename="'
			+ fname + '"\r\nContent-Type: '
			+ mime + '\r\n\r\n'
			+ data + '\r\n';
	}
	
	function sendParts(parts){
		var i = 0, boundary,
			xhr = this.xhr;
		
		do{ boundary = (++i + Date.now()).toString(36); }
		while(parts.some(function(part){ return part.indexOf(boundary) >= 0; }));
		
		xhr.open("POST",this.target,true);
		xhr.setRequestHeader("Content-type","multipart/form-data; boundary=" + boundary);
		boundary = "--"+boundary;
		xhr.send(
			boundary + "\r\n"
			+ parts.join(boundary + "\r\n")
			+ boundary + "--\r\n"
		);
	}
	
	function addSuffix(name,suffix){
		return (name.substr(name.length-suffix.length).toLowerCase() === suffix)?
				name:name+"."+suffix;
	}
	
	Persistence.prototype.save = function(type, id) {
		var tl = this.tl,
			that = this, tracks,			
			suffix = type.toLowerCase(),
			mime = {srt:"text/srt",vtt:"text/vtt"}[suffix];
			
		if(!mime){ throw new Error("Unsupported File Type."); }
		if(typeof id === 'string'){ //save a single track
			tracks = [tl.getTrack(id)];
			if(!tracks[0]){ throw new Error("Track Does Not Exist."); }
		}else if(id instanceof Array){ //save multiple tracks
			tracks = [];
			id.forEach(function(tid){
				if(tl.trackIndices.hasOwnProperty(tid)){
					tracks.push(tl.getTrack(tid));
				}
			});
		}else{ //save all tracks
			tracks = tl.tracks;
		}
		sendParts.call(this,
			tracks.map(function(track){
				return buildPart.call(that,addSuffix(track.id,suffix),track.serialize(mime),mime);
			})
		);
	};
	
	Persistence.prototype.saveLocal = function(type, id) {
		var track, that = this,
			tl = this.tl,
			serializer = "to"+type.toUpperCase(),
			suffix = type.toLowerCase(),
			mime = {srt:"text/srt",vtt:"text/vtt"}[suffix];
			
		if(!mime){ throw new Error("Unsupported File Type."); }
		if(typeof id !== 'string'){ throw new Error("No track specified."); }
		track = tl.getTrack(id);
		if(!track){ throw new Error("Track Does Not Exist."); }
		
		window.open("data:"+mime+";charset=UTF-8,"+encodeURIComponent(track.serialize(mime)));
	};
	
	Persistence.prototype.saveSuccess = function(data){
		this.saved = true;
		alert(data);
	};

	Persistence.prototype.saveError = function(data) {
		alert("An error was encountered while saving: " + data);
	};
	
	function parseTrackData(data,mime,kind,lang,name){
		var tl = this.tl;
		try{
			tl.addTextTrack(new TimedText.Track(
				TimedText.parseFile(mime||"text/vtt", data),
				kind, lang, name
			));
		}catch(e){
			alert("There was an error loading the track: " + e.message);
		}
	}
	
	Persistence.prototype.loadTextTrack = function(url, kind, lang){
		var tl = this.tl,
			that = this,
			reader, mime;
		if(url instanceof File){
			reader = new FileReader();
			reader.onload = function(evt) {
				parseTrackData.call(that, evt.target.result, url.type, kind, lang, url.name);
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
													kind, lang, url.substr(url.lastIndexOf('/')));
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