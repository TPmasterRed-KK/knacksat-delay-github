(function(){

var el = function(id){ return document.getElementById(id); };

// ---------- STATE ----------
var tleData = { generatedAt:null, satellites:{} };
var currentNoradId = null;

// ---------- PRESETS ----------
var STATIONS = { kmutnb: {lat:13.8203, lon:100.5133} };
var TARGETS  = { paris:  {lat:48.8566, lon:2.3522} };

// =====================================================================
// LOAD data/tle.json (static file, committed by the GitHub Actions
// workflow) — same-origin on GitHub Pages, so no CORS setup is needed.
// =====================================================================
function loadTleData(){
  var status = el('tleMeta');
  status.innerHTML = '<span class="live-dot" id="liveDot"></span>กำลังโหลดข้อมูล…';
  return fetch('data/tle.json?t=' + Date.now(), {cache:'no-store'})
    .then(function(r){
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data){
      tleData = data || {generatedAt:null, satellites:{}};
      rebuildSatSelect();
    })
    .catch(function(err){
      console.error(err);
      status.innerHTML = '<span class="live-dot"></span>โหลด data/tle.json ไม่สำเร็จ — ตรวจสอบว่าไฟล์อยู่ถูกที่ และ GitHub Actions รันสำเร็จแล้ว';
    });
}

function rebuildSatSelect(){
  var sel = el('satSelect');
  var prev = sel.value;
  sel.innerHTML = '';
  var ids = Object.keys(tleData.satellites || {});
  if (ids.length === 0){
    el('tleMeta').innerHTML = '<span class="live-dot"></span>ยังไม่มีข้อมูล TLE — รอ GitHub Actions รันรอบแรก หรือกด "Run workflow" ในแท็บ Actions';
    el('satName').value = '—';
    el('tle1').value = '';
    el('tle2').value = '';
    return;
  }
  ids.forEach(function(id){
    var sat = tleData.satellites[id];
    var opt = document.createElement('option');
    opt.value = id;
    var tag = (sat.tags||[]).includes('primary') ? ' ★ หลัก' : '';
    opt.textContent = (sat.name || ('NORAD '+id)) + ' · #' + id + tag;
    sel.appendChild(opt);
  });
  var wanted = prev && tleData.satellites[prev] ? prev
    : (ids.find(function(id){ return (tleData.satellites[id].tags||[]).includes('primary'); }) || ids[0]);
  sel.value = wanted;
  selectSatellite(wanted);
}

function selectSatellite(noradId){
  currentNoradId = noradId;
  var sat = tleData.satellites[noradId];
  if (!sat){
    el('satName').value = '—';
    el('tle1').value = '';
    el('tle2').value = '';
    return;
  }
  el('satName').value = sat.name || ('NORAD '+noradId);
  el('tle1').value = sat.line1 || '';
  el('tle2').value = sat.line2 || '';

  var srcClass = sat.source === 'celestrak' ? 'celestrak' : 'satnogs';
  var fetchedTxt = sat.fetchedAt ? fmtShort(new Date(sat.fetchedAt)) : '—';
  var genTxt = tleData.generatedAt ? fmtShort(new Date(tleData.generatedAt)) : '—';
  el('tleMeta').innerHTML =
    '<span class="live-dot on"></span>ดึงเมื่อ <b>' + fetchedTxt + '</b>' +
    '<span class="src-badge ' + srcClass + '">' + (sat.source||'?').toUpperCase() + '</span>' +
    '<span style="margin-left:8px;color:var(--text-faint);">อัปเดตชุดข้อมูลล่าสุด: ' + genTxt + '</span>';
}

el('satSelect').addEventListener('change', function(){ selectSatellite(this.value); });
el('refreshBtn').addEventListener('click', function(){
  var btn = this;
  btn.disabled = true;
  var prevText = btn.textContent;
  btn.textContent = 'กำลังโหลด…';
  loadTleData().finally(function(){
    btn.textContent = prevText;
    btn.disabled = false;
  });
});

function fmtShort(d){
  return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())+
    ' ('+pad(d.getMonth()+1)+'/'+pad(d.getDate())+')';
}

// =====================================================================
// MAP SETUP
// =====================================================================
var map = L.map('map', {worldCopyJump:true}).setView([25,40], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png', {
  attribution:'&copy; OpenStreetMap &copy; CARTO',
  subdomains:'abcd', maxZoom:19
}).addTo(map);

