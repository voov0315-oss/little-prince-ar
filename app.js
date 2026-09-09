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
let cameraStream = null;
let scanInterval = null;
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
  const toast = $('#toast'); 
  toast.textContent = message; 
  toast.classList.add('show');
  clearTimeout(showToast.timer); 
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2700);
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
  $('#zonePicker').innerHTML = zones.map((zone) => 
    `<button class="zone-button" data-zone="${zone.id}">Z${String(zone.id).padStart(2, '0')}</button>`
  ).join('');
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

function renderCertificate() { 
  $('#certCount').textContent = collected.length; 
}

// ----------------------------------------------------
// 카메라 프레임 분석기 (카드 대표 색상 및 특징 실시간 감지)
// ----------------------------------------------------
function analyzeFrame() {
  const video = $('#camera');
  if (!video || video.readyState !== 4) return;

  const canvas = $('#analysisCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = 64;
  canvas.height = 64;
  ctx.drawImage(video, 0, 0, 64, 64);

  const imgData = ctx.getImageData(16, 16, 32, 32).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < imgData.length; i += 4) {
    r += imgData[i];
    g += imgData[i+1];
    b += imgData[i+2];
    count++;
  }
  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);

  // 6개 마커 카드의 고유 색상 스펙트럼 판정
  let detectedZone = null;
  if (b > 110 && b > r * 1.2 && g < 110) {
    detectedZone = 1; // 1번 짙은 밤하늘 남색
  } else if (r > 130 && r > g * 1.3 && r > b * 1.3) {
    detectedZone = 2; // 2번 장미 빨간색
  } else if (g > 105 && g > r && g > b) {
    detectedZone = 3; // 3번 바오밥 녹색
  } else if (r > 140 && g > 100 && b < 90) {
    detectedZone = 4; // 4번 여우 황토색/주황색
  } else if (g > 100 && b > 100 && r < 90) {
    detectedZone = 5; // 5번 거북이 청록/에메랄드
  } else if (r > 80 && b > 110 && g < 95) {
    detectedZone = 6; // 6번 마지막 별 보라색
  }

  if (detectedZone) {
    showToast(`ZONE 0${detectedZone} 보물 마커를 인식했어요!`);
    soundEffect('collect');
    stopCamera();
    selectZone(detectedZone);
  }
}

// ----------------------------------------------------
// 카메라 관리 (재실행 시 멈춤 현상 완벽 방지)
// ----------------------------------------------------
async function openCamera() {
  stopCamera(); // 혹시 열려있는 이전 스트림 완전 해제

  if (!navigator.mediaDevices?.getUserMedia) { 
    showToast('카메라를 열 수 없어 하단 ZONE 버튼으로 대체합니다.'); 
    return; 
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }, 
      audio: false
    });
    
    const video = $('#camera'); 
    video.srcObject = cameraStream; 
    await video.play();

    video.style.display = 'block'; 
    $('#cameraPlaceholder').style.display = 'none';
    $('#openCamera').textContent = '마커 인식 중…'; 
    $('#openCamera').disabled = true; 
    $('#scanStatus').textContent = '마커 카드를 네모 박스 안에 맞춰주세요';

    // 초당 4회 실시간 마커 색상 분석
    scanInterval = setInterval(analyzeFrame, 250);

    // 마커가 흐릿할 경우를 위한 3.5초 타임아웃 자동 전환 (사용자 답답함 방지)
    openCamera.fallbackTimer = setTimeout(() => {
      if (cameraStream) {
        showToast('보물 마커를 인식했어요!');
        soundEffect('collect');
        stopCamera();
        selectZone(selectedZone.id || 1);
      }
    }, 3800);

  } catch (error) { 
    console.error(error);
    showToast('카메라 권한을 허용해 주세요. 아래 버튼으로도 선택할 수 있어요.'); 
    stopCamera();
  }
}

function stopCamera() { 
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  if (openCamera.fallbackTimer) {
    clearTimeout(openCamera.fallbackTimer);
    openCamera.fallbackTimer = null;
  }
  if (cameraStream) { 
    cameraStream.getTracks().forEach((track) => {
      track.stop();
      track.enabled = false;
    }); 
    cameraStream = null; 
  } 
  const video = $('#camera');
  if (video) {
    video.pause();
    video.srcObject = null;
    video.style.display = 'none';
  }
  $('#cameraPlaceholder').style.display = 'flex'; 
  $('#openCamera').textContent = '카메라 열기'; 
  $('#openCamera').disabled = false; 
}

// ----------------------------------------------------
// 오디오 & 인증서 저장
// ----------------------------------------------------
function soundEffect(type = 'collect') {
  if (!audioOn) return;
  audioCtx ||= new AudioContext();
  const now = audioCtx.currentTime;
  const notes = type === 'open' ? [523.25, 659.25, 783.99] : [659.25, 783.99, 1046.5];
  notes.forEach((frequency, index) => { 
    const osc = audioCtx.createOscillator(); 
    const gain = audioCtx.createGain(); 
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(frequency, now + index * .11); 
    gain.gain.setValueAtTime(.0001, now + index * .11); 
    gain.gain.exponentialRampToValueAtTime(.12, now + index * .11 + .02); 
    gain.gain.exponentialRampToValueAtTime(.0001, now + index * .11 + .45); 
    osc.connect(gain).connect(audioCtx.destination); 
    osc.start(now + index * .11); 
    osc.stop(now + index * .11 + .47); 
  });
}

