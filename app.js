const zones = [
  {id:1, name:'별빛 안내자', stamp:'star', icon:'★', message:'별이 반짝이는 곳에는 언제나 길이 있어.', description:'밤하늘의 첫 번째 보물을 찾았어요!'},
  {id:2, name:'장미의 정원', stamp:'star', icon:'★', message:'네 장미를 특별하게 만든 건 네가 준 시간이야.', description:'향기로운 장미 정원의 보물을 찾았어요!'},
  {id:3, name:'바오밥 행성', stamp:'star', icon:'★', message:'작은 씨앗도 매일 돌보면 큰 힘이 된단다.', description:'커다란 바오밥 행성의 보물을 찾았어요!'},
  {id:4, name:'여우의 비밀', stamp:'rose', icon:'✿', message:'마음으로 보면 아주 잘 보인단다.', description:'소중한 여우의 비밀 보물을 찾았어요!'},
  {id:5, name:'거북이 행성', stamp:'rose', icon:'✿', message:'천천히 가도 함께라면 멋진 여행이야.', description:'느긋한 거북이 행성의 보물을 찾았어요!'},
  {id:6, name:'마지막 별', stamp:'rose', icon:'✿', message:'네가 바라보는 모든 별이 웃고 있을 거야.', description:'여행의 마지막 별빛 보물을 찾았어요!'}
];
let selectedZone = zones[0];
let collected = JSON.parse(localStorage.getItem('geobukseom-stamps') || '[]');
let cameraStream;
let audioOn = false;
let audioCtx;
let bgmTimer;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function go(id) {
  $$('.screen').forEach((screen) => screen.classList.toggle('is-active', screen.id === id));
  window.scrollTo({top: 0, behavior: 'instant'});
  if (id !== 'scanner') stopCamera();
  if (id === 'stamps') renderStamps();
  if (id === 'certificate') renderCertificate();
}

function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2700);
}

function selectZone(id) {
  selectedZone = zones.find((zone) => zone.id === Number(id)) || zones[0];
  $('#treasureZone').textContent = `ZONE ${String(selectedZone.id).padStart(2, '0')}`;
  $('#treasure-title').innerHTML = `${selectedZone.name}<br />보물을 찾았어요!`;
  $('#treasureDescription').textContent = selectedZone.description;
  $('#storyText').textContent = selectedZone.message;
  $('#arRose').style.display = selectedZone.stamp === 'rose' ? 'block' : 'none';
  $('#chest').classList.remove('chest-open');
  go('treasure');
}

function renderPicker() {
  $('#zonePicker').innerHTML = zones.map((zone) => `<button class="zone-button" data-zone="${zone.id}">Z${String(zone.id).padStart(2, '0')}</button>`).join('');
}

function renderStamps() {
  const slot = (zone) => `<span class="stamp-slot ${collected.includes(zone.id) ? 'earned' : ''}" title="${zone.name}">${collected.includes(zone.id) ? zone.icon : '·'}</span>`;
  $('#starStamps').innerHTML = zones.filter((zone) => zone.stamp === 'star').map(slot).join('');
  $('#roseStamps').innerHTML = zones.filter((zone) => zone.stamp === 'rose').map(slot).join('');
  const count = collected.length;
  $('#stampCount').textContent = count;
  $('#certCount').textContent = count;
  $('#progressBar').style.width = `${Math.min(count / 2, 1) * 100}%`;
  $('#progressMessage').textContent = count >= 2 ? '인증서가 열렸어요!' : `보물 ${2 - count}개만 더 찾으면 돼요!`;
  $('#certificateButton').disabled = count < 2;
}

function renderCertificate() { $('#certCount').textContent = collected.length; }

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { showToast('이 기기에서는 카메라를 열 수 없어요. 아래 ZONE 버튼을 눌러 진행해 주세요.'); return; }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
    const video = $('#camera'); video.srcObject = cameraStream; video.style.display = 'block'; $('#cameraPlaceholder').style.display = 'none';
    $('#openCamera').textContent = '마커 인식 중…'; $('#openCamera').disabled = true; $('#scanStatus').textContent = '마커 전체를 네모 안에 맞춰 주세요';
  } catch (error) { showToast('카메라 권한을 허용해 주세요. 아래 ZONE 선택으로도 체험할 수 있어요.'); }
}
function stopCamera() { if (cameraStream) { cameraStream.getTracks().forEach((track) => track.stop()); cameraStream = undefined; } $('#camera').style.display = 'none'; $('#cameraPlaceholder').style.display = 'flex'; $('#openCamera').textContent = '카메라 열기'; $('#openCamera').disabled = false; }

