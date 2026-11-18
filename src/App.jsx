import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Nfc,
  PlusCircle,
  ShieldAlert,
  Syringe,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { db } from './firebase';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';

// 1호실(남성 4병상), 2호실(여성 4병상) 병동 데이터
const BEDS = [
  { id: '1-1', room: 1, bed: 1, gender: 'M', age: 68, patient: '김*수(10482910)', diagnosis: '폐렴 (Pneumonia)' },
  { id: '1-2', room: 1, bed: 2, gender: 'M', age: 54, patient: '이*호(10519283)', diagnosis: '급성 췌장염' },
  { id: '1-3', room: 1, bed: 3, gender: 'M', age: 72, patient: '박*진(10394812)', diagnosis: '위장관 출혈 의심' },
  { id: '1-4', room: 1, bed: 4, gender: 'M', age: 61, patient: '최*영(10628374)', diagnosis: '발작성 심실상성 빈맥(PSVT)' },
  { id: '2-1', room: 2, bed: 1, gender: 'F', age: 59, patient: '정*희(10411209)', diagnosis: '유방암 항암치료 후 호중구감소증' },
  { id: '2-2', room: 2, bed: 2, gender: 'F', age: 76, patient: '강*자(10293847)', diagnosis: '만성 신부전 / 빈혈' },
  { id: '2-3', room: 2, bed: 3, gender: 'F', age: 65, patient: '윤*숙(10583920)', diagnosis: '담낭염 수술 후 회복' },
  { id: '2-4', room: 2, bed: 4, gender: 'F', age: 52, patient: '조*미(10671234)', diagnosis: '혈소판 감소증' },
];

// 5종 고위험 약물 및 혈액제제 DB
const MEDICATIONS = [
  {
    id: 'metoclopramide',
    name: 'IV 맥페란 (Metoclopramide)',
    realMinutes: 5,
    demoSeconds: 5,
    sideEffects: [
      '추체외로 증상(EPS): 근긴장이상, 안구운동발작, 정좌불능 여부',
      '중추신경계: 급성 졸음, 어지러움, 불안감 발생 확인',
      '오심·구토 완화 효과 사정',
    ],
  },
  {
    id: 'vancomycin',
    name: 'IV 반코마이신 (Vancomycin)',
    realMinutes: 15,
    demoSeconds: 8,
    sideEffects: [
      '레드맨 증후군(Red Man Syndrome): 안면·목·상체 홍조 및 가려움증',
      '활력징후: 급격한 저혈압 발생 여부 (발생 시 주입 속도 감속)',
      '정맥염(Phlebitis) 및 주사 부위 발적·통증 확인',
    ],
  },
  {
    id: 'ffp',
    name: 'IV 신선동결혈장 (FFP)',
    realMinutes: 15,
    demoSeconds: 10,
    sideEffects: [
      '급성 수혈 부작용: 발열, 오한, 두드러기, 호흡곤란, 흉통/요통',
      '수혈 시작 후 15분 활력징후(V/S) 측정 및 수혈 전 수치와 비교',
      'TACO(수혈관련 순환과부하): 경정맥 팽창, 수포음 청진 여부',
    ],
  },
  {
    id: 'platelet',
    name: 'IV 혈소판 (Platelet Concentrate)',
    realMinutes: 15,
    demoSeconds: 10,
    sideEffects: [
      '발열성 비용혈성 수혈 반응(FNHTR) 및 알레르기(발진, 가려움)',
      '급성 패혈성 반응(고열, 오한, 저혈압) 집중 관찰',
      '출혈 경향(점상출혈, 잇몸출혈 등) 호전 여부 확인',
    ],
  },
  {
    id: 'adenosine',
    name: 'IV 아데노신 (Adenosine)',
    realMinutes: 1,
    demoSeconds: 3,
    sideEffects: [
      '일시적 무수축(Asystole) 및 심한 서맥, 방실차단 (EKG 리듬 확인)',
      '일과성 안면 홍조, 흉부 압박감, 호흡곤란 회복 여부',
      '동율동(Normal Sinus Rhythm) 전환 성공 여부 기록',
    ],
  },
];

