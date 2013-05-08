(function(Timeline,global){
	"use strict";

	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}

	function order(a,b){
		//sort first by start time, then by length
		return (a.startTime - b.startTime) || (b.endTime - a.endTime);
	}

	function TlTextTrack(tl, cuetrack){
		var locked = false,
			that = this;
		this.tl = tl;
		this.textTrack = cuetrack;
		this.segments = cuetrack.cues.map(function(cue){ return new Segment(that, cue); });
		this.segments.sort(order);
		this.visibleSegments = [];
		this.audioId = null;
		this.placeholder = null;
		this.lastPos = null;

		Object.defineProperty(this,'locked',{
			get: function(){ return locked; },
			set: function(val){
				val = !!val;
				if(val !== locked){
					locked = val;
					if(active){ this.segments.forEach(function(seg){ seg.selected = false; }); }
					tl.renderTrack(this);
					if(this.audioId){ tl.audio[this.audioId].draw(); }
				}
				return locked;
			}
		});
	}

	function Segment(track, cue) {
		var deleted = false;
		this.tl = track.tl;
		this.track = track;
		this.cue = cue;
		this.moving = false;
		this.selected = false;
		this.resizeSide = 0;

		// For undo/redo
		this.initialStart = 0;
		this.initialEnd = 0;

		// For mouse control
		this.startingPos = 0;
		this.startingLength = 0;
		
		this.shape = {};
		
		Object.defineProperties(this,{
			deleted: {
				set: function(d){
					d = !!d;
					if(d !== deleted){
						track.textTrack[d?'removeCue':'addCue'](this.cue);
						deleted = d;
					}
					return d;	
				},
				get: function(){ return deleted; },
				enumerable: true
			}
		});
	}

	function Placeholder(tl, track, x) {
		this.tl = tl;
		this.track = track;
		this.startx = x;
		this.endx = x;
		tl.emit("startcreate", tl.view.pixelToTime(x));
	}
	
	Timeline.TextTrack = TlTextTrack;
	
	(function(TProto){
	
		function recreateSeg(){
			this.deleted = false;
			this.visible && this.tl.renderTrack(this.track);
			this.tl.emit('create',this);
		}

		function deleteSeg(){
			var i, visible = this.visible,
				s_segs = this.tl.selectedSegments;
			this.deleted = true;
			this.selected = false;
			i = s_segs.indexOf(this);
			if(i !== -1){ s_segs.splice(i,1); }
			if(visible){ this.tl.renderTrack(this.track); }
			this.tl.emit('delete',this);
		}
		
		function remerge(segs,mseg,text){
			var tl = this.tl, that = this;
			segs.forEach(function(seg){ seg.deleted = true; });
			mseg.cue.text = text;
			mseg.cue.endTime = segs[segs.length-1].endTime;
			if(mseg.visible){ tl.renderTrack(this); }
			tl.emit('merge',mseg,segs);
		}
		
		function unmerge(segs,mseg,text,end){
			var tl = this.tl, that = this, visible = false;
			segs.forEach(function(seg){
				seg.deleted = false;
				visible |= seg.visible;
			});
			mseg.cue.text = text;
			mseg.cue.endTime = end;
			if(mseg.visible || visible){ tl.renderTrack(this); }
			tl.emit('unmerge',mseg,segs);
		}
		
		function merge(list){
			var that = this,
				tl = this.tl,
				ssegs = tl.selectedSegments,
				mseg, oldend, oldtext, newtext;
			
			list.sort(order);
			newtext = list.map(function(seg){ return seg.text; }).join('');
			
			mseg = list.shift();
			oldend = mseg.endTime;
			mseg.cue.endTime = list[list.length-1].endTime;
			oldtext = mseg.text;
			mseg.cue.text = newtext;
			
			list.forEach(function(seg){
				seg.deleted = true;
				seg.selected = false;
				ssegs.splice(ssegs.indexOf(seg),1);
			});
			
			tl.renderTrack(this);
			tl.cstack.push({
				file: this.textTrack.label,
				context: this,
				redo: remerge.bind(this,list,mseg,newtext),
				undo: unmerge.bind(this,list,mseg,oldtext,oldend)
			});
			tl.emit('merge',mseg,list);
		}
		
		function repaste(segs){
			var tl = this.tl, that = this, visible = false;
			segs.forEach(function(seg){
				seg.deleted = false;
				visible |= seg.visible;
			});
			if(visible){ tl.renderTrack(this); }
			tl.emit('paste',segs);
		}
		
		function unpaste(segs){
			var tl = this.tl, that = this, visible = false;
			segs.forEach(function(seg){
				visible |= seg.visible;
				seg.deleted = true;
			});
			if(visible){ tl.renderTrack(this); }
			tl.emit('unpaste',segs);
		}
		
		function reshift(selected,delta){
			var tl = this.tl;
			selected.forEach(function(seg){
				seg.startTime += delta;
				seg.endTime += delta;
			});
			tl.renderTrack(this);
			tl.emit('shift',selected,delta);
		}
		
		Object.defineProperties(TProto,{
			id: {
				get: function(){ return this.textTrack.label; },
				set: function(val){
					var tl = this.tl,
						oldid = this.textTrack.label;
					if(oldid == val){ return oldid; }
					if(tl.trackIndices.hasOwnProperty(val)){
						throw new Error("Track name already in use.");
					}
					tl.trackIndices[val] = tl.trackIndices[oldid];
					delete tl.trackIndices[oldid];
					tl.cstack.renameEvents(oldid,val);
					this.textTrack.label = val;
					tl.render();
					return val;
				},enumerable: true
			},
			language: {
				get: function(){ return this.textTrack.language; },
				set: function(val){ return this.textTrack.language = val; },
				enumerable: true
			},
			kind: {
				get: function(){ return this.textTrack.kind; },
				set: function(val){
					this.textTrack.kind = val;
					this.tl.render();
					return val;
				},
				enumerable: true
			}
		});

		TProto.cloneTimeCodes = function(kind,lang,name){
			var ntt = new TextTrack(kind,name,lang);
			ntt.cues.loadCues(this.textTrack.cues.map(function(cue){
				return new TextTrackCue(cue.startTime,cue.endTime,"");
			}));
			ntt.readyState = TextTrack.LOADED;
			ntt.mode = "showing";
			return new TlTextTrack(this.tl,ntt);
		};

		TProto.add = function(cue, select){
			var tl = this.tl, seg;

			if(!(cue instanceof TextTrackCue)){
				cue = new TextTrackCue(
					cue.startTime, cue.endTime,
					(typeof cue.text === 'string')?cue.text:""
				);
			}

			this.textTrack.addCue(cue);

			seg = new Segment(this, cue);
			this.segments.push(seg);
			this.segments.sort(order);

			// Save the action
			tl.cstack.push({
				file: this.textTrack.label,
				context: seg,
				undo: deleteSeg,
				redo: recreateSeg
			});

			tl.emit('create', seg);
			if(select){ seg.select(); }
			else if(seg.visible){ tl.renderTrack(this); }
			return seg;
		};

		TProto.getSegment = function(id){
			var i, segs = this.segments,
				len = segs.length;
			for(i=0;i<len;i++){
				if(segs[i].uid === id){ return segs[i]; }
			}
		};

		TProto.getCursor = function(pos) {
			if(typeof pos !== 'object') return;
			var seg;

			if(this.locked){ return 'locked'; }
			if(this.tl.currentTool === Timeline.CREATE){ return 'add'; }
			
			seg = this.segFromPos(pos);
			return seg?seg.getCursor(pos):'pointer';
		};
		
		TProto.mergeSelected = function(){
			var that = this,
				selected = this.tl.selectedSegments.filter(function(seg){return seg.track === that;});
			if(selected.length === 0){ return; }
			merge.call(this,selected);
		};

		TProto.copySelected = function(){
			var that = this,
				tl = this.tl,
				copy = tl.selectedSegments.filter(function(seg){return seg.track === that;});
			if(copy.length > 0){ tl.toCopy = copy; }
		};
		
		TProto.paste = function(toCopy){
			var added, tl = this.tl,
				that = this,
				textTrack = this.textTrack,
				segments = this.segments,
				visible = false;
			
			added = toCopy.map(function(seg){
				var cue = seg.cue,
					ncue = new TextTrackCue(cue.startTime,cue.endTime,cue.text),
					nseg = new Segment(that, ncue);
				ncue.vertical = cue.vertical;
				ncue.align = cue.align;
				ncue.line = cue.line;
				ncue.size = cue.size;
				ncue.position = cue.position;
				
				textTrack.addCue(ncue);
				segments.push(nseg);
				visible |= nseg.visible;
				
				return nseg;
			});
			
			segments.sort(order);
			if(visible){ tl.renderTrack(this); }
			
			tl.cstack.push({
				file: this.textTrack.label,
				context: this,
				redo: repaste.bind(this,added),
				undo: unpaste.bind(this,added)
			});
			tl.emit('paste',added);
		};
		
		TProto.render = function(){
			var segs,
				tl = this.tl,
				ctx = tl.ctx,
				selected = [];

			ctx.save();

			ctx.translate(0,tl.getTrackTop(this));

			ctx.fillStyle = ctx.createPattern(tl.images.trackBg, "repeat-x");
			ctx.fillRect(0, 0, tl.width, tl.trackHeight);

			ctx.textBaseline = 'middle';
			ctx.font = tl.fonts.titleFont;
			ctx.fillStyle = tl.fonts.titleTextColor;
			ctx.fillText(this.id, tl.width/100, tl.trackHeight/2);

			ctx.restore();
			
			segs = this.segments.filter(function(seg){return seg.visible;});
			this.visibleSegments = segs;
			segs.forEach(function(seg){
				if(seg.selected){ selected.push(seg); }
				else{ seg.render(); }
			});
			selected.forEach(function(seg){ seg.render(); });
			this.placeholder && this.placeholder.render();
		};

		TProto.serialize = function(type){
			return TimedText.serializeTrack(type, this.textTrack);
		};
		
		TProto.segFromPos = function(pos){
			var j, seg, 
				segs = this.visibleSegments,
				selected = segs.filter(function(seg){ return seg.selected; });
			//search backwards 'cause later segments are on top
			for(j=selected.length-1;seg=selected[j];j--) {
				if(seg.containsPoint(pos)){ return seg; }
			}
			for(j=segs.length-1;seg=segs[j];j--) {
				if(!seg.selected && seg.containsPoint(pos)){ return seg; }
			}
			return null;
		};
		
		TProto.mouseDown = function(pos){
			if(typeof pos !== 'object' || this.locked){ return; }
			var tl = this.tl, seg, selected;
			if(tl.currentTool === Timeline.CREATE){
				this.placeholder = tl.activeElement = new Placeholder(tl, this, pos.x);
			}else if(tl.currentTool === Timeline.SHIFT){
				selected = this.segments.filter(function(seg){ return seg.selected; });
				if(selected.length < 2){ selected = this.segments; }
				selected.forEach(function(seg){ seg.mouseDown(pos); });
			}else{
				seg = this.segFromPos(pos);
				if(seg !== null){
					tl.activeElement = seg;
					seg.mouseDown(pos);
				}
			}		
		};
		
		TProto.mouseMove = function(pos){
			if(typeof pos !== 'object' || this.locked){ return; }
			if(this.tl.currentTool === Timeline.SHIFT){
				this.segments.forEach(function(seg){ seg.mouseMove(pos); });
				this.render();
			}
		};
			
		TProto.mouseUp = function(pos){
			var selected, delta, tl = this.tl;
			if(typeof pos !== 'object' || this.locked){ return; }
			if(tl.currentTool === Timeline.SHIFT){
				selected = this.segments.filter(function(seg){ return seg.selected; });
				if(selected.length < 2){ selected = this.segments; }
				selected.forEach(function(seg){ seg.moving = false; });
				delta = selected[0].startTime - selected[0].initialStart;
				tl.cstack.push({
					file: this.textTrack.label,
					context: this,
					redo: reshift.bind(this,selected,delta),
					undo: reshift.bind(this,selected,-delta)
				});
				tl.emit('shift',selected,delta);
			}
		};
	}(TlTextTrack.prototype));
	
	(function(SProto){

		var getTextDirection;
			
		try { getTextDirection = global.Ayamel.utils.getTextDirection; }
		catch(e){
			if(!(e instanceof ReferenceError || e instanceof TypeError)){
				throw e;
			}
		}
		
		if(typeof getTextDirection !== 'function'){
			getTextDirection = (function(){
				//The current regexes do not include >16-bit characters
				var r_exp = /[\u05E0\u07E0\u05E1\u07E1\u05E2\u07E2\u05E3\u07E3\u05E4\u07E4\u05E5\u07E5\u05E6\u07E6\u05E7\u07E7\u05E8\u07E8\u05E9\u07E9\u05BE\u05C0\u05C3\u05C6\u05D0-\u05DF\u05EA\u05F0-\u05F4\u07C0-\u07DF\u07EA\u07F4\u07F5\u07FA\u200F\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFB4F]/,
					l_exp = /[\u00E0-\u00E9\u0E01-\u0E09\u0E10-\u0E19\u0E20-\u0E29\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E94-\u0E97\u0E99\u01E0\u1E00\u02E0\u03E0\u04E0\u4E00\u09E0\u01E1\u10E0\u1E01\u11E0\u12E0\u13E0\u14E0\u15E0\u16E0\u17E0\u02E1\u24E0\u28E0\u03E1\u30E0\u32E0\u33E0\u04E1\u0041-\u0049\u0050-\u0059\u0061-\u0069\u0070-\u0079\u09E1\u0100\u01E2\u10E1\u1E02\u100E0\u0101-\u0109\u0110\u11E1\u0111-\u0119\u0120\u12E1\u120E0\u0121\u121E0\u0122\u122E0\u0123-\u0129\u0130\u13E1\u0131-\u0139\u0140\u14E1\u0141-\u0149\u0150\u15E1\u0151-\u0159\u0160\u16E1\u0161-\u0169\u0170\u17E1\u0171-\u0179\u0180-\u0189\u0190-\u0199\u0200\u02E2\u0201-\u0209\u0210-\u0219\u0220-\u0229\u0230-\u0239\u0240\u24E1\u0241-\u0249\u0250-\u0259\u0260-\u0269\u0270-\u0279\u0280\u28E1\u0281-\u0289\u0290-\u0299\u03E2\u30E1\u32E1\u33E1\u0386\u0388\u0389\u0390-\u0399\u0400\u04E2\u0401-\u0409\u0410-\u0419\u0420-\u0429\u0430-\u0439\u0440-\u0449\u0450-\u0459\u0460-\u0469\u0470-\u0479\u0480-\u0482\u0490-\u0499\u0500-\u0509\u0510-\u0513\u0531-\u0539\u0540-\u0549\u0550-\u0556\u0559\u0561-\u0569\u0570-\u0579\u0580-\u0587\u0589\u0903-\u0909\u0910-\u0919\u0920-\u0929\u0930-\u0939\u0940\u0949\u0950\u0958\u0959\u0960\u0961\u0964-\u0969\u0970\u0982\u0983\u0985-\u0989\u0990\u0993-\u0999\u01E3\u1000\u10E2\u1E03\u100E1\u1001-\u1009\u1010-\u1019\u1020\u1021\u1023-\u1027\u1029\u1031\u1038\u1040-\u1049\u1050-\u1057\u1100\u11E2\u1101-\u1109\u1110-\u1119\u1120-\u1129\u1130-\u1139\u1140-\u1149\u1150-\u1159\u1160-\u1169\u1170-\u1179\u1180-\u1189\u1190-\u1199\u1200\u12E2\u120E1\u1201-\u1209\u1210\u121E1\u1211-\u1219\u1220\u122E1\u1221-\u1229\u1230-\u1239\u1240-\u1248\u1250-\u1256\u1258\u1260-\u1269\u1270-\u1279\u1280-\u1288\u1290-\u1299\u1300\u13E2\u1301-\u1309\u1310\u1312-\u1315\u1318\u1319\u1320-\u1329\u1330-\u1339\u1340-\u1349\u1350-\u1359\u1360-\u1369\u1370-\u1379\u1380-\u1389\u14E2\u1401-\u1409\u1410-\u1419\u1420-\u1429\u1430-\u1439\u1440-\u1449\u1450-\u1459\u1460-\u1469\u1470-\u1479\u1480-\u1489\u1490-\u1499\u1500\u15E2\u1501-\u1509\u1510-\u1519\u1520-\u1529\u1530-\u1539\u1540-\u1549\u1550-\u1559\u1560-\u1569\u1570-\u1579\u1580-\u1589\u1590-\u1599\u1600\u16E2\u1601-\u1609\u1610-\u1619\u1620-\u1629\u1630-\u1639\u1640-\u1649\u1650-\u1659\u1660-\u1669\u1670-\u1676\u1681-\u1689\u1690-\u1699\u1700\u17E2\u1701-\u1709\u1710\u1711\u1720-\u1729\u1730\u1731\u1735\u1736\u1740-\u1749\u1750\u1751\u1760-\u1769\u1770\u1780-\u1789\u1790-\u1799\u1810-\u1819\u1820-\u1829\u1830-\u1839\u1840-\u1849\u1850-\u1859\u1860-\u1869\u1870-\u1877\u1880-\u1889\u1890-\u1899\u1900-\u1909\u1910-\u1919\u1923-\u1926\u1930\u1931\u1933-\u1938\u1946-\u1949\u1950-\u1959\u1960-\u1969\u1970-\u1974\u1980-\u1989\u1990-\u1999\u02E3\u2071\u2090-\u2094\u2102\u2107\u2110-\u2113\u2115\u2119\u2124\u2126\u2128\u2130-\u2139\u2145-\u2149\u2160-\u2169\u2170-\u2179\u2180-\u2184\u2336-\u2339\u2340-\u2349\u2350-\u2359\u2360-\u2369\u2370-\u2379\u2395\u24E2\u2800\u28E2\u2801-\u2809\u2810-\u2819\u2820-\u2829\u2830-\u2839\u2840-\u2849\u2850-\u2859\u2860-\u2869\u2870-\u2879\u2880-\u2889\u2890-\u2899\u03E3\u30E2\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038\u3039\u3041-\u3049\u3050-\u3059\u3060-\u3069\u3070-\u3079\u3080-\u3089\u3090-\u3096\u3105-\u3109\u3110-\u3119\u3120-\u3129\u3131-\u3139\u3140-\u3149\u3150-\u3159\u3160-\u3169\u3170-\u3179\u3180-\u3189\u3190-\u3199\u3200\u32E2\u3201-\u3209\u3210-\u3219\u3220-\u3229\u3230-\u3239\u3240-\u3243\u3260-\u3269\u3270-\u3279\u3280-\u3289\u3290-\u3299\u3300\u33E2\u3301-\u3309\u3310-\u3319\u3320-\u3329\u3330-\u3339\u3340-\u3349\u3350-\u3359\u3360-\u3369\u3370-\u3376\u3380-\u3389\u3390-\u3399\u3400\u04E3\u01E4\u10E3\u1E04\u10000\u100E2\u10001-\u10009\u10010-\u10019\u10020-\u10026\u10028\u10029\u10030-\u10039\u10040-\u10049\u10050-\u10059\u10080-\u10089\u10090-\u10099\u10100\u10102\u10107-\u10109\u10110-\u10119\u10120-\u10129\u10130-\u10133\u10137-\u10139\u10300-\u10309\u10310-\u10319\u10320-\u10323\u10330-\u10339\u10340-\u10349\u10380-\u10389\u10390-\u10399\u10400-\u10409\u10410-\u10419\u10420-\u10429\u10430-\u10439\u10440-\u10449\u10450-\u10459\u10460-\u10469\u10470-\u10479\u10480-\u10489\u10490-\u10499\u11E3\u12E3\u12000\u120E2\u12001-\u12009\u12010-\u12019\u12020-\u12029\u12030-\u12039\u12040-\u12049\u12050-\u12059\u12060-\u12069\u12070-\u12079\u12080-\u12089\u12090-\u12099\u12100\u121E2\u12101-\u12109\u12110-\u12119\u12120-\u12129\u12130-\u12139\u12140-\u12149\u12150-\u12159\u12160-\u12169\u12170-\u12179\u12180-\u12189\u12190-\u12199\u12200\u122E2\u12201-\u12209\u12210-\u12219\u12220-\u12229\u12230-\u12239\u12240-\u12249\u12250-\u12259\u12260-\u12269\u12270-\u12279\u12280-\u12289\u12290-\u12299\u12300-\u12309\u12310-\u12319\u12320-\u12329\u12330-\u12339\u12340-\u12349\u12350-\u12359\u12360-\u12369\u12400-\u12409\u12410-\u12419\u12420-\u12429\u12430-\u12439\u12440-\u12449\u12450-\u12459\u12460-\u12462\u12470-\u12473\u13E3\u14E3\u15E3\u16E3\u17E3\u02E4\u20000\u24E3\u28E3\u03E4\u30E3\u32E3\u33E3\u04E4\u1FEB\u01E5\u10E4\u1E05\u100E3\u11E4\u12E4\u120E3\u121E3\u122E3\u13E4\u14E4\u15E4\u16E4\u17E4\u24E4\u28E4\u03E5\u30E4\u32E4\u33E4\u04E5\u01E6\u10E5\u1E06\u100E4\u11E5\u12E5\u120E4\u121E4\u122E4\u13E5\u14E5\u15E5\u16E5\u17E5\u24E5\u28E5\u03E6\u30E5\u32E5\u33E5\u04E6\u09E6\u01E7\u10E6\u1E07\u100E5\u11E6\u12E6\u120E5\u121E5\u122E5\u13E6\u14E6\u15E6\u16E6\u17E6\u24E6\u28E6\u03E7\u30E6\u32E6\u33E6\u04E7\u09E7\u01E8\u10E7\u1E08\u100E6\u11E7\u12E7\u120E6\u121E6\u122E6\u13E7\u14E7\u15E7\u16E7\u17E7\u24E7\u28E7\u03E8\u30E7\u32E7\u33E7\u04E8\u09E8\u01E9\u10E8\u1E09\u100E7\u11E8\u12E8\u120E7\u121E7\u122E7\u13E8\u14E8\u15E8\u16E8\u17E8\u24E8\u28E8\u03E9\u30E8\u32E8\u33E8\u04E9\u09E9\u10E9\u1E10\u100E8\u11E9\u12E9\u120E8\u121E8\u122E8\u13E9\u14E9\u15E9\u16E9\u17E9\u24E9\u28E9\u30E9\u32E9\u33E9\u1E11\u100E9\u120E9\u121E9\u122E9\u1E12-\u1E19\u1E20-\u1E29\u1E30-\u1E39\u1E40-\u1E49\u1E50-\u1E59\u1E60-\u1E69\u1E70-\u1E79\u1E80-\u1E89\u1E90-\u1E99\u004A-\u004F\u005A\u006A-\u006F\u007A\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00DF\u00EA-\u00F6\u00F8-\u00FF\u010A-\u010F\u011A-\u011F\u012A-\u012F\u013A-\u013F\u014A-\u014F\u015A-\u015F\u016A-\u016F\u017A-\u017F\u018A-\u018F\u019A-\u01DF\u01EA-\u01FF\u020A-\u020F\u021A-\u021F\u022A-\u022F\u023A-\u023F\u024A-\u024F\u025A-\u025F\u026A-\u026F\u027A-\u027F\u028A-\u028F\u029A-\u02B8\u02BB-\u02C1\u02D0\u02D1\u02EE\u037A-\u037D\u038A\u038C\u038E\u038F\u039A-\u03A1\u03A3-\u03CE\u03D0-\u03DF\u03EA-\u03F5\u03F7-\u03FF\u040A-\u040F\u041A-\u041F\u042A-\u042F\u043A-\u043F\u044A-\u044F\u045A-\u045F\u046A-\u046F\u047A-\u047F\u048A-\u048F\u049A-\u04DF\u04EA-\u04FF\u050A-\u050F\u053A-\u053F\u054A-\u054F\u055A-\u055F\u056A-\u056F\u057A-\u057F\u090A-\u090F\u091A-\u091F\u092A-\u092F\u093D-\u093F\u094A-\u094C\u095A-\u095F\u096A-\u096F\u097B-\u097F\u098A-\u098C\u098F\u099A-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD-\u09C0\u09C7\u09C8\u09CB\u09CC\u09CE\u09D7\u09DC\u09DD\u09DF\u09EA-\u09F1\u09F4-\u09FA\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3E-\u0A40\u0A59-\u0A5C\u0A5E\u0A66-\u0A6F\u0A72-\u0A74\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD-\u0AC0\u0AC9\u0ACB\u0ACC\u0AD0\u0AE0\u0AE1\u0AE6-\u0AEF\u0B02\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B3E\u0B40\u0B47\u0B48\u0B4B\u0B4C\u0B57\u0B5C\u0B5D\u0B5F-\u0B61\u0B66-\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE\u0BBF\u0BC1\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCC\u0BD7\u0BE6-\u0BF2\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C41-\u0C44\u0C60\u0C61\u0C66-\u0C6F\u0C82\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD-\u0CC4\u0CC6-\u0CC8\u0CCA\u0CCB\u0CD5\u0CD6\u0CDE\u0CE0\u0CE1\u0CE6-\u0CEF\u0D02\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D28\u0D2A-\u0D39\u0D3E-\u0D40\u0D46-\u0D48\u0D4A-\u0D4C\u0D57\u0D60\u0D61\u0D66-\u0D6F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCF-\u0DD1\u0DD8-\u0DDF\u0DF2-\u0DF4\u0E0A-\u0E0F\u0E1A-\u0E1F\u0E2A-\u0E2F\u0E4F\u0E5A\u0E5B\u0E8A\u0E8D\u0E9A-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0ED0-\u0ED9\u0EDC\u0EDD\u0F00-\u0F17\u0F1A-\u0F34\u0F36\u0F38\u0F3E-\u0F47\u0F49-\u0F6A\u0F7F\u0F85\u0F88-\u0F8B\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCF-\u0FD1\u1000A\u1000B\u1000D-\u1000F\u1001A-\u1001F\u1002A-\u1002F\u1003A\u1003C\u1003D\u1003F\u1004A-\u1004D\u1005A-\u1005D\u1008A-\u1008F\u1009A-\u1009F\u100A\u100A0-\u100AF\u100B\u100B0-\u100BF\u100C\u100C0-\u100CF\u100D\u100D0-\u100DF\u100E\u100EA-\u100EF\u100F\u100F0-\u100FA\u1010A-\u1010F\u1011A-\u1011F\u1012A-\u1012F\u1013A-\u1013F\u101A-\u101F\u102A\u102C\u1030A-\u1030F\u1031A-\u1031E\u1033A-\u1033F\u1034A\u1038A-\u1038F\u1039A-\u1039D\u1039F-\u103C3\u103C8-\u103D5\u1040A-\u1040F\u1041A-\u1041F\u1042A-\u1042F\u1043A-\u1043F\u1044A-\u1044F\u1045A-\u1045F\u1046A-\u1046F\u1047A-\u1047F\u1048A-\u1048F\u1049A-\u1049D\u104A\u104A0-\u104A9\u104B-\u104F\u10A0-\u10C5\u10D0-\u10DF\u10EA-\u10FC\u110A-\u110F\u111A-\u111F\u112A-\u112F\u113A-\u113F\u114A-\u114F\u115F\u116A-\u116F\u117A-\u117F\u118A-\u118F\u119A-\u11A2\u11A8-\u11DF\u11EA-\u11F9\u1200A-\u1200F\u1201A-\u1201F\u1202A-\u1202F\u1203A-\u1203F\u1204A-\u1204F\u1205A-\u1205F\u1206A-\u1206F\u1207A-\u1207F\u1208A-\u1208F\u1209A-\u1209F\u120A\u120A0-\u120AF\u120B\u120B0-\u120BF\u120C\u120C0-\u120CF\u120D\u120D0-\u120DF\u120E\u120EA-\u120EF\u120F\u120F0-\u120FF\u1210A-\u1210F\u1211A-\u1211F\u1212A-\u1212F\u1213A-\u1213F\u1214A-\u1214F\u1215A-\u1215F\u1216A-\u1216F\u1217A-\u1217F\u1218A-\u1218F\u1219A-\u1219F\u121A\u121A0-\u121AF\u121B\u121B0-\u121BF\u121C\u121C0-\u121CF\u121D\u121D0-\u121DF\u121E\u121EA-\u121EF\u121F\u121F0-\u121FF\u1220A-\u1220F\u1221A-\u1221F\u1222A-\u1222F\u1223A-\u1223F\u1224A-\u1224F\u1225A-\u1225F\u1226A-\u1226F\u1227A-\u1227F\u1228A-\u1228F\u1229A-\u1229F\u122A\u122A0-\u122AF\u122B\u122B0-\u122BF\u122C\u122C0-\u122CF\u122D\u122D0-\u122DF\u122E\u122EA-\u122EF\u122F\u122F0-\u122FF\u1230A-\u1230F\u1231A-\u1231F\u1232A-\u1232F\u1233A-\u1233F\u1234A-\u1234F\u1235A-\u1235F\u1236A-\u1236E\u123A-\u123F\u1240A-\u1240F\u1241A-\u1241F\u1242A-\u1242F\u1243A-\u1243F\u1244A-\u1244F\u1245A-\u1245F\u124A-\u124D\u125A-\u125D\u126A-\u126F\u127A-\u127F\u128A-\u128D\u129A-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u12DF\u12EA-\u12FF\u130A-\u130F\u131A-\u131F\u132A-\u132F\u133A-\u133F\u134A-\u134F\u135A\u136A-\u136F\u137A-\u137C\u138A-\u138F\u13A0-\u13DF\u13EA-\u13F4\u140A-\u140F\u141A-\u141F\u142A-\u142F\u143A-\u143F\u144A-\u144F\u145A-\u145F\u146A-\u146F\u147A-\u147F\u148A-\u148F\u149A-\u14DF\u14EA-\u14FF\u150A-\u150F\u151A-\u151F\u152A-\u152F\u153A-\u153F\u154A-\u154F\u155A-\u155F\u156A-\u156F\u157A-\u157F\u158A-\u158F\u159A-\u15DF\u15EA-\u15FF\u160A-\u160F\u161A-\u161F\u162A-\u162F\u163A-\u163F\u164A-\u164F\u165A-\u165F\u166A-\u166F\u168A-\u168F\u169A\u16A0-\u16DF\u16EA-\u16F0\u170A-\u170C\u170E\u170F\u172A-\u172F\u174A-\u174F\u176A-\u176C\u176E\u176F\u178A-\u178F\u179A-\u17B6\u17BE-\u17C5\u17C7\u17C8\u17D4-\u17DA\u17DC\u182A-\u182F\u183A-\u183F\u184A-\u184F\u185A-\u185F\u186A-\u186F\u188A-\u188F\u189A-\u18A8\u190A-\u190F\u191A-\u191C\u194A-\u194F\u195A-\u195F\u196A-\u196D\u198A-\u198F\u199A-\u19A9\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A16\u1A19-\u1A1B\u1A1E\u1A1F\u1B04-\u1B33\u1B35\u1B3B\u1B3D-\u1B41\u1B43-\u1B4B\u1B50-\u1B6A\u1B74-\u1B7C\u1D00\u1D000-\u1D00F\u1D01\u1D010-\u1D01F\u1D02\u1D020-\u1D02F\u1D03\u1D030-\u1D03F\u1D04\u1D040-\u1D04F\u1D05\u1D050-\u1D05F\u1D06\u1D060-\u1D06F\u1D07\u1D070-\u1D07F\u1D08\u1D080-\u1D08F\u1D09\u1D090-\u1D09F\u1D0A\u1D0A0-\u1D0AF\u1D0B\u1D0B0-\u1D0BF\u1D0C\u1D0C0-\u1D0CF\u1D0D\u1D0D0-\u1D0DF\u1D0E\u1D0E0-\u1D0EF\u1D0F\u1D0F0-\u1D0F5\u1D10\u1D100-\u1D10F\u1D11\u1D110-\u1D11F\u1D12\u1D120-\u1D126\u1D12A-\u1D12F\u1D13\u1D130-\u1D13F\u1D14\u1D140-\u1D14F\u1D15\u1D150-\u1D15F\u1D16\u1D160-\u1D166\u1D16A-\u1D16F\u1D17\u1D170-\u1D172\u1D18\u1D183\u1D184\u1D18C-\u1D18F\u1D19\u1D190-\u1D19F\u1D1A\u1D1A0-\u1D1A9\u1D1AE\u1D1AF\u1D1B\u1D1B0-\u1D1BF\u1D1C\u1D1C0-\u1D1CF\u1D1D\u1D1D0-\u1D1DD\u1D1E-\u1D36\u1D360-\u1D36F\u1D37\u1D370\u1D371\u1D38-\u1D40\u1D400-\u1D40F\u1D41\u1D410-\u1D41F\u1D42\u1D420-\u1D42F\u1D43\u1D430-\u1D43F\u1D44\u1D440-\u1D44F\u1D45\u1D450-\u1D454\u1D456-\u1D45F\u1D46\u1D460-\u1D46F\u1D47\u1D470-\u1D47F\u1D48\u1D480-\u1D48F\u1D49\u1D490-\u1D49C\u1D49E\u1D49F\u1D4A\u1D4A2\u1D4A5\u1D4A6\u1D4A9-\u1D4AC\u1D4AE\u1D4AF\u1D4B\u1D4B0-\u1D4B9\u1D4BB\u1D4BD-\u1D4BF\u1D4C\u1D4C0-\u1D4C3\u1D4C5-\u1D4CF\u1D4D\u1D4D0-\u1D4DF\u1D4E\u1D4E0-\u1D4EF\u1D4F\u1D4F0-\u1D4FF\u1D50\u1D500-\u1D505\u1D507-\u1D50A\u1D50D-\u1D50F\u1D51\u1D510-\u1D514\u1D516-\u1D51C\u1D51E\u1D51F\u1D52\u1D520-\u1D52F\u1D53\u1D530-\u1D539\u1D53B-\u1D53E\u1D54\u1D540-\u1D544\u1D546\u1D54A-\u1D54F\u1D55\u1D550\u1D552-\u1D55F\u1D56\u1D560-\u1D56F\u1D57\u1D570-\u1D57F\u1D58\u1D580-\u1D58F\u1D59\u1D590-\u1D59F\u1D5A\u1D5A0-\u1D5AF\u1D5B\u1D5B0-\u1D5BF\u1D5C\u1D5C0-\u1D5CF\u1D5D\u1D5D0-\u1D5DF\u1D5E\u1D5E0-\u1D5EF\u1D5F\u1D5F0-\u1D5FF\u1D60\u1D600-\u1D60F\u1D61\u1D610-\u1D61F\u1D62\u1D620-\u1D62F\u1D63\u1D630-\u1D63F\u1D64\u1D640-\u1D64F\u1D65\u1D650-\u1D65F\u1D66\u1D660-\u1D66F\u1D67\u1D670-\u1D67F\u1D68\u1D680-\u1D68F\u1D69\u1D690-\u1D69F\u1D6A\u1D6A0-\u1D6A5\u1D6A8-\u1D6AF\u1D6B\u1D6B0-\u1D6BF\u1D6C\u1D6C0-\u1D6CF\u1D6D\u1D6D0-\u1D6DF\u1D6E\u1D6E0-\u1D6EF\u1D6F\u1D6F0-\u1D6FF\u1D70\u1D700-\u1D70F\u1D71\u1D710-\u1D71F\u1D72\u1D720-\u1D72F\u1D73\u1D730-\u1D73F\u1D74\u1D740-\u1D74F\u1D75\u1D750-\u1D75F\u1D76\u1D760-\u1D76F\u1D77\u1D770-\u1D77F\u1D78\u1D780-\u1D78F\u1D79\u1D790-\u1D79F\u1D7A\u1D7A0-\u1D7AF\u1D7B\u1D7B0-\u1D7BF\u1D7C\u1D7C0-\u1D7CB\u1D7D-\u1DBF\u1E0A-\u1E0F\u1E1A-\u1E1F\u1E2A-\u1E2F\u1E3A-\u1E3F\u1E4A-\u1E4F\u1E5A-\u1E5F\u1E6A-\u1E6F\u1E7A-\u1E7F\u1E8A-\u1E8F\u1E9A\u1E9B\u1EA0-\u1EF9\u1F00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEA\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200E\u207F\u210A-\u210F\u211A-\u211D\u212A-\u212D\u212F\u213C-\u213F\u214E\u216A-\u216F\u217A-\u217F\u233A-\u233F\u234A-\u234F\u235A-\u235F\u236A-\u236F\u237A\u249C-\u24DF\u26AC\u280A-\u280F\u281A-\u281F\u282A-\u282F\u283A-\u283F\u284A-\u284F\u285A-\u285F\u286A-\u286F\u287A-\u287F\u288A-\u288F\u289A-\u28DF\u28EA-\u28FF\u2A6D6\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2C6C\u2C74-\u2C77\u2C80-\u2CE4\u2D00-\u2D25\u2D30-\u2D65\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2F800-\u2FA1D\u303A-\u303C\u304A-\u304F\u305A-\u305F\u306A-\u306F\u307A-\u307F\u308A-\u308F\u309D-\u309F\u30A1-\u30DF\u30EA-\u30FA\u30FC-\u30FF\u310A-\u310F\u311A-\u311F\u312A-\u312C\u313A-\u313F\u314A-\u314F\u315A-\u315F\u316A-\u316F\u317A-\u317F\u318A-\u318E\u319A-\u31B7\u31F0-\u31FF\u320A-\u320F\u321A-\u321C\u322A-\u322F\u323A-\u323F\u326A-\u326F\u327A\u327B\u327F\u328A-\u328F\u329A-\u32B0\u32C0-\u32CB\u32D0-\u32DF\u32EA-\u32FE\u330A-\u330F\u331A-\u331F\u332A-\u332F\u333A-\u333F\u334A-\u334F\u335A-\u335F\u336A-\u336F\u337B-\u337F\u338A-\u338F\u339A-\u33DD\u33EA-\u33FE\u4DB5\u9FBB\uA000-\uA48C\uA800\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA824\uA827\uA840-\uA873\uAC00\uD7A3\uD800\uDB7F\uDB80\uDBFF\uDC00\uDFFF\uE000\uF8FF-\uFA2D\uFA30-\uFA6A\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/,
					al_exp = /[\u0600-\u0603\u0621-\u0629\u0630-\u0639\u0640-\u0649\u0671-\u0679\u0680-\u0689\u0690-\u0699\u0700-\u0709\u0710\u0712-\u0719\u0720-\u0729\u0750-\u0759\u0760-\u0769\u0780-\u0789\u0790-\u0799\uFEB0-\uFEB9\u06E5\u06E6\u060B\u060D\u061B\u061E\u061F\u062A-\u062F\u063A\u064A\u066D-\u066F\u067A-\u067F\u068A-\u068F\u069A-\u06D5\u06DD\u06EE\u06EF\u06FA-\u06FF\u070A-\u070D\u071A-\u071F\u072A-\u072F\u074D-\u074F\u075A-\u075F\u076A-\u076D\u078A-\u078F\u079A-\u07A5\u07B1\uFB50-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFC\uFE70-\uFE74\uFE76-\uFEAF\uFEBA-\uFEFC]/;
				return function(text){
					var k, i = text.search(r_exp);
					if(i < 0){
						i = text.search(al_exp);
						if(i < 0){ return 'ltr'; }
					}else{
						k = text.substring(0,i).search(al_exp);
						if(k >= 0){ i = k; }
					}
					return text.substring(0,i).search(l_exp) >= 0 ? 'ltr' : 'rtl';
				};
			}());
		}
	
		function textChangeGenerator(text){
			return function(){
				this.cue.text = text;
				this.tl.renderTrack(this.track);
				this.tl.emit('textchange',this);
			};
		}

		function idChangeGenerator(id){
			return function(){
				this.cue.id = id;
				this.tl.renderTrack(this.track);
				this.tl.emit('idchange',this);
			};
		}
		
		function moveGenerator(start,end){
			return function(){
				this.startTime = start;
				this.endTime = end;
				this.track.textTrack.activeCues.refreshCues();
				if(this.visible){ this.tl.renderTrack(this.track); }
				this.tl.emit("move",this);
			};
		}
		
		function resplitSeg(s1,s2,stime){
			var tl = this.tl;
				
			s2.deleted = false;
			s1.cue.endTime = stime;

			if(s1.visible || s2.visible){ tl.renderTrack(this); }
			tl.emit('split',s1,s2);
		}
		
		function unsplitSeg(s1,s2){
			var i, tl = this.tl,
				s_segs = tl.selectedSegments;
			
			s2.deleted = true;

			i = s_segs.indexOf(s2);
			if(i !== -1){ s_segs.splice(i,1); }
			
			s1.cue.endTime = s2.cue.endTime;

			if(s1.visible){ this.tl.renderTrack(this); }
			this.tl.emit('merge',s1,s2);	
		}

		Object.defineProperties(SProto,{
			selectable: { get: function(){ return !this.track.locked; }, enumerable: true },
			active: {
				get: function(){
					var mark = this.tl.timeMarkerPos;
					return mark > this.cue.startTime && mark < this.cue.endTime;
				},enumerable: true
			},
			visible: {
				get: function(){
					var cue = this.cue,
						view = this.tl.view;
					return !this.deleted && cue.startTime < view.endTime && cue.endTime > view.startTime;
				}, enumerable: true
			},
			uid: { get: function(){ return this.cue.uid; }, enumerable: true },
			id: {
				set: function(id){
					var tl = this.tl,
						cue = this.cue;
					if(cue.id === id){ return id; }
					tl.cstack.push({
						file: this.track.textTrack.label,
						context:this,
						undo: idChangeGenerator(cue.id),
						redo: idChangeGenerator(id)
					});
					cue.id = id;
					tl.renderTrack(this.track);
					tl.emit('idchange',this);
					return id;
				},
				get: function(){return this.cue.id;},
				enumerable: true
			},
			startTime: {
				set: function(t){return this.cue.startTime = t;},
				get: function(){return this.cue.startTime;},
				enumerable: true
			},
			endTime: {
				set: function(t){return this.cue.endTime = t;},
				get: function(){return this.cue.endTime;},
				enumerable: true
			},
			text: {
				set: function(t){
					var tl = this.tl,
						cue = this.cue;
					if(cue.text == t){ return t; }
					tl.cstack.push({
						file: this.track.textTrack.label,
						context:this,
						undo: textChangeGenerator(cue.text),
						redo: textChangeGenerator(t)
					});
					cue.text = t;
					tl.renderTrack(this.track);
					tl.emit('textchange',this);
					return t;
				},
				get: function(){return this.cue.text;},
				enumerable: true
			}
		});

		SProto.getCursor = function(pos){
			if(typeof pos !== 'object')	return;
			switch(this.tl.currentTool){
				case Timeline.SELECT: return 'select';
				case Timeline.DELETE: return 'remove';
				case Timeline.SPLIT: return 'split';
				case Timeline.MOVE:
					return (function(i){
						return	i === 1?'resizeR':
								i === -1?'resizeL':
								'move';
					}(this.getMouseSide(pos)));
				default: return 'pointer';
			}
		};
		
		SProto.select = function(){
			var id, tl = this.tl,
				trackmap = {};
			if(this.selected){ return; }
			this.selected = true;
			if(this.visible){ trackmap[this.track.id] = this.track; }
			if(!tl.multi){
				tl.selectedSegments.forEach(function(seg){
					seg.selected = false;
					if(seg.visible){ trackmap[seg.track.id] = seg.track; }
					tl.emit('unselect',seg);
				});
				tl.selectedSegments = [this];
			}else{
				tl.selectedSegments.push(this);
			}
			for(id in trackmap){
				tl.renderTrack(trackmap[id]);
			}
			tl.emit('select',this);
		};

		SProto.unselect = function(){
			if(!this.selected){ return; }
			var tl = this.tl;
			this.selected = false;
			tl.selectedSegments.splice(tl.selectedSegments.indexOf(this),1);
			if(this.visible){ tl.renderTrack(this.track); }
			tl.emit('unselect', this);
		};
		
		SProto.copy = function(){ this.tl.toCopy = [this]; };
		
		SProto.del = function(){
			var i, tl = this.tl,
				visible = this.visible,
				s_segs = tl.selectedSegments;
				
			this.deleted = true;

			i = s_segs.indexOf(this);
			if(i !== -1){ s_segs.splice(i,1); }

			// Save the delete
			tl.cstack.push({
				file: this.track.textTrack.label,
				context: this,
				redo: deleteSeg,
				undo: recreateSeg
			});
			if(visible){ tl.renderTrack(this.track); }
			tl.emit('delete',this);
		};
		
		SProto.split = function(pos){
			var cp, seg,
				tl = this.tl,
				stime = tl.view.pixelToTime(pos.x),
				track = this.track,
				cue = this.cue;
				
			cp = new TextTrackCue(stime+.001, cue.endTime, cue.text);		
			cp.snapToLines = cue.snapToLines;
			cp.pauseOnExit = cue.pauseOnExit;
			
			cue.endTime = stime;
			
			track.textTrack.addCue(cp);
			seg = new Segment(track, cp);
			track.segments.push(seg);
			track.segments.sort(order);
			
			// Save the split
			tl.cstack.push({
				file: track.textTrack.label,
				redo: resplitSeg.bind(track,this,seg,stime),
				undo: unsplitSeg.bind(track,this,seg)
			});
			tl.renderTrack(track);
			tl.emit('split',this,seg);
		};
		
		SProto.mergeWithSelected = function(pos){
			var track = this.track,
				selected = this.tl.selectedSegments.filter(function(seg){return seg.track === track;});
			if(selected.length === 0){ return; }
			if(selected.indexOf(this) === -1){ selected.push(this); }
			merge.call(this.track, selected);
		};
		
		SProto.serialize = function(type){
			return this.deleted?"":TimedText.serializeCue(type, this.cue);
		};

		function handleWidths(seg, images){
			return seg.selected?{
				left:images.segmentLeftSel.width,
				right:images.segmentRightSel.width
			}:seg.selectable?{
				left:images.segmentLeft.width,
				right:images.segmentRight.width
			}:{
				left:images.segmentLeftDark.width,
				right:images.segmentRightDark.width
			};
		}
		
		// Location computation
		SProto.calcShape = function() {
			var x, tl = this.tl,
				shape = this.shape,
				xl = tl.view.timeToPixel(this.startTime),
				xr = tl.view.timeToPixel(this.endTime),
				mid = (xl+xr)/2,
				hwidth = handleWidths(this, tl.images);
			
			x = Math.min(xl,mid-hwidth.left-1);
			return (this.shape = {
				x: x,
				y: tl.getTrackTop(this.track),
				width: Math.max(xr,mid+hwidth.right+1) - x,
				height: tl.trackHeight
			});
		};

		SProto.containsPoint = function(pos) {
			var s = this.shape;
			return (pos.x >= s.x && pos.x <= s.x + s.width && pos.y >= s.y && pos.y <= s.y + s.height);
		};

		SProto.getMouseSide = function(pos) {
			var x, tl = this.tl,
				images = tl.images,
				shape = this.shape,
				hwidth = handleWidths(this, tl.images);
				
			x = pos.x - shape.x;
			return	(x < hwidth.left)?-1:
					(x > shape.width - hwidth.right)?1:
					0;
		};

		// Event handlers
		SProto.mouseDown = function(pos) {
			var tl = this.tl;
			if(this.deleted || !this.selectable)
				return;

			this.startingPos = this.tl.view.timeToPixel(this.startTime);
			this.startingLength = this.endTime - this.startTime;

			tl.activeElement = this;
			
			switch(tl.currentTool){
				case Timeline.MOVE:
					this.resizeSide = this.getMouseSide(pos);
					this.moving = true;
					this.initialStart = this.startTime;
					this.initialEnd = this.endTime;
					break;
				case Timeline.SHIFT:
					this.moving = true;
					this.initialStart = this.startTime;
					this.initialEnd = this.endTime;
					break;
				case Timeline.SPLIT:
					this.split(pos);
					break;
			}
		};
		
		SProto.move = function(start,end){
			var redo = moveGenerator(start,end);
			this.tl.cstack.push({
				context: this,
				file: this.track.textTrack.label,
				undo: moveGenerator(this.startTime,this.endTime),
				redo: redo
			});
			redo.call(this);
		};
		
		SProto.mouseUp = function(pos) {
			var tl = this.tl, track;
			if(this.deleted || !this.selectable || this !== tl.activeElement)
				return;
			switch(tl.currentTool) {
				case Timeline.SELECT:
					track = tl.trackFromPos(pos);
					if(track === this.track && track.segFromPos(pos) === this){
						if(this.selected){ this.unselect(); }
						else{ this.select(); }
					}else if(track){
						track.paste([this]);
					}
					break;
				case Timeline.MOVE:
					this.moving = false;
					track = this.track;
					track.segments.sort(order);
					track.textTrack.activeCues.refreshCues();
					track.render();
					// Save the move
					tl.cstack.push({
						context: this,
						file: track.textTrack.label,
						redo: moveGenerator(this.startTime,this.endTime),
						undo: moveGenerator(this.initialStart,this.initialEnd)
					});
					tl.emit("move",this);
					break;
				case Timeline.DELETE:
					this.del();
					break;
			}
		};

		SProto.mouseMove = function(pos) {
			var tl = this.tl,
				activeStart = this.active,
				newTime, maxStartTime;

			if(this.deleted || !this.selectable || !this.moving || this !== this.tl.activeElement){ return; }
			
			newTime = tl.view.pixelToTime(this.startingPos + pos.x - tl.mouseDownPos.x);
			
			if(tl.currentTool === Timeline.SHIFT){
				maxStartTime = tl.length - this.startingLength;
				if(newTime < 0){ newTime = 0; }
				else if(newTime > maxStartTime){ newTime = maxStartTime; }
				this.startTime = newTime;
				this.endTime = newTime + this.startingLength;
				tl.emit('move',this);
			}else if(tl.currentTool === Timeline.MOVE){
				switch(this.resizeSide){
					case 0:
						maxStartTime = tl.length - this.startingLength;
						if(newTime < 0){ newTime = 0; }
						else if(newTime > maxStartTime){ newTime = maxStartTime; }
						this.startTime = newTime;
						this.endTime = newTime + this.startingLength;
						tl.emit('move',this);
						break;
					case -1:
						if(newTime < 0){ newTime = 0; }
						else if(newTime >= this.endTime){ newTime = this.endTime - .001; }
						this.startTime = newTime;
						tl.emit('resizel',this);
						break;
					case 1:
						newTime += this.startingLength;
						if(newTime <= this.startTime){ newTime = this.startTime + .001; }
						else if(newTime > tl.length){ newTime = tl.length; }
						this.endTime = newTime;
						tl.emit('resizer',this);
						break;
					default:
						throw new Error("Invalid State");
				}
				tl.renderTrack(this.track);
			}else{
				//handle visual indication of copy-in-progress here
			}
			if(activeStart != this.active){
				this.track.textTrack.activeCues.refreshCues();
			}
		};

		// Rendering

		function renderImage(shape, imageLeft, imageRight, imageMid) {
			var ctx = this.tl.ctx;
			ctx.drawImage(imageLeft, 0, 0, imageLeft.width, shape.height);
			ctx.drawImage(imageRight, shape.width - imageRight.width, 0, imageRight.width, shape.height);
			if(shape.width > imageRight.width + imageLeft.width){
				ctx.fillStyle = ctx.createPattern(imageMid, "repeat-x");
				ctx.fillRect(imageLeft.width - 1, 0, shape.width - (imageRight.width + imageLeft.width) + 1, shape.height);
			}
		}
		
		SProto.render = function() {
			if(this.deleted)
				return;

			var tl = this.tl,
				images = tl.images,
				fonts = tl.fonts,
				ctx = tl.ctx,
				shape = this.calcShape(),
				x = shape.x,
				y = shape.y,
				direction, dir, text;

			// is it on the screen
			if(x > -shape.width && x < tl.width) {
				dir = tl.cache.dir;
				ctx.save();
				ctx.translate(x, y);

				renderImage.apply(this, (this.selected)?[
											shape,
											images.segmentLeftSel, images.segmentRightSel, images.segmentMidSel
										]:(!this.selectable)?[
											shape,
											images.segmentLeftDark, images.segmentRightDark, images.segmentMidDark
										]:[
											shape,
											images.segmentLeft, images.segmentRight, images.segmentMid
										]);

				if(shape.width > 2*tl.segmentTextPadding){
					// Set the clipping bounds
					ctx.beginPath();
					ctx.moveTo(tl.segmentTextPadding, 0);
					ctx.lineTo(tl.segmentTextPadding, shape.height);
					ctx.lineTo(shape.width - tl.segmentTextPadding, shape.height);
					ctx.lineTo(shape.width - tl.segmentTextPadding, 0);
					ctx.closePath();
					ctx.clip();

					ctx.textBaseline = 'top';

					if(this.id){
						direction = getTextDirection(this.id+"");
						tl.cache.dir = direction;

						ctx.font = fonts.idFont;
						ctx.fillStyle = fonts.idTextColor;
						ctx.fillText(this.id, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, 0);
						y = Math.max(fonts.idFontSize,tl.segmentTextPadding);
					}else{
						y = tl.segmentTextPadding;
					}

					text = TimedText.textPreviewers[this.track.kind](this.text);
					direction = getTextDirection(text);
					tl.cache.dir = direction;

					ctx.font = fonts.segmentFont;
					ctx.fillStyle = fonts.segmentTextColor;
					ctx.fillText(text, direction === 'ltr' ? tl.segmentTextPadding : shape.width - tl.segmentTextPadding, y);
				}
				ctx.restore();
				tl.cache.dir = dir;
			}
		};
	}(Segment.prototype));

	(function(PProto){
		
		PProto.render = function() {
			var tl = this.tl,
				ctx = tl.ctx,
				top = tl.getTrackTop(this.track);
			ctx.save();
			ctx.fillStyle = tl.colors.placeholder;
			ctx.globalAlpha = .5;
			ctx.fillRect(this.startx, top, this.endx - this.startx, tl.trackHeight);
			ctx.restore();
		};

		PProto.mouseMove = function(pos) {
			var tl = this.tl;
			this.endx = pos.x;
			tl.emit("endcreate", tl.view.pixelToTime(pos.x));
			tl.renderTrack(this.track);
		};

		PProto.mouseUp = function(pos) {
			var view = this.tl.view,
				startx, endx;

			this.track.placeholder = null;
			if(this.startx === pos.x){ return; }
			if(this.startx < pos.x){
				startx = this.startx;
				endx = pos.x;
			}else{
				startx = pos.x;
				endx = this.startx;
			}
			this.track.add({
				startTime: view.pixelToTime(startx),
				endTime: view.pixelToTime(endx)
			}, this.tl.autoSelect);
		};
	}(Placeholder.prototype));
	
}(Timeline,window));