function soundEffect(type = 'collect') {
  if (!audioOn) return;
  audioCtx ||= new AudioContext();
  const now = audioCtx.currentTime;
  const notes = type === 'open' ? [523.25, 659.25, 783.99] : [659.25, 783.99, 1046.5];
  notes.forEach((frequency, index) => { const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, now + index * .11); gain.gain.setValueAtTime(.0001, now + index * .11); gain.gain.exponentialRampToValueAtTime(.12, now + index * .11 + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + index * .11 + .45); osc.connect(gain).connect(audioCtx.destination); osc.start(now + index * .11); osc.stop(now + index * .11 + .47); });
}
function startBgm() {
  if (bgmTimer) return;
  const melody = [261.63,329.63,392,523.25,392,329.63,293.66,349.23]; let pos = 0;
  bgmTimer = setInterval(() => { if (!audioOn) return; audioCtx ||= new AudioContext(); const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); const now = audioCtx.currentTime; osc.type = 'triangle'; osc.frequency.value = melody[pos++ % melody.length]; gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.032, now + .05); gain.gain.exponentialRampToValueAtTime(.0001, now + .68); osc.connect(gain).connect(audioCtx.destination); osc.start(); osc.stop(now + .7); }, 720);
}
function toggleSound() {
  audioOn = !audioOn;
  if (audioOn) { audioCtx ||= new AudioContext(); audioCtx.resume(); startBgm(); showToast('별빛 배경음악이 시작됐어요 ♬'); }
  else { showToast('배경음악을 껐어요'); }
  $('#soundToggle').textContent = audioOn ? '♬ 배경음악 끄기' : '♬ 배경음악 켜기';
  $$('.music-mini').forEach((button) => { button.textContent = audioOn ? '♬' : '♪'; button.setAttribute('aria-label', audioOn ? '배경음악 끄기' : '배경음악 켜기'); });
}

function saveCertificate() {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1600; const c = canvas.getContext('2d');
  c.fillStyle = '#fff8e7'; c.fillRect(0,0,1200,1600); c.strokeStyle = '#d6ae53'; c.lineWidth = 12; c.strokeRect(52,52,1096,1496); c.strokeStyle = '#f1d891'; c.lineWidth = 3; c.strokeRect(73,73,1054,1454);
  c.fillStyle = '#b27620'; c.textAlign = 'center'; c.font = 'bold 42px Georgia'; c.fillText('✦   ★   ✧',600,220); c.font = 'bold 24px Arial'; c.fillText('GEOBUKSEOM AR TREASURE HUNT',600,295); c.fillStyle='#173a61'; c.font='bold 76px serif'; c.fillText('보물찾기',600,465); c.fillStyle='#bd8740'; c.fillText('완료 인증서',600,555); c.fillStyle='#56646c'; c.font='38px Arial'; c.fillText(`어린왕자와 함께 거북섬의 보물 ${collected.length}개를 찾았어요!`,600,700); c.fillStyle='#b27620'; c.font='bold 48px Arial'; c.fillText('✓  MISSION COMPLETE',600,900); c.fillStyle='#806d4d'; c.font='30px Arial'; c.fillText('2026. 09. 12  ·  시흥 거북섬',600,1120); c.fillStyle='#b27620'; c.font='44px Georgia'; c.fillText('✦',150,1360); c.fillText('✦',1050,1360); c.font='27px Arial'; c.fillStyle='#536b72'; c.fillText('현장 직원에게 이 화면을 보여 주세요.',600,1440);
  const link = document.createElement('a'); link.download = '거북섬-어린왕자-보물찾기-인증서.png'; link.href = canvas.toDataURL('image/png'); link.click(); showToast('인증서 이미지가 저장됐어요!');
}

$('#startJourney').addEventListener('click', () => { go('scanner'); if (!audioOn) toggleSound(); });
$$('[data-go]').forEach((button) => button.addEventListener('click', () => go(button.dataset.go)));
$('#zonePicker').addEventListener('click', (event) => { const target = event.target.closest('[data-zone]'); if (target) selectZone(target.dataset.zone); });
$('#openCamera').addEventListener('click', openCamera);
$('#chest').addEventListener('click', () => $('#openTreasure').click());
$('#openTreasure').addEventListener('click', () => { $('#chest').classList.add('chest-open'); soundEffect('open'); setTimeout(() => go('ar'), 950); });
$('#collectStamp').addEventListener('click', () => { if (!collected.includes(selectedZone.id)) { collected.push(selectedZone.id); localStorage.setItem('geobukseom-stamps', JSON.stringify(collected)); soundEffect(); showToast(`${selectedZone.stamp === 'star' ? '별빛' : '장미'} 스탬프를 받았어요!`); } else showToast('이 보물 스탬프는 이미 받았어요!'); setTimeout(() => go('stamps'), 350); });
$('#certificateButton').addEventListener('click', () => go('certificate'));
$('#saveCertificate').addEventListener('click', saveCertificate);
$('#soundToggle').addEventListener('click', toggleSound);
$$('.music-mini').forEach((button) => button.addEventListener('click', toggleSound));
renderPicker(); renderStamps();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
