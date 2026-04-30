import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FiCamera, FiCameraOff, FiAlertTriangle, FiShield, FiEye, FiEyeOff } from 'react-icons/fi';
import { motion, AnimatePresence } from 'motion/react';

const VIOLATION_TYPES = {
  TAB_SWITCH: 'Tab Switch Detected',
  FACE_NOT_VISIBLE: 'Face Not Visible',
  MULTIPLE_FACES: 'Multiple Faces Detected',
  LOOKING_AWAY: 'Looking Away',
};

function VideoProctor({ onViolation, candidateName }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceCheckInterval = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [violations, setViolations] = useState([]);
  const [latestAlert, setLatestAlert] = useState(null);
  const [proctoringStatus, setProctoringStatus] = useState('idle'); // idle | active | warning
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);


  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraOn(true);
      setCameraError(null);
      setProctoringStatus('active');
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera for proctoring.');
      setCameraOn(false);
      setProctoringStatus('idle');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setProctoringStatus('idle');
  }, []);


  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        const count = tabSwitchCount + 1;
        setTabSwitchCount(count);
        triggerViolation(VIOLATION_TYPES.TAB_SWITCH, `Tab left ${count} time(s)`);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [tabSwitchCount]);


  useEffect(() => {
    if (!cameraOn) {
      if (faceCheckInterval.current) clearInterval(faceCheckInterval.current);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');

    faceCheckInterval.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      ctx.drawImage(videoRef.current, 0, 0, 80, 60);
      const data = ctx.getImageData(0, 0, 80, 60).data;


      let totalBrightness = 0;
      let pixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        totalBrightness += (r + g + b) / 3;
        pixels++;
      }
      const avgBrightness = totalBrightness / pixels;


      if (avgBrightness < 15) {
        triggerViolation(VIOLATION_TYPES.FACE_NOT_VISIBLE, 'Camera may be blocked');
      }
    }, 5000);

    return () => clearInterval(faceCheckInterval.current);
  }, [cameraOn]);

  const triggerViolation = useCallback((type, detail = '') => {
    const entry = { type, detail, time: new Date().toLocaleTimeString() };
    setViolations(prev => [...prev.slice(-9), entry]);
    setLatestAlert(entry);
    setProctoringStatus('warning');
    onViolation?.(entry);


    setTimeout(() => {
      setProctoringStatus('active');
      setLatestAlert(null);
    }, 4000);
  }, [onViolation]);


  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (faceCheckInterval.current) clearInterval(faceCheckInterval.current);
    };
  }, []);

  const statusColor = {
    idle: 'text-gray-400',
    active: 'text-purple-500',
    warning: 'text-amber-500',
  }[proctoringStatus];

  const statusDot = {
    idle: 'bg-gray-400',
    active: 'bg-purple-500',
    warning: 'bg-amber-500',
  }[proctoringStatus];

  return (
    <div className="w-full bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusDot} ${proctoringStatus === 'active' ? 'animate-pulse' : ''}`} />
          <FiShield size={13} className={statusColor} />
          <span className="text-xs font-semibold text-gray-300 tracking-wide">LIVE PROCTOR</span>
        </div>
        <div className="flex items-center gap-2">
          {violations.length > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
              {violations.length} alert{violations.length > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => setIsMinimized(p => !p)}
            className="text-gray-500 hover:text-gray-300 transition"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <FiEye size={14} /> : <FiEyeOff size={14} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Video Feed */}
            <div className="relative bg-black aspect-video">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]" // mirror flip
              />

              {/* Overlay when camera off */}
              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                  <FiCameraOff size={28} className="text-gray-600 mb-2" />
                  <p className="text-gray-500 text-xs text-center px-4">
                    {cameraError || 'Camera off'}
                  </p>
                  <button
                    onClick={startCamera}
                    className="mt-3 text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition"
                  >
                    Enable Camera
                  </button>
                </div>
              )}

              {/* Corner label */}
              {cameraOn && (
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded px-2 py-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-white text-[10px] font-medium">REC</span>
                </div>
              )}

              {/* Candidate name */}
              {cameraOn && candidateName && (
                <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm rounded px-2 py-0.5">
                  <span className="text-white text-[10px]">{candidateName}</span>
                </div>
              )}

              {/* Face detection overlay */}
              {cameraOn && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className={`absolute top-4 right-4 bottom-4 left-4 border-2 rounded-xl transition-colors duration-500 ${proctoringStatus === 'warning' ? 'border-amber-400/70' : 'border-purple-400/30'
                    }`} />
                  <div className="absolute top-4 left-4 w-3 h-3 border-t-2 border-l-2 border-purple-400/80 rounded-tl" />
                  <div className="absolute top-4 right-4 w-3 h-3 border-t-2 border-r-2 border-purple-400/80 rounded-tr" />
                  <div className="absolute bottom-4 left-4 w-3 h-3 border-b-2 border-l-2 border-purple-400/80 rounded-bl" />
                  <div className="absolute bottom-4 right-4 w-3 h-3 border-b-2 border-r-2 border-purple-400/80 rounded-br" />
                </div>
              )}
            </div>

            {/* Alert Banner */}
            <AnimatePresence>
              {latestAlert && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-amber-500/10 border-t border-amber-500/30 px-3 py-2 flex items-center gap-2"
                >
                  <FiAlertTriangle size={13} className="text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-amber-300 text-xs font-semibold truncate">{latestAlert.type}</p>
                    {latestAlert.detail && (
                      <p className="text-amber-400/70 text-[10px] truncate">{latestAlert.detail}</p>
                    )}
                  </div>
                  <span className="ml-auto text-[10px] text-amber-500/60 shrink-0">{latestAlert.time}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats footer */}
            <div className="px-4 py-2.5 bg-gray-850 border-t border-gray-700/50 grid grid-cols-3 gap-2 text-center bg-gray-900">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Status</p>
                <p className={`text-xs font-semibold capitalize ${statusColor}`}>{proctoringStatus}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tab Leaves</p>
                <p className={`text-xs font-semibold ${tabSwitchCount > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                  {tabSwitchCount}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Alerts</p>
                <p className={`text-xs font-semibold ${violations.length > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                  {violations.length}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VideoProctor;