function getTransitionColor(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  const hue = Math.round(142 * (1 - clamped));
  const sat = Math.round(72 + 12 * clamped);
  const light = Math.round(40 + 6 * Math.sin(clamped * Math.PI));
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export default function App() {
  const path = window.location.pathname;
  const [activeTimers, setActiveTimers] = useState({});

  // Firebase Firestore 실시간 구독 (모든 기기 실시간 동기화)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'med_timers'), (snapshot) => {
      const next = {};
      snapshot.forEach((docSnap) => {
        next[docSnap.id] = docSnap.data();
      });
      setActiveTimers(next);
    });
    return () => unsub();
  }, []);

  // 경로 라우팅:
  // 1) /bed/1-3 -> 침상 앞 NFC 스티커 스캔 시 열리는 간호사 모바일 사정 화면
  if (path.startsWith('/bed/')) {
    const bedId = path.replace('/bed/', '');
    return <MobileNfcView bedId={bedId} timer={activeTimers[bedId]} />;
  }

  // 2) /emr -> 원격 EMR 투약 신호 발신기 (노트북 등에서 투약 전송용)
  if (path === '/emr') {
    return <RemoteEmrView activeTimers={activeTimers} />;
  }

  // 3) / (기본 경로) -> 실제 스테이션 패드 전용 풀스크린 대시보드
  return <StationPadView activeTimers={activeTimers} />;
}

