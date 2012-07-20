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
		var i, boundary, notunique,
			xhr = this.xhr;
		
		do{	boundary = "TimeLineVTT----" + Date.now();
			for(notunique = false, i = 0; i < parts.length; i++){
				if(parts[i].indexOf(boundary) !== -1){
					notunique = true;
					break;
				}
			}
		}while(notunique);
		
		xhr.open("POST",this.target,true);
		xhr.setRequestHeader("Content-type","multipart/form-data; boundary=" + boundary);
		xhr.send(
			"--" + boundary + "\r\n"
			+ parts.join("--" + boundary + "\r\n")
			+ "--" + boundary + "--" + "\r\n"
		);
	}
	
	function addSuffix(name,suffix){
		return (name.substr(name.length-suffix.length).toLowerCase() === suffix)?
				name:name+"."+suffix;
	}
	
	Persistence.prototype.save = function(type, id) {
		var track, that = this,
			tl = this.tl,
			serializer = "to"+type.toUpperCase(),
			suffix = type.toLowerCase(),
			mime = {srt:"text/srt",vtt:"text/vtt"}[suffix];
			
		if(!mime){ throw new Error("Unsupported file type."); }
		if(typeof id === 'string'){ //save a single track
			track = tl.getTrack(id);
			if(track){
				sendParts.call(this,[buildPart.call(this,addSuffix(track.id,suffix),track[serializer](),mime)]);
			}else{
				throw new Error("No Such Track");
			}
		}else{ //save multiple tracks
			if(id instanceof Array){
				sendParts.call(this,
					id
					.filter(function(tid){return tl.trackIndices.hasOwnProperty(tid);})
					.map(function(tid){
						return buildPart.call(that,addSuffix(tid,suffix),tl.getTrack(tid)[serializer](),mime);
					})
				);
			}else{ //save all tracks
				sendParts.call(this,
					tl.tracks.map(function(track){
						return buildPart.call(that,addSuffix(track.id,suffix),track[serializer](),mime);
					})
				);
			}
		}
	};
	
	Persistence.prototype.saveLocal = function(type, id) {
		var track, that = this,
			tl = this.tl,
			serializer = "to"+type.toUpperCase(),
			suffix = type.toLowerCase(),
			mime = {srt:"text/srt",vtt:"text/vtt"}[suffix];
			
		if(!mime){ throw new Error("Unsupported file type."); }
		if(typeof id !== 'string'){ throw new Error("No track specified."); }
		track = tl.getTrack(id);
		if(!track){ throw new Error("Track does not exist."); }
		
		window.open("data:"+mime+";charset=UTF-8,"+encodeURIComponent(track[serializer]()));
	};
	
	Persistence.prototype.saveSuccess = function(data){
		this.saved = true;
		alert(data);
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