function startBgm() {
  if (bgmTimer) return;
  const melody = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 349.23]; 
  let pos = 0;
  bgmTimer = setInterval(() => { 
    if (!audioOn) return; 
    audioCtx ||= new AudioContext(); 
    const osc = audioCtx.createOscillator(); 
    const gain = audioCtx.createGain(); 
    const now = audioCtx.currentTime; 
    osc.type = 'triangle'; 
    osc.frequency.value = melody[pos++ % melody.length]; 
    gain.gain.setValueAtTime(.0001, now); 
    gain.gain.exponentialRampToValueAtTime(.032, now + .05); 
    gain.gain.exponentialRampToValueAtTime(.0001, now + .68); 
    osc.connect(gain).connect(audioCtx.destination); 
    osc.start(); 
    osc.stop(now + .7); 
  }, 720);
}

function toggleSound() {
  audioOn = !audioOn;
  if (audioOn) { 
    audioCtx ||= new AudioContext(); 
    audioCtx.resume(); 
    startBgm(); 
    showToast('별빛 배경음악이 시작됐어요 ♬'); 
  } else { 
    showToast('배경음악을 껐어요'); 
  }
  $('#soundToggle').textContent = audioOn ? '♬ 배경음악 끄기' : '♬ 배경음악 켜기';
  $$('.music-mini').forEach((button) => { 
    button.textContent = audioOn ? '♬' : '♪'; 
    button.setAttribute('aria-label', audioOn ? '배경음악 끄기' : '배경음악 켜기'); 
  });
}

function saveCertificate() {
  const canvas = document.createElement('canvas'); 
  canvas.width = 1200; canvas.height = 1600; 
  const c = canvas.getContext('2d');
  c.fillStyle = '#fff8e7'; c.fillRect(0,0,1200,1600); 
  c.strokeStyle = '#d6ae53'; c.lineWidth = 12; c.strokeRect(52,52,1096,1496); 
  c.strokeStyle = '#f1d891'; c.lineWidth = 3; c.strokeRect(73,73,1054,1454);
  c.fillStyle = '#b27620'; c.textAlign = 'center'; c.font = 'bold 42px Georgia'; c.fillText('✦   ★   ✧',600,220); 
  c.font = 'bold 24px Arial'; c.fillText('GEOBUKSEOM AR TREASURE HUNT',600,295); 
  c.fillStyle='#173a61'; c.font='bold 76px serif'; c.fillText('보물찾기',600,465); 
  c.fillStyle='#bd8740'; c.fillText('완료 인증서',600,555); 
  c.fillStyle='#56646c'; c.font='38px Arial'; c.fillText(`어린왕자와 함께 거북섬의 보물 ${collected.length}개를 찾았어요!`,600,700); 
  c.fillStyle='#b27620'; c.font='bold 48px Arial'; c.fillText('✓  MISSION COMPLETE',600,900); 
  c.fillStyle='#806d4d'; c.font='30px Arial'; c.fillText('2026. 09. 12  ·  시흥 거북섬',600,1120); 
  c.fillStyle='#b27620'; c.font='44px Georgia'; c.fillText('✦',150,1360); c.fillText('✦',1050,1360); 
  c.font='27px Arial'; c.fillStyle='#536b72'; c.fillText('현장 직원에게 이 화면을 보여 주세요.',600,1440);
  
  const link = document.createElement('a'); 
  link.download = '거북섬-어린왕자-보물찾기-인증서.png'; 
  link.href = canvas.toDataURL('image/png'); 
  link.click(); 
  showToast('인증서 이미지가 저장됐어요!');
}

// ----------------------------------------------------
// 이벤트 연결
// ----------------------------------------------------
$('#startJourney').addEventListener('click', () => { go('scanner'); if (!audioOn) toggleSound(); });
$$('[data-go]').forEach((button) => button.addEventListener('click', () => go(button.dataset.go)));
$('#zonePicker').addEventListener('click', (event) => { 
  const target = event.target.closest('[data-zone]'); 
  if (target) selectZone(target.dataset.zone); 
});
$('#openCamera').addEventListener('click', openCamera);

// 보물상자 열기 클릭 시 비디오 재생 및 AR 화면 전환
$('#chest').addEventListener('click', () => $('#openTreasure').click());
$('#openTreasure').addEventListener('click', () => { 
  $('#chest').classList.add('chest-open'); 
  soundEffect('open'); 
  setTimeout(() => {
    go('ar');
    // 어린왕자 인사 영상 재생 로직
    const pVid = $('#princeVideo');
    if (pVid) {
      pVid.play().then(() => {
        pVid.style.display = 'block';
        if ($('#lpGraphic')) $('#lpGraphic').style.display = 'none'; // 비디오 재생 시 그래픽 숨김
      }).catch((e) => {
        console.log('영상 자동 재생 대기 또는 파일 미존재 (기본 애니메이션 유지)');
      });
    }
  }, 950); 
});

$('#collectStamp').addEventListener('click', () => { 
  if (!collected.includes(selectedZone.id)) { 
    collected.push(selectedZone.id); 
    localStorage.setItem('geobukseom-stamps', JSON.stringify(collected)); 
    soundEffect(); 
    showToast(`${selectedZone.stamp === 'star' ? '별빛' : '장미'} 스탬프를 받았어요!`); 
  } else {
    showToast('이 보물 스탬프는 이미 받았어요!'); 
  }
  setTimeout(() => go('stamps'), 350); 
});

$('#certificateButton').addEventListener('click', () => go('certificate'));
$('#saveCertificate').addEventListener('click', saveCertificate);
$('#soundToggle').addEventListener('click', toggleSound);
$$('.music-mini').forEach((button) => button.addEventListener('click', toggleSound));

renderPicker(); 
renderStamps();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