/* ============================================================================
   1. 실제 간호사 스테이션 패드 전용 화면 (두 번째 사진처럼 군더더기 없는 풀스크린)
============================================================================ */
function StationPadView({ activeTimers }) {
  const [now, setNow] = useState(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  const hasFlashingBed = Object.values(activeTimers).some((timer) => {
    const elapsed = (now - timer.startTime) / 1000;
    return elapsed >= timer.durationSec * 2;
  });

  useEffect(() => {
    if (!hasFlashingBed || !soundEnabled) return;
    const playBeep = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } catch (e) {}
    };
    playBeep();
    const beepInterval = setInterval(playBeep, 1000);
    return () => clearInterval(beepInterval);
  }, [hasFlashingBed, soundEnabled]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-5 md:p-8 flex flex-col justify-between font-sans select-none">
      {/* 상단 상태 바 */}
      <div className="max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            1·2호실 담당 간호사 스테이션 모니터
          </h1>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-4 text-sm text-slate-300 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-emerald-600 inline-block" /> 정상/대기
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block" /> 작용시간 진행
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-red-600 inline-block" /> 1x 점화 / 2x 점멸
            </span>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer"
            title="경고음 켜기/끄기"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
          </button>
        </div>
      </div>

      {/* 메인 병상 그리드 (패드 화면 꽉 차게 배치) */}
      <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col justify-center gap-7">
        {/* 1호실 */}
        <div>
          <div className="text-sm font-bold text-sky-400 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> 1호실 (남성 병실 · 4병상)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {BEDS.filter((b) => b.room === 1).map((bed) => (
              <BedCard
                key={bed.id}
                bed={bed}
                timer={activeTimers[bed.id]}
                now={now}
                onClick={() => activeTimers[bed.id] && setSelectedAlert({ bed, timer: activeTimers[bed.id] })}
              />
            ))}
          </div>
        </div>

        {/* 2호실 */}
        <div>
          <div className="text-sm font-bold text-rose-400 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> 2호실 (여성 병실 · 4병상)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {BEDS.filter((b) => b.room === 2).map((bed) => (
              <BedCard
                key={bed.id}
                bed={bed}
                timer={activeTimers[bed.id]}
                now={now}
                onClick={() => activeTimers[bed.id] && setSelectedAlert({ bed, timer: activeTimers[bed.id] })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 스테이션 카드 터치 시 부작용 관찰 팝업 (해제 불가) */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border-2 border-red-500 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-8 h-8 text-red-500" />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {selectedAlert.bed.room}:{selectedAlert.bed.bed} 병상 부작용 관찰 가이드
                  </h3>
                  <p className="text-sm text-slate-400">
                    {selectedAlert.bed.patient} · {selectedAlert.bed.gender}/{selectedAlert.bed.age}세
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-red-950/60 border border-red-500/50 rounded-xl p-4 mb-4">
              <div className="text-base font-bold text-red-300 mb-1">💊 {selectedAlert.timer.medName}</div>
              <p className="text-sm text-red-200">
                투여 후 경과 시간: <strong>{Math.floor((now - selectedAlert.timer.startTime) / 1000)}초</strong>
              </p>
            </div>

            <ul className="space-y-2 text-sm text-slate-200 bg-slate-800/90 p-4 rounded-xl mb-4">
              {selectedAlert.timer.sideEffects.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="bg-amber-500/15 border border-amber-500/50 rounded-xl p-3.5 text-xs text-amber-200 mb-5">
              🔒 <strong>환자안전 잠금 정책:</strong> 스테이션 패드에서는 알람을 해제할 수 없습니다. 해당 병실로 이동하여 <strong>침상 앞 NFC 태그</strong>를 스캔하세요.
            </div>

            <button
              onClick={() => setSelectedAlert(null)}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   2. 침상 NFC 태그 시 간호사 스마트폰에 뜨는 현장 사정 화면 (/bed/1-3)
============================================================================ */
function MobileNfcView({ bedId, timer }) {
  const bed = BEDS.find((b) => b.id === bedId);
  const [checkedItems, setCheckedItems] = useState({});
  const [completed, setCompleted] = useState(false);

  if (!bed) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <p>존재하지 않는 병상 번호입니다. ({bedId})</p>
      </div>
    );
  }

  const handleComplete = async () => {
    await deleteDoc(doc(db, 'med_timers', bedId));
    setCompleted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-5 flex flex-col justify-center max-w-md mx-auto">
      <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1">
            <Nfc className="w-3.5 h-3.5" /> 침상 NFC 인증됨
          </span>
          <span className="text-lg font-extrabold text-white">{bed.room}:{bed.bed} 병상</span>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 mb-5">
          <div className="text-base font-bold text-white">{bed.patient}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {bed.gender === 'M' ? '남성' : '여성'} / {bed.age}세 · {bed.diagnosis}
          </div>
        </div>

        {completed ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-1">현장 사정 기록 완료</h2>
            <p className="text-xs text-slate-400">스테이션 패드 모니터가 초록색으로 복구되었습니다.</p>
          </div>
        ) : timer ? (
          <>
            <div className="text-sm font-bold text-emerald-400 mb-3">
              📋 {timer.medName} 부작용 사정 체크리스트
            </div>
            <div className="space-y-2.5 mb-6">
              {timer.sideEffects.map((effect, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!checkedItems[idx]}
                    onChange={(e) => setCheckedItems((prev) => ({ ...prev, [idx]: e.target.checked }))}
                    className="mt-0.5 accent-emerald-500 w-5 h-5"
                  />
                  <span className="text-xs text-slate-200 leading-relaxed">{effect}</span>
                </label>
              ))}
            </div>

            <button
              onClick={handleComplete}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" /> 사정 완료 및 스테이션 초록색 복구
            </button>
          </>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm">
            현재 이 병상에 대기 중인 투약 모니터링 알람이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   3. 원격 EMR 투약 연동 패널 (/emr - 시연 시 다른 기기에서 투약 신호 전송용)
============================================================================ */
function RemoteEmrView({ activeTimers }) {
  const [selectedBedId, setSelectedBedId] = useState('1-3');
  const [selectedMedId, setSelectedMedId] = useState('metoclopramide');
  const [demoMode, setDemoMode] = useState(true);

  const sendMedicationOrder = async (bedId = selectedBedId, medId = selectedMedId) => {
    const med = MEDICATIONS.find((m) => m.id === medId);
    if (!med) return;
    await setDoc(doc(db, 'med_timers', bedId), {
      medName: med.name,
      sideEffects: med.sideEffects,
      startTime: Date.now(),
      durationSec: demoMode ? med.demoSeconds : med.realMinutes * 60,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sky-400 font-bold">
            <Syringe className="w-5 h-5" />
            <span>EMR 원격 투약 연동 발신기</span>
          </div>
          <button
            onClick={() => setDemoMode(!demoMode)}
            className="text-xs px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-amber-300 cursor-pointer"
          >
            {demoMode ? '시연 단축(초)' : '실제 임상(분)'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">병상 선택</label>
            <select
              value={selectedBedId}
              onChange={(e) => setSelectedBedId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
            >
              {BEDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.room}:{b.bed} · {b.patient} ({b.gender}/{b.age}세)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">투여 약물 / 혈액제제</label>
            <select
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
            >
              {MEDICATIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({demoMode ? `${m.demoSeconds}초` : `${m.realMinutes}분`})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => sendMedicationOrder()}
            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> 스테이션 패드로 투약 신호 전송
          </button>

          <div className="pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400 mb-2">현재 활성화된 모니터링 ({Object.keys(activeTimers).length}건)</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(activeTimers).map(([id, t]) => (
                <span key={id} className="text-xs px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40">
                  {id} · {t.medName}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   병상 카드 컴포넌트
============================================================================ */
function BedCard({ bed, timer, now, onClick }) {
  let bgColor = 'hsl(142, 72%, 36%)';
  let statusText = '모니터링 대기 (정상)';
  let isFlashing = false;

  if (timer) {
    const elapsedSec = (now - timer.startTime) / 1000;
    const progress = elapsedSec / timer.durationSec;

    if (progress < 1) {
      bgColor = getTransitionColor(progress);
      const remain = Math.ceil(timer.durationSec - elapsedSec);
      statusText = `작용 진행 중 (${remain}초 후 도달)`;
    } else if (progress < 2) {
      bgColor = 'hsl(0, 84%, 45%)';
      const untilFlash = Math.ceil(timer.durationSec * 2 - elapsedSec);
      statusText = `부작용 관찰 요망 (점멸까지 ${untilFlash}초)`;
    } else {
      bgColor = 'hsl(0, 88%, 46%)';
      isFlashing = true;
      statusText = `🚨 지연 경고! 즉시 병실 확인`;
    }
  }

  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: bgColor }}
      className={`rounded-2xl p-5 text-white shadow-xl transition-transform duration-150 flex flex-col justify-between min-h-[185px] border border-white/20 ${
        timer ? 'cursor-pointer hover:scale-[1.02]' : ''
      } ${isFlashing ? 'animate-pulse ring-4 ring-red-400' : ''}`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black tracking-tight">
            {bed.room}:{bed.bed}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-black/25">
            {bed.gender}/{bed.age}세
          </span>
        </div>
        <div className="text-base font-bold mt-2 truncate">{bed.patient}</div>
        <div className="text-xs text-white/85 mt-0.5 truncate">{bed.diagnosis}</div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/25">
        {timer ? (
          <>
            <div className="text-sm font-extrabold truncate">{timer.medName}</div>
            <div className="text-xs font-medium flex items-center gap-1.5 mt-1">
              {isFlashing ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Clock className="w-4 h-4 shrink-0" />}
              <span className="truncate">{statusText}</span>
            </div>
          </>
        ) : (
          <div className="text-xs text-white/90 font-semibold">{statusText}</div>
        )}
      </div>
    </div>
  );
}