function iconFor(color){
  return L.divIcon({
    className:'',
    html:'<div style="width:14px;height:14px;border-radius:50%;background:'+color+';border:2px solid #0A0E14;box-shadow:0 0 8px '+color+';"></div>',
    iconSize:[14,14], iconAnchor:[7,7]
  });
}
var stationIcon = iconFor('#4FD8E8');
var targetIcon = iconFor('#F2A93B');
var hitIcon = iconFor('#6EE7B7');

var stationMarker = L.marker([13.8203,100.5133], {icon:stationIcon, draggable:true}).addTo(map).bindTooltip('สถานีภาคพื้น');
var targetMarker = L.marker([48.8566,2.3522], {icon:targetIcon, draggable:true}).addTo(map).bindTooltip('เป้าหมาย');
var hitMarker = null;
var trackLayers = [];
var pinMode = null;

el('pinStationBtn').addEventListener('click', function(){
  pinMode = (pinMode==='station') ? null : 'station';
  el('pinStationBtn').classList.toggle('active', pinMode==='station');
  el('pinTargetBtn').classList.remove('active');
});
el('pinTargetBtn').addEventListener('click', function(){
  pinMode = (pinMode==='target') ? null : 'target';
  el('pinTargetBtn').classList.toggle('active', pinMode==='target');
  el('pinStationBtn').classList.remove('active');
});
map.on('click', function(e){
  if (pinMode==='station'){
    setStation(e.latlng.lat, e.latlng.lng);
    el('stationPreset').value = 'custom';
  } else if (pinMode==='target'){
    setTarget(e.latlng.lat, e.latlng.lng);
    el('targetPreset').value = 'custom';
  }
});
stationMarker.on('dragend', function(){
  var p = stationMarker.getLatLng();
  el('stationLat').value = p.lat.toFixed(4);
  el('stationLon').value = p.lng.toFixed(4);
  el('stationPreset').value = 'custom';
});
targetMarker.on('dragend', function(){
  var p = targetMarker.getLatLng();
  el('targetLat').value = p.lat.toFixed(4);
  el('targetLon').value = p.lng.toFixed(4);
  el('targetPreset').value = 'custom';
});
function setStation(lat, lon){
  el('stationLat').value = lat.toFixed(4);
  el('stationLon').value = lon.toFixed(4);
  stationMarker.setLatLng([lat,lon]);
}
function setTarget(lat, lon){
  el('targetLat').value = lat.toFixed(4);
  el('targetLon').value = lon.toFixed(4);
  targetMarker.setLatLng([lat,lon]);
}
el('stationPreset').addEventListener('change', function(){
  var v = this.value;
  if (STATIONS[v]) setStation(STATIONS[v].lat, STATIONS[v].lon);
});
el('targetPreset').addEventListener('change', function(){
  var v = this.value;
  if (TARGETS[v]) setTarget(TARGETS[v].lat, TARGETS[v].lon);
});
['stationLat','stationLon'].forEach(function(id){
  el(id).addEventListener('change', function(){
    stationMarker.setLatLng([parseFloat(el('stationLat').value)||0, parseFloat(el('stationLon').value)||0]);
  });
});
['targetLat','targetLon'].forEach(function(id){
  el(id).addEventListener('change', function(){
    targetMarker.setLatLng([parseFloat(el('targetLat').value)||0, parseFloat(el('targetLon').value)||0]);
  });
});

(function(){
  var now = new Date();
  now.setSeconds(0,0);
  var tzOff = now.getTimezoneOffset()*60000;
  var local = new Date(now.getTime()-tzOff);
  el('searchStart').value = local.toISOString().slice(0,16);
})();

// =====================================================================
// HELPERS
// =====================================================================
function haversineKm(lat1,lon1,lat2,lon2){
  var R=6371;
  var dLat=(lat2-lat1)*Math.PI/180;
  var dLon=(lon2-lon1)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*
    Math.sin(dLon/2)*Math.sin(dLon/2);
  var c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return R*c;
}
function pad(n){ return n<10 ? '0'+n : ''+n; }
function fmtHMS(totalSec){
  var sign = totalSec<0 ? '-' : '';
  totalSec = Math.abs(totalSec);
  var h = Math.floor(totalSec/3600);
  var m = Math.floor((totalSec%3600)/60);
  var s = Math.floor(totalSec%60);
  return sign+pad(h)+':'+pad(m)+':'+pad(s);
}
function fmtUTC(d){
  return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())+' '+
    pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds())+' UTC';
}
function fmtICT(d){
  var ict = new Date(d.getTime()+7*3600000);
  return ict.getUTCFullYear()+'-'+pad(ict.getUTCMonth()+1)+'-'+pad(ict.getUTCDate())+' '+
    pad(ict.getUTCHours())+':'+pad(ict.getUTCMinutes())+':'+pad(ict.getUTCSeconds())+' ICT';
}
function jdToDate(jd){ return new Date((jd-2440587.5)*86400000); }
function wrapLon(lon){ return ((lon+540)%360)-180; }

function clearMapLayers(){
  trackLayers.forEach(function(l){ map.removeLayer(l); });
  trackLayers = [];
  if (hitMarker){ map.removeLayer(hitMarker); hitMarker=null; }
}
function drawTrack(points, color, weight, dash){
  var seg = [];
  for (var i=0;i<points.length;i++){
    if (i>0 && Math.abs(points[i][1]-points[i-1][1])>180){
      if (seg.length>1){
        trackLayers.push(L.polyline(seg, {color:color, weight:weight, opacity:0.85, dashArray:dash}).addTo(map));
      }
      seg = [];
    }
    seg.push(points[i]);
  }
  if (seg.length>1){
    trackLayers.push(L.polyline(seg, {color:color, weight:weight, opacity:0.85, dashArray:dash}).addTo(map));
  }
}
function showError(msg){
  var ro = el('readout');
  ro.classList.remove('idle');
  ro.classList.add('err');
  ro.innerHTML = '<div class="err-msg">⚠ '+msg+'</div>';
}
function resetReadoutShell(){
  el('readout').className = 'readout idle';
  el('readout').innerHTML =
    '<div class="ro-main"><div class="lbl">ค่า Delay ที่ต้องตั้งเข้าระบบ</div>'+
    '<div class="ro-big" id="roDelayHMS">— — : — — : — —</div>'+
    '<div class="ro-sub" id="roDelaySec">รอผลการคำนวณ</div></div>'+
    '<div class="ro-col"><div class="lbl">ส่งคำสั่ง (Uplink) เมื่อ</div>'+
    '<div class="ro-val" id="roSendTime">—<small>—</small></div></div>'+
    '<div class="ro-col"><div class="lbl">ถึงเป้าหมายจริง</div>'+
    '<div class="ro-val" id="roTargetTime">—<small>—</small></div>'+
    '<span class="ro-badge" id="roBadge" style="display:none;"></span></div>';
}

// =====================================================================
// MAIN COMPUTE
// =====================================================================
el('computeBtn').addEventListener('click', function(){
  var btn = el('computeBtn');
  var status = el('computeStatus');
  btn.disabled = true;
  status.textContent = 'กำลังคำนวณวงโคจร…';
  resetReadoutShell();
  clearMapLayers();
  el('epochWarn').style.display = 'none';

  setTimeout(function(){
    try{
      runCompute();
      status.textContent = 'คำนวณเสร็จสิ้น';
    }catch(e){
      console.error(e);
      showError(e.message || 'เกิดข้อผิดพลาดในการคำนวณ');
      status.textContent = 'พบข้อผิดพลาด';
    }
    btn.disabled = false;
  }, 30);
});

function runCompute(){
  if (typeof satellite === 'undefined'){
    throw new Error('ไลบรารี satellite.js โหลดไม่สำเร็จ — โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');
  }
  var sat = currentNoradId ? tleData.satellites[currentNoradId] : null;
  if (!sat || !sat.line1 || !sat.line2){
    throw new Error('ยังไม่มี TLE สำหรับดาวเทียมนี้ — รอ GitHub Actions ดึงข้อมูล หรือกด "โหลดข้อมูลล่าสุด"');
  }
  var tle1 = sat.line1.trim();
  var tle2 = sat.line2.trim();

  var satrec = satellite.twoline2satrec(tle1, tle2);
  if (satrec.error && satrec.error !== 0){
    throw new Error('TLE ไม่ถูกต้อง (error code '+satrec.error+')');
  }

  var stationLat = parseFloat(el('stationLat').value);
  var stationLon = parseFloat(el('stationLon').value);
  var targetLat = parseFloat(el('targetLat').value);
  var targetLon = parseFloat(el('targetLon').value);
  var minElevDeg = parseFloat(el('minElev').value) || 10;
  var windowDays = parseFloat(el('windowDays').value) || 3;
  var sendChoice = el('sendChoice').value;

  if ([stationLat,stationLon,targetLat,targetLon].some(function(v){return isNaN(v);})){
    throw new Error('พิกัดสถานีหรือเป้าหมายไม่ถูกต้อง');
  }

  var startInput = el('searchStart').value;
  var startDate = startInput ? new Date(startInput) : new Date();

  var stationGd = {
    latitude: satellite.degreesToRadians(stationLat),
    longitude: satellite.degreesToRadians(stationLon),
    height: 0.05
  };

  var totalSeconds = windowDays*86400;
  var maxSteps = 20000;
  var coarseStep = Math.max(10, Math.floor(totalSeconds/maxSteps));

  var aos=null, tca=null, tcaElev=-999, los=null;
  var passTrack = [];

  for (var t=0; t<=totalSeconds; t+=coarseStep){
    var date = new Date(startDate.getTime()+t*1000);
    var pv = satellite.propagate(satrec, date);
    if (!pv.position) continue;
    var gmst = satellite.gstime(date);
    var ecf = satellite.eciToEcf(pv.position, gmst);
    var look = satellite.ecfToLookAngles(stationGd, ecf);
    var elevDeg = satellite.radiansToDegrees(look.elevation);

    if (elevDeg > minElevDeg){
      if (aos===null) aos = date;
      if (elevDeg > tcaElev){ tcaElev = elevDeg; tca = date; }
      var gd = satellite.eciToGeodetic(pv.position, gmst);
      passTrack.push([satellite.radiansToDegrees(gd.latitude), wrapLon(satellite.radiansToDegrees(gd.longitude))]);
    } else if (aos!==null){
      los = date;
      break;
    }
  }
  if (aos===null){
    throw new Error('ไม่พบรอบที่ดาวเทียมผ่านสถานีเกินมุมเงย '+minElevDeg+'° ภายใน '+windowDays+' วัน — ลองเพิ่มช่วงค้นหา หรือลดมุมเงยขั้นต่ำ');
  }
  if (los===null) los = new Date(startDate.getTime()+totalSeconds*1000);

  var t0 = sendChoice==='aos' ? aos : (sendChoice==='los' ? los : tca);

  var searchFrom = t0.getTime();
  var distSeries = [];
  for (var t2=0; t2<=totalSeconds; t2+=coarseStep){
    var date2 = new Date(searchFrom+t2*1000);
    var pv2 = satellite.propagate(satrec, date2);
    if (!pv2.position) continue;
    var gmst2 = satellite.gstime(date2);
    var gd2 = satellite.eciToGeodetic(pv2.position, gmst2);
    var lat2 = satellite.radiansToDegrees(gd2.latitude);
    var lon2 = wrapLon(satellite.radiansToDegrees(gd2.longitude));
    var dist = haversineKm(lat2, lon2, targetLat, targetLon);
    distSeries.push({t:t2, date:date2, dist:dist, lat:lat2, lon:lon2});
  }
  if (distSeries.length < 3){
    throw new Error('ช่วงค้นหาสั้นเกินไปสำหรับดาวเทียมดวงนี้ — โปรดเพิ่ม "ค้นหาไกลสุด (วัน)"');
  }

  var best = null;
  for (var i=1;i<distSeries.length-1;i++){
    if (distSeries[i].dist<=distSeries[i-1].dist && distSeries[i].dist<=distSeries[i+1].dist){
      best = distSeries[i];
      break;
    }
  }
  if (!best){
    best = distSeries.reduce(function(a,b){ return b.dist<a.dist ? b : a; });
  }

  var fineBest = best;
  for (var tf=Math.max(0,best.t-coarseStep); tf<=best.t+coarseStep; tf+=1){
    var df = new Date(searchFrom+tf*1000);
    var pvf = satellite.propagate(satrec, df);
    if (!pvf.position) continue;
    var gmstf = satellite.gstime(df);
    var gdf = satellite.eciToGeodetic(pvf.position, gmstf);
    var latf = satellite.radiansToDegrees(gdf.latitude);
    var lonf = wrapLon(satellite.radiansToDegrees(gdf.longitude));
    var distf = haversineKm(latf, lonf, targetLat, targetLon);
    if (distf < fineBest.dist) fineBest = {t:tf, date:df, dist:distf, lat:latf, lon:lonf};
  }

  var targetTime = fineBest.date;
  var delaySeconds = Math.round((targetTime.getTime()-t0.getTime())/1000);

  var epochDate = jdToDate(satrec.jdsatepoch + (satrec.jdsatepochF||0));
  var ageDays = (startDate.getTime()-epochDate.getTime())/86400000;

  renderResults({
    t0:t0, targetTime:targetTime, delaySeconds:delaySeconds,
    aos:aos, tca:tca, tcaElev:tcaElev, los:los,
    dist:fineBest.dist, epochDate:epochDate, ageDays:ageDays,
    source: sat.source
  });

  renderMap({
    station:{lat:stationLat,lon:stationLon}, target:{lat:targetLat,lon:targetLon},
    passTrack:passTrack,
    commandSegment: distSeries.filter(function(p){ return p.t<=fineBest.t; }).map(function(p){return [p.lat,p.lon];}),
    hit:{lat:fineBest.lat, lon:fineBest.lon}
  });
}

function renderResults(r){
  var ro = el('readout');
  ro.className = 'readout';
  el('roDelayHMS').textContent = fmtHMS(r.delaySeconds);
  el('roDelaySec').textContent = r.delaySeconds.toLocaleString('en-US')+' วินาที';
  el('roSendTime').innerHTML = fmtUTC(r.t0)+'<small>'+fmtICT(r.t0)+'</small>';
  el('roTargetTime').innerHTML = fmtUTC(r.targetTime)+'<small>'+fmtICT(r.targetTime)+'</small>';

  var badge = el('roBadge');
  badge.style.display = 'inline-block';
  if (r.dist < 50){
    badge.textContent = 'ผ่านตรงจุด ('+r.dist.toFixed(0)+' กม.)';
    badge.className = 'ro-badge badge-ok';
  } else if (r.dist < 600){
    badge.textContent = 'ใกล้เป้าหมาย ('+r.dist.toFixed(0)+' กม.) — ต้องเอียงกล้อง';
    badge.className = 'ro-badge badge-warn';
  } else {
    badge.textContent = 'ห่างเป้าหมาย ('+r.dist.toFixed(0)+' กม.)';
    badge.className = 'ro-badge badge-bad';
  }

  el('dAOS').textContent = fmtUTC(r.aos);
  el('dTCA').textContent = fmtUTC(r.tca);
  el('dMaxElev').textContent = r.tcaElev.toFixed(1)+'°';
  el('dLOS').textContent = fmtUTC(r.los);
  el('dDist').textContent = r.dist.toFixed(1)+' กม. จากจุดใต้ดาวเทียม (nadir)';
  el('dEpoch').textContent = fmtUTC(r.epochDate);
  el('dSource').textContent = (r.source || '—').toUpperCase();

  var warnEl = el('epochWarn');
  if (r.ageDays > 10){
    warnEl.style.display = 'block';
    warnEl.textContent = '⚠ TLE นี้มีอายุประมาณ '+r.ageDays.toFixed(1)+' วันจากเวลาที่เริ่มค้นหา — ความแม่นยำของตำแหน่งดาวเทียมจะลดลงตามอายุ TLE ตรวจสอบว่า GitHub Actions ยังรันสำเร็จอยู่';
  } else {
    warnEl.style.display = 'none';
  }
}

function renderMap(m){
  stationMarker.setLatLng([m.station.lat, m.station.lon]);
  targetMarker.setLatLng([m.target.lat, m.target.lon]);

  drawTrack(m.passTrack, '#3A4A5C', 3, null);
  drawTrack(m.commandSegment, '#6EE7B7', 3, '2,6');

  if (hitMarker) map.removeLayer(hitMarker);
  hitMarker = L.marker([m.hit.lat, m.hit.lon], {icon:hitIcon}).addTo(map)
    .bindTooltip('จุดที่ใกล้เป้าหมายที่สุด');
  trackLayers.push(hitMarker);

  var bounds = L.latLngBounds([
    [m.station.lat, m.station.lon],
    [m.target.lat, m.target.lon],
    [m.hit.lat, m.hit.lon]
  ]);
  if (m.passTrack.length) bounds.extend(m.passTrack);
  map.fitBounds(bounds, {padding:[40,40]});
}

// kick off
loadTleData();

})();
