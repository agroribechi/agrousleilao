import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Square, Volume2, VolumeX, Bell, BellRing, Download, 
  Tag, Clock, CheckCircle2, AlertTriangle, Tv, Filter, Plus, 
  X, RefreshCw, Trash2, Edit2, Sparkles, Layers, DollarSign, Camera,
  Wifi, BarChart3, TrendingUp, Target, FolderDown, Check,
  Sliders, ChevronDown, ChevronUp, Settings, Eye, EyeOff, Search, Calendar,
  MessageSquare, MessageSquarePlus, FileText, Image as ImageIcon, Crop
} from 'lucide-react';

import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Hls from 'hls.js';

export const LIVE_AUCTION_CHANNELS = [
  { id: 'canaldoboi', name: '🐂 Canal do Boi (Ao Vivo)', url: 'https://sba1.fabricahost.com.br/canaldoboi/index.m3u8', type: 'hls' },
  { id: 'agrocanal', name: '🌾 Agro Canal (Ao Vivo)', url: 'https://sba1.fabricahost.com.br/agrocanal/index.m3u8', type: 'hls' },
  { id: 'canalrural', name: '🚜 Canal Rural (Ao Vivo)', url: 'https://canalrural.fabricahost.com.br/canalrural/index.m3u8', type: 'hls' },
  { id: 'terraviva', name: '🌱 Terra Viva (Ao Vivo)', url: 'https://evp.band.uol.com.br/terraviva/terraviva/playlist.m3u8', type: 'hls' },
];

const PRESET_CATEGORIES = [
  'Bezerros', 'Novilhas', 'Nelore', 'Matrizes', 'Boi Gordo', 'Garrotes', 'Cruzado'
];

// Extrai o videoId do YouTube de qualquer formato de URL
const extractYouTubeVideoId = (urlStr) => {
  if (!urlStr) return null;
  const str = urlStr.trim();
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/))([^#&?\n]+)/;
  const match = str.match(regExp);
  if (match && match[1]) return match[1];
  if (str.length === 11 && !str.includes('/') && !str.includes('.')) return str;
  return null;
};

export default function LiveBiddingRoom({ API_BASE, templates = [], auctions = [], user, onNavigateToCalibrator }) {
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanIntervalSec, setScanIntervalSec] = useState(4);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Filtros de Categoria de Alerta
  const [activeCategories, setActiveCategories] = useState(['Novilhas', 'Nelore']);
  const [customCatInput, setCustomCatInput] = useState('');

  // Estado dos Dados em Tempo Real
  const [currentLog, setCurrentLog] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  
  // Estado de Exibição e Filtros do Histórico
  const [showHistory, setShowHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('leilao_show_history');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });
  const [historyFilterChannel, setHistoryFilterChannel] = useState('all'); // 'all' ou nome do template
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);

  // Estado do Alerta Disparado
  const [alertActive, setAlertActive] = useState(null);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);

  const scanTimerRef = useRef(null);

  // YouTube IFrame Player API
  const ytPlayerRef = useRef(null);
  const ytPlayerContainerRef = useRef('yt-player-container');
  const [ytApiReady, setYtApiReady] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState(null);

  const [capturedFrameImage, setCapturedFrameImage] = useState(null);
  const [viewMode, setViewMode] = useState('player'); // 'player' | 'frame'
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [isLiveStream, setIsLiveStream] = useState(false);
  const [manualImageB64, setManualImageB64] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  // Estado de Print & Comentários do Lote
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printCommentText, setPrintCommentText] = useState('');
  const [capturedPrintB64, setCapturedPrintB64] = useState(null);
  const [isCapturingPrint, setIsCapturingPrint] = useState(false);
  const [engineMode, setEngineMode] = useState('gemini'); // 'gemini' | 'ocr'
  const [geminiStatus, setGeminiStatus] = useState(null); // 'auction' | 'ad' | null
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showKeyPassword, setShowKeyPassword] = useState(false);
  const [testingKeyStatus, setTestingKeyStatus] = useState(null);
  const [testingKeyMsg, setTestingKeyMsg] = useState('');
  const [printLotDetails, setPrintLotDetails] = useState({
    lot_number: '',
    category: 'Geral',
    description: '',
    price: '',
    log_id: null
  });
  const [viewingPrintImage, setViewingPrintImage] = useState(null);

  const [hasScreenCapture, setHasScreenCapture] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [capturedRawImage, setCapturedRawImage] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  // --- ESTADOS DA CALIBRAÇÃO DIRETA NA SALA AO VIVO ---
  const [isCalibratingInRoom, setIsCalibratingInRoom] = useState(false);
  const [inRoomCalibImage, setInRoomCalibImage] = useState(null);
  const [inRoomCalibWidth, setInRoomCalibWidth] = useState(640);
  const [inRoomCalibHeight, setInRoomCalibHeight] = useState(360);
  const [inRoomFields, setInRoomFields] = useState([]);
  const [inRoomStartPoint, setInRoomStartPoint] = useState(null);
  const [inRoomDragPoint, setInRoomDragPoint] = useState(null);
  const [inRoomIsDrawing, setInRoomIsDrawing] = useState(false);
  const [inRoomOcrResults, setInRoomOcrResults] = useState(null);
  const [inRoomOcrCrops, setInRoomOcrCrops] = useState({});
  const [inRoomTestingOcr, setInRoomTestingOcr] = useState(false);
  const [inRoomSaving, setInRoomSaving] = useState(false);
  const [inRoomTemplateName, setInRoomTemplateName] = useState('');
  const inRoomImgRef = useRef(null);

  const isLiveStreamRef = useRef(false);
  const videoUrlRef = useRef(videoUrl);
  const screenVideoRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const screenStreamRef = useRef(null);
  const nativeVideoRef = useRef(null);
  const hlsInstanceRef = useRef(null);
  const [streamType, setStreamType] = useState('hls'); // 'hls' | 'youtube'

  // ---------- REPRODUÇÃO NATIVA HLS (CANAL DO BOI, CANAL RURAL, TERRA VIVA, ETC.) ----------
  useEffect(() => {
    const isHls = videoUrl && (videoUrl.includes('.m3u8') || videoUrl.includes('.mp4'));
    if (isHls && nativeVideoRef.current) {
      setStreamType('hls');
      if (Hls.isSupported()) {
        if (hlsInstanceRef.current) {
          hlsInstanceRef.current.destroy();
        }
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(videoUrl);
        hls.attachMedia(nativeVideoRef.current);
        hlsInstanceRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          nativeVideoRef.current.play().catch(() => {});
        });
      } else if (nativeVideoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        nativeVideoRef.current.src = videoUrl;
        nativeVideoRef.current.play().catch(() => {});
      }
    } else {
      if (videoUrl && extractYouTubeVideoId(videoUrl)) {
        setStreamType('youtube');
      }
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    }
  }, [videoUrl]);

  // ---------- SUPORTE A COLAR PRINT COM CTRL + V ----------
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          reader.onload = async (event) => {
            const b64 = event.target.result;
            setManualImageB64(b64);
            setCapturedFrameImage(b64);
            setViewMode('frame');
            showToast('📸 Print colado! Processando com IA Gemini 3.6 Flash...');
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // ---------- YOUTUBE IFRAME PLAYER API ----------

  // Carrega o script da API do YouTube uma única vez
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtApiReady(true);
      return;
    }

    // Callback global que o YouTube chama quando a API está pronta
    window.onYouTubeIframeAPIReady = () => {
      setYtApiReady(true);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);

  // Cria ou atualiza o player quando o videoId ou a API ficam prontos
  useEffect(() => {
    const videoId = extractYouTubeVideoId(videoUrl);
    setCurrentVideoId(videoId);

    if (!ytApiReady || !videoId) return;

    // Se o player já existe, mas é outro vídeo, carrega o novo
    if (ytPlayerRef.current) {
      if (ytPlayerRef.current._videoId !== videoId) {
        try {
          ytPlayerRef.current.loadVideoById(videoId);
          ytPlayerRef.current._videoId = videoId;
        } catch (e) {
          console.error('[YT Player] Erro ao carregar novo video:', e);
        }
      }
      return;
    }

    // Cria um novo player
    ytPlayerRef.current = new window.YT.Player('yt-player-container', {
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        mute: 1,
        enablejsapi: 1,
        origin: window.location.origin,
        rel: 0,
      },
      events: {
        onReady: (event) => {
          console.log('[YT Player] Pronto. VideoId:', videoId);
          ytPlayerRef.current._videoId = videoId;
        },
        onError: (event) => {
          console.error('[YT Player] Erro:', event.data);
        }
      }
    });
  }, [ytApiReady, videoUrl]);

  // Atualiza o indicador de tempo do player a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        setPlayerCurrentTime(Math.floor(ytPlayerRef.current.getCurrentTime()));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Obtém o tempo atual do player de forma confiável
  const getPlayerCurrentTimeSec = useCallback(() => {
    if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
      try {
        const t = ytPlayerRef.current.getCurrentTime();
        if (typeof t === 'number' && !isNaN(t) && t > 0) {
          return Math.floor(t);
        }
      } catch (e) {}
    }
    if (playerCurrentTime > 0) return playerCurrentTime;
    return 0;
  }, [playerCurrentTime]);

  // ---------- FIM YOUTUBE IFRAME PLAYER API ----------

  useEffect(() => {
    videoUrlRef.current = videoUrl;
  }, [videoUrl]);

  useEffect(() => {
    isLiveStreamRef.current = isLiveStream;
  }, [isLiveStream]);

  // Carrega o primeiro template disponível ao iniciar
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateName) {
      handleSelectTemplate(templates[0].name);
    }
  }, [templates]);

  const handleSelectTemplate = (tName) => {
    setSelectedTemplateName(tName);
    const found = templates.find(t => t.name === tName);
    if (found) {
      if (found.video_url) {
        setVideoUrl(found.video_url);
        videoUrlRef.current = found.video_url;
      }
    }
    setViewMode('player');
    setCapturedFrameImage(null);
    setCurrentLog(null);
    setOcrData(null);
    fetchHistoryLogs(tName);
  };

  const fetchHistoryLogs = useCallback(async (channelFilter = historyFilterChannel) => {
    try {
      const url = (channelFilter && channelFilter !== 'all')
        ? `${API_BASE}/api/logs?channel_name=${encodeURIComponent(channelFilter)}`
        : `${API_BASE}/api/logs`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data);
      }
    } catch (e) {}
  }, [API_BASE, historyFilterChannel]);

  useEffect(() => {
    fetchHistoryLogs(historyFilterChannel);
  }, [historyFilterChannel, fetchHistoryLogs]);

  const toggleShowHistory = () => {
    setShowHistory(prev => {
      const next = !prev;
      try {
        localStorage.setItem('leilao_show_history', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleClearHistory = async (onlyCurrentChannel = false) => {
    const targetChannel = onlyCurrentChannel ? selectedTemplateName : (historyFilterChannel !== 'all' ? historyFilterChannel : null);
    try {
      const url = targetChannel 
        ? `${API_BASE}/api/logs/clear/all?channel_name=${encodeURIComponent(targetChannel)}`
        : `${API_BASE}/api/logs/clear/all`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        showToast(`Histórico apagado com sucesso! (${data.deleted_count || 0} registros removidos)`);
        fetchHistoryLogs(historyFilterChannel);
        setShowClearHistoryConfirm(false);
      }
    } catch (e) {
      console.error('Erro ao apagar histórico:', e);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '---';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
    } catch (e) {
      return isoString;
    }
  };

  const filteredHistoryLogs = historyLogs.filter(log => {
    if (historyFilterChannel !== 'all' && log.channel_name !== historyFilterChannel) {
      return false;
    }
    if (historyDateFilter && log.created_at) {
      const logDateStr = new Date(log.created_at).toISOString().split('T')[0];
      if (logDateStr !== historyDateFilter) return false;
    }
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase().trim();
      const matchesLot = log.lot_number?.toLowerCase().includes(q);
      const matchesCat = log.category?.toLowerCase().includes(q);
      const matchesDesc = log.description?.toLowerCase().includes(q);
      const matchesPrice = log.price?.toLowerCase().includes(q);
      const matchesChannel = log.channel_name?.toLowerCase().includes(q);
      const matchesAge = log.age?.toLowerCase().includes(q);
      return Boolean(matchesLot || matchesCat || matchesDesc || matchesPrice || matchesChannel || matchesAge);
    }
    return true;
  });

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Tocador de Alerta Sonoro e Vibração Hática no Mobile
  const playAlertSound = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([200, 100, 200, 100, 300]); } catch (e) {}
    }
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  // Inicia captura direta da janela do navegador ou monitor
  const handleStartScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false
      });
      screenStreamRef.current = stream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play();
        
        screenVideoRef.current.onloadedmetadata = () => {
          setTimeout(() => {
            const canvas = document.createElement('canvas');
            canvas.width = screenVideoRef.current.videoWidth;
            canvas.height = screenVideoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(screenVideoRef.current, 0, 0);
            setCapturedRawImage(canvas.toDataURL('image/jpeg', 0.9));
            if (engineMode === 'ocr') {
              setShowCropModal(true);
            }
          }, 500);
        };
      }
      setHasScreenCapture(true);
      showToast('📺 Transmissão vinculada com sucesso!');
    } catch (err) {
      console.error("Erro na captura de tela:", err);
    }
  };

  // Alterna o início/parada do monitoramento com verificação automática de transmissão
  const handleToggleScanning = async () => {
    if (!scanning) {
      if (!screenStreamRef.current && !manualImageB64) {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: "browser" },
            audio: false
          });
          screenStreamRef.current = stream;
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = stream;
            screenVideoRef.current.play();
          }
          setHasScreenCapture(true);
          setScanning(true);
          showToast("✨ Transmissão conectada! IA Gemini lendo ao vivo...");
          return;
        } catch (err) {
          if (err.name !== "NotAllowedError") {
            alert("Para iniciar, compartilhe a aba do leilão.");
          }
          return;
        }
      }
      setScanning(true);
      showToast("✨ Varredura IA iniciada!");
    } else {
      setScanning(false);
      showToast("⏹️ Varredura pausada.");
    }
  };

  // ---------- FUNÇÕES DA CALIBRAÇÃO DIRETA NA SALA AO VIVO ----------
  const handleStartInRoomCalib = async () => {
    let base64 = null;

    if (screenStreamRef.current) {
      base64 = captureFrameFromScreen();
    } else if (capturedFrameImage) {
      base64 = capturedFrameImage;
    } else if (manualImageB64) {
      base64 = manualImageB64;
    }

    if (!base64) {
      // Se não tem frame, captura a tela da aba do leilão
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" },
          audio: false
        });
        screenStreamRef.current = stream;
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
          screenVideoRef.current.play();
        }
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            setTimeout(() => {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              base64 = canvas.toDataURL('image/jpeg', 0.9);
              resolve();
            }, 600);
          };
        });
      } catch (err) {
        if (err.name !== "NotAllowedError") {
          alert(`Para calibrar, compartilhe a tela ou selecione a imagem do lote.`);
        }
        return;
      }
    }

    if (base64) {
      const img = new Image();
      img.onload = () => {
        setInRoomCalibImage(base64);
        setInRoomCalibWidth(img.width);
        setInRoomCalibHeight(img.height);
        setInRoomTemplateName(selectedTemplateName || 'Novo Gabarito');
        
        // Carrega campos do template selecionado
        const curTemplate = templates.find(t => t.name === selectedTemplateName);
        if (curTemplate && curTemplate.fields && curTemplate.fields.length > 0) {
          setInRoomFields(curTemplate.fields);
        } else {
          setInRoomFields([]);
        }
        setInRoomOcrResults(null);
        setIsCalibratingInRoom(true);
      };
      img.src = base64;
    }
  };

  const getInRoomClickCoords = (e) => {
    if (!inRoomImgRef.current) return null;
    const img = inRoomImgRef.current;
    const rect = img.getBoundingClientRect();
    const natW = img.naturalWidth || inRoomCalibWidth || 640;
    const natH = img.naturalHeight || inRoomCalibHeight || 360;

    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    }
    // Garante precisão milimétrica aos pixels da imagem
    const displayX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const displayY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const scaleX = natW / rect.width;
    const scaleY = natH / rect.height;

    return {
      x: Math.round(displayX * scaleX),
      y: Math.round(displayY * scaleY),
      displayX,
      displayY,
      rectWidth: rect.width,
      rectHeight: rect.height,
      natW,
      natH
    };
  };

  const handleInRoomMouseDown = (e) => {
    if (!inRoomCalibImage) return;
    const coords = getInRoomClickCoords(e);
    if (!coords) return;
    setInRoomStartPoint(coords);
    setInRoomDragPoint(coords);
    setInRoomIsDrawing(true);
  };

  const handleInRoomMouseMove = (e) => {
    if (!inRoomIsDrawing) return;
    const coords = getInRoomClickCoords(e);
    if (coords) setInRoomDragPoint(coords);
  };

  const handleInRoomMouseUp = (e) => {
    if (!inRoomIsDrawing || !inRoomStartPoint) return;
    const endPoint = getInRoomClickCoords(e) || inRoomDragPoint;
    setInRoomIsDrawing(false);
    if (!endPoint) return;

    const x1 = Math.min(inRoomStartPoint.x, endPoint.x);
    const y1 = Math.min(inRoomStartPoint.y, endPoint.y);
    const x2 = Math.max(inRoomStartPoint.x, endPoint.x);
    const y2 = Math.max(inRoomStartPoint.y, endPoint.y);

    if (Math.abs(x2 - x1) < 10 || Math.abs(y2 - y1) < 10) {
      setInRoomStartPoint(null);
      setInRoomDragPoint(null);
      return;
    }

    const defaultNames = ["Número do Lote", "Preço Atual", "Descrição do Lote", "Idade / Peso"];
    const fieldName = defaultNames[inRoomFields.length] || `Campo ${inRoomFields.length + 1}`;

    const natW = inRoomImgRef.current?.naturalWidth || inRoomCalibWidth || 640;
    const natH = inRoomImgRef.current?.naturalHeight || inRoomCalibHeight || 360;

    const newField = {
      nome: fieldName,
      x1, y1, x2, y2,
      ref_w: natW,
      ref_h: natH
    };

    setInRoomFields([...inRoomFields, newField]);
    setInRoomStartPoint(null);
    setInRoomDragPoint(null);
  };

  const handleInRoomAddPreset = (fieldType) => {
    const natW = inRoomImgRef.current?.naturalWidth || inRoomCalibWidth || 640;
    const natH = inRoomImgRef.current?.naturalHeight || inRoomCalibHeight || 360;

    let preset = { nome: "Campo", x1: Math.round(natW * 0.05), y1: Math.round(natH * 0.1), x2: Math.round(natW * 0.35), y2: Math.round(natH * 0.25), ref_w: natW, ref_h: natH };
    if (fieldType === 'lote') {
      preset = { nome: "Número do Lote", x1: Math.round(natW * 0.04), y1: Math.round(natH * 0.05), x2: Math.round(natW * 0.38), y2: Math.round(natH * 0.22), ref_w: natW, ref_h: natH };
    } else if (fieldType === 'preco') {
      preset = { nome: "Preço Atual", x1: Math.round(natW * 0.55), y1: Math.round(natH * 0.72), x2: Math.round(natW * 0.96), y2: Math.round(natH * 0.92), ref_w: natW, ref_h: natH };
    } else if (fieldType === 'desc') {
      preset = { nome: "Descrição do Lote", x1: Math.round(natW * 0.04), y1: Math.round(natH * 0.65), x2: Math.round(natW * 0.96), y2: Math.round(natH * 0.85), ref_w: natW, ref_h: natH };
    } else if (fieldType === 'idade') {
      preset = { nome: "Idade / Peso", x1: Math.round(natW * 0.04), y1: Math.round(natH * 0.28), x2: Math.round(natW * 0.45), y2: Math.round(natH * 0.42), ref_w: natW, ref_h: natH };
    }
    setInRoomFields([...inRoomFields, preset]);
    showToast(`Caixa '${preset.nome}' adicionada!`);
  };

  const handleInRoomDeleteField = (index) => {
    setInRoomFields(inRoomFields.filter((_, i) => i !== index));
  };

  const handleInRoomTestOcr = async () => {
    if (!inRoomCalibImage || inRoomFields.length === 0) {
      alert("Desenhe ao menos uma caixa antes de testar o OCR.");
      return;
    }
    setInRoomTestingOcr(true);
    try {
      const res = await fetch(`${API_BASE}/api/ocr/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: inRoomCalibImage,
          fields: inRoomFields
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao testar OCR');
      setInRoomOcrResults(data.results || {});
      setInRoomOcrCrops(data.debug_crops || {});
      showToast('🧪 OCR processado com sucesso na tela!');
    } catch (err) {
      alert(`Erro no OCR: ${err.message}`);
    } finally {
      setInRoomTestingOcr(false);
    }
  };

  const handleInRoomSaveTemplate = async () => {
    if (!inRoomTemplateName.trim()) {
      alert("Por favor, informe o nome do Gabarito.");
      return;
    }
    if (inRoomFields.length === 0) {
      alert("Desenhe ao menos um campo antes de salvar.");
      return;
    }
    setInRoomSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inRoomTemplateName.trim(),
          video_url: videoUrl,
          fields: inRoomFields
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erro ao salvar gabarito');
      }
      setSelectedTemplateName(inRoomTemplateName.trim());
      setIsCalibratingInRoom(false);
      showToast(`🎯 Gabarito '${inRoomTemplateName.trim()}' salvo e ativado na sala com 100% de precisão!`);
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setInRoomSaving(false);
    }
  };

  const captureFrameFromScreen = () => {
    if (!screenVideoRef.current || !hiddenCanvasRef.current) return null;
    const video = screenVideoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;
    
    const canvas = hiddenCanvasRef.current;
    const ctx = canvas.getContext('2d');

    if (savedCropRect) {
      const cropW = savedCropRect.pW * video.videoWidth;
      const cropH = savedCropRect.pH * video.videoHeight;
      canvas.width = cropW;
      canvas.height = cropH;
      ctx.drawImage(
        video,
        savedCropRect.pX * video.videoWidth,
        savedCropRect.pY * video.videoHeight,
        cropW,
        cropH,
        0,
        0,
        cropW,
        cropH
      );
    } else {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const b64 = event.target.result;
        setManualImageB64(b64);
        setCapturedFrameImage(b64);
        setViewMode('frame');
      };
      reader.readAsDataURL(file);
    }
  };

  // Funções para Tirar Print da Transmissão e Adicionar Comentários ao Histórico
  const handleOpenPrintModal = async () => {
    setIsCapturingPrint(true);
    let printB64 = null;

    // 1. Prioridade 1: Frame mais recente capturado pela IA na Varredura Ao Vivo
    if (capturedFrameImage) {
      printB64 = capturedFrameImage;
    }

    // 2. Prioridade 2: Se tem captura de tela ativa do navegador
    if (!printB64 && screenStreamRef.current) {
      printB64 = captureFrameFromScreen();
    }

    // 3. Prioridade 3: Se ainda não tem e tem vídeo do YouTube, busca no backend no tempo exato atual
    if (!printB64 && videoUrlRef.current) {
      try {
        let secTime = getPlayerCurrentTimeSec();
        if (secTime === 0 && playerCurrentTime > 0) {
          secTime = playerCurrentTime;
        }
        const m = Math.floor(secTime / 60);
        const s = secTime % 60;
        const res = await fetch(`${API_BASE}/api/stream/frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: videoUrlRef.current, minutes: m, seconds: s })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.image) {
            printB64 = data.image.startsWith('data:') ? data.image : `data:image/jpeg;base64,${data.image}`;
          }
        }
      } catch (e) {
        console.error("Erro ao capturar frame via backend:", e);
      }
    }

    // 4. Fallback se houver manual image b64
    if (!printB64 && manualImageB64) {
      printB64 = manualImageB64;
    }

    setCapturedPrintB64(printB64);
    setPrintCommentText(currentLog?.notes || '');
    setPrintLotDetails({
      lot_number: currentLog?.lot_number || '1',
      category: currentLog?.category || 'Bezerros Nelore',
      description: currentLog?.description || 'Lote Atual na Tela',
      price: currentLog?.price || 'R$ ---',
      log_id: currentLog?.id || null
    });
    setIsCapturingPrint(false);
    setIsPrintModalOpen(true);
  };

  const handleSavePrintWithComment = async () => {
    if (!selectedTemplateName) {
      alert("Selecione um leilão / leiloeira primeiro.");
      return;
    }

    try {
      let savedLog = null;

      if (printLotDetails.log_id) {
        // Atualiza o registro existente do lote atual
        const res = await fetch(`${API_BASE}/api/logs/${printLotDetails.log_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lot_number: printLotDetails.lot_number,
            category: printLotDetails.category,
            description: printLotDetails.description,
            price: printLotDetails.price,
            notes: printCommentText,
            frame_image: capturedPrintB64
          })
        });
        if (res.ok) {
          savedLog = await res.json();
        }
      } else {
        // Cria um novo registro no histórico com o print e observações
        const res = await fetch(`${API_BASE}/api/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel_name: selectedTemplateName,
            video_url: videoUrl,
            lot_number: printLotDetails.lot_number || '1',
            category: printLotDetails.category || 'Geral',
            description: printLotDetails.description || 'Lote registrado com print',
            price: printLotDetails.price || 'R$ ---',
            status: 'Em Andamento',
            notes: printCommentText,
            frame_image: capturedPrintB64
          })
        });
        if (res.ok) {
          savedLog = await res.json();
        }
      }

      if (savedLog) {
        setCurrentLog(savedLog);
        fetchHistoryLogs(historyFilterChannel);
        showToast("📸 Print e comentários salvos no histórico!");
        setIsPrintModalOpen(false);
      }
    } catch (err) {
      console.error("Erro ao salvar print e comentários:", err);
      alert("Ocorreu um erro ao salvar no histórico.");
    }
  };

  // Função para descobrir dinamicamente o modelo suportado pela conta do usuário
  const getOrDiscoverGeminiModel = async (key) => {
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (listRes.ok) {
        const data = await listRes.json();
        const models = data.models || [];
        const supported = models
          .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''));
        
        // Prioridade 1: gemini-3.6-flash
        const g36 = supported.find(m => m.includes('3.6-flash') || m.includes('3.6'));
        if (g36) return g36;

        // Prioridade 2: Outros modelos Flash
        const flash = supported.find(m => m.includes('flash'));
        if (flash) return flash;

        // Prioridade 3: Modelos Pro ou outros Gemini
        const pro = supported.find(m => m.includes('pro')) || supported.find(m => m.includes('gemini'));
        if (pro) return pro;

        if (supported.length > 0) return supported[0];
      }
    } catch (e) {
      console.warn("Erro ao listar modelos:", e);
    }
    return 'gemini-3.6-flash';
  };

  // Função para testar conexão direta com a API do Gemini
  const handleTestApiKey = async () => {
    const key = geminiApiKey.trim();
    if (!key) {
      setTestingKeyStatus('invalid');
      setTestingKeyMsg('Por favor, digite ou cole sua chave antes de testar.');
      return;
    }
    setTestingKeyStatus('testing');
    setTestingKeyMsg('Identificando modelos disponíveis na sua conta Google...');
    try {
      const modelName = await getOrDiscoverGeminiModel(key);
      setTestingKeyMsg(`Conectando com modelo '${modelName}'...`);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
      const payload = {
        contents: [
          {
            parts: [{ text: "Responda apenas com a palavra OK." }]
          }
        ]
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setTestingKeyStatus('valid');
        setTestingKeyMsg(`✅ Chave Válida! Conectada com sucesso usando o modelo '${modelName}'.`);
        localStorage.setItem('gemini_api_key', key);
        localStorage.setItem('gemini_selected_model', modelName);
      } else {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.error?.message || `Erro HTTP ${res.status}`;
        setTestingKeyStatus('invalid');
        setTestingKeyMsg(`❌ Google API Erro: ${msg}`);
      }
    } catch (e) {
      setTestingKeyStatus('invalid');
      setTestingKeyMsg(`❌ Falha de rede: ${e.message}`);
    }
  };

  const isScanningRef = useRef(false);
  const [lastScanMs, setLastScanMs] = useState(null);

  // ============================================================
  // FUNÇÃO PRINCIPAL DE VARREDURA — IA GEMINI VISION + OCR
  // ============================================================
  const performLiveScan = useCallback(async () => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    const tStart = performance.now();

    // 1. Tenta obter frame local se disponível (HLS, Print, etc.)
    let imageBase64ToSend = manualImageB64;
    if (nativeVideoRef.current && nativeVideoRef.current.videoWidth > 0 && !nativeVideoRef.current.paused) {
      try {
        const video = nativeVideoRef.current;
        const canvas = hiddenCanvasRef.current || document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        imageBase64ToSend = canvas.toDataURL('image/jpeg', 0.85);
      } catch (e) {
        console.warn("Erro ao capturar frame nativo HLS:", e);
      }
    } else if (screenStreamRef.current) {
      const screenCap = captureFrameFromScreen();
      if (screenCap) imageBase64ToSend = screenCap;
    } else if (capturedFrameImage) {
      imageBase64ToSend = capturedFrameImage;
    }

    const currentUrl = videoUrlRef.current || videoUrl;

    // Se não tiver imagem nem URL de vídeo, interrompe
    if (!imageBase64ToSend && !currentUrl) {
      isScanningRef.current = false;
      return;
    }

    try {
      if (engineMode === 'gemini') {
        const key = geminiApiKey.trim();
        
        // Chama o backend que processa com Gemini e já sincroniza com a VPS
        const res = await fetch(`${API_BASE}/api/vision/read-frame`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: imageBase64ToSend,
            url: currentUrl,
            channel_name: selectedTemplateName || 'Geral',
            filter_categories: activeCategories,
            api_key: key || undefined
          })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
          if (data.frame_image) setCapturedFrameImage(data.frame_image);
          if (data.ocr_data) setOcrData(data.ocr_data);
          if (data.current_log) {
            setCurrentLog(data.current_log);
            fetchHistoryLogs(historyFilterChannel);
          }
          if (data.alert_triggered) {
            setAlertActive({ category: data.matched_category || data.current_log?.category, time: new Date().toLocaleTimeString('pt-BR') });
            playAlertSound();
          }
        }
        setLastScanTime(new Date());
        setLastScanMs(Math.round(performance.now() - tStart));
        isScanningRef.current = false;
        return;
      } else {
        // Modo OCR com Coordenadas Calibradas
        const liveMode = isLiveStreamRef.current;
        const currentUrl = videoUrlRef.current;
        const currentTimeSec = getPlayerCurrentTimeSec();
        const min = liveMode ? 0 : Math.floor(currentTimeSec / 60);
        const sec = liveMode ? 0 : (currentTimeSec % 60);

        const res = await fetch(`${API_BASE}/api/live/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_name: selectedTemplateName || 'Geral',
            url: currentUrl,
            is_live: liveMode,
            minutes: min,
            seconds: sec,
            filter_categories: activeCategories,
            image_base64: imageBase64ToSend
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Erro na varredura.');

        if (data.frame_image) setCapturedFrameImage(data.frame_image);
        setOcrData(data.ocr_data);
        setCurrentLog(data.current_log);
        setHistoryLogs(data.history || []);

        if (data.alert_triggered) {
          setAlertActive({
            category: data.matched_category,
            time: new Date().toLocaleTimeString('pt-BR')
          });
          playAlertSound();
        }
      }

      setLastScanTime(new Date());
      setLastScanMs(Math.round(performance.now() - tStart));

    } catch (err) {
      console.error('Erro na varredura ao vivo:', err);
      showToast(`⚠️ Erro na IA: ${err.message}`);
    } finally {
      isScanningRef.current = false;
    }
  }, [engineMode, geminiApiKey, selectedTemplateName, manualImageB64, capturedFrameImage, activeCategories, API_BASE, fetchHistoryLogs, historyFilterChannel, getPlayerCurrentTimeSec, videoUrl]);

  // Gerencia o Agendamento Sequencial da Varredura (Evita acúmulo de requisições)
  useEffect(() => {
    let timeoutId = null;
    let isMounted = true;

    const runLoop = async () => {
      if (!scanning || !isMounted) return;
      await performLiveScan();
      if (scanning && isMounted) {
        timeoutId = setTimeout(runLoop, scanIntervalSec * 1000);
      }
    };

    if (scanning) {
      runLoop();
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [scanning, scanIntervalSec, performLiveScan]);


  // Gestão de Categorias no Filtro
  const toggleCategory = (cat) => {
    if (activeCategories.includes(cat)) {
      setActiveCategories(activeCategories.filter(c => c !== cat));
    } else {
      setActiveCategories([...activeCategories, cat]);
    }
  };

  const handleAddCustomCategory = (e) => {
    e.preventDefault();
    if (customCatInput.trim() && !activeCategories.includes(customCatInput.trim())) {
      setActiveCategories([...activeCategories, customCatInput.trim()]);
      setCustomCatInput('');
    }
  };

  const handleExportCSV = () => {
    window.open(`${API_BASE}/api/logs/export?channel_name=${encodeURIComponent(selectedTemplateName)}`, '_blank');
  };

  const handleDeleteLog = async (id) => {
    if (!window.confirm('Deseja excluir este registro do histórico?')) return;
    try {
      await fetch(`${API_BASE}/api/logs/${id}`, { method: 'DELETE' });
      fetchHistoryLogs(historyFilterChannel);
    } catch (e) {}
  };

  const formatTime = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };
  const handleSendWhatsAppBid = () => {
    const currentTemplate = templates.find(t => t.name === selectedTemplateName);
    const activeAuction = currentTemplate ? auctions?.find(a => a.template_id === currentTemplate.id) : null;
    
    const phoneWhatsapp = activeAuction?.phone_whatsapp;
    
    if (!phoneWhatsapp) {
      alert("Nenhum número de WhatsApp cadastrado para o leilão ativo neste canal.");
      return;
    }

    const lotNumber = currentLog?.lot_number || '...';
    const lotDesc = currentLog?.description || currentLog?.category || '...';
    const userName = user?.full_name || 'Usuário';
    const textMsg = `Olá! Meu nome é ${userName} e tenho interesse em dar um lance no lote #${lotNumber} (${lotDesc}).`;
    
    const cleanPhone = phoneWhatsapp.replace(/\D/g, '');
    const waUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(textMsg)}`;
    
    window.open(waUrl, '_blank');
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* TOAST */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100,
          background: 'rgba(16, 185, 129, 0.9)', color: '#fff', padding: '0.85rem 1.5rem',
          borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)', fontWeight: 600
        }}>
          <CheckCircle2 size={20} />
          {toastMsg}
        </div>
      )}

      {/* HIDDEN ELEMENTS: video e canvas para screen capture */}
      <video ref={screenVideoRef} style={{ display: 'none' }} />
      <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />
      
      {/* BANNER DE ALERTA DE CATEGORIA DISPARADO */}
      {alertActive && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.95) 0%, rgba(168, 85, 247, 0.95) 100%)',
          color: '#fff', padding: '1rem 1.5rem', borderRadius: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 10px 30px rgba(236, 72, 153, 0.5)',
          animation: 'pulseGlow 1.5s infinite ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <BellRing size={28} className="animate-bounce" />
            <div>
              <strong style={{ fontSize: '1.1rem', display: 'block' }}>
                🚨 LOTE DE INTERESSE ENTRANDO EM LEILÃO!
              </strong>
              <span style={{ fontSize: '0.85rem', opacity: 0.95 }}>
                Categoria detectada pela IA: <strong>"{alertActive.category}"</strong> às {alertActive.time}
              </span>
            </div>
          </div>
          <button 
            onClick={() => setAlertActive(null)}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Fechar Alerta
          </button>
        </div>
      )}

      {/* SLIDE-OVER SIDE DRAWER (MENU LATERAL DESLIZANTE DE CONFIGURAÇÕES) */}
      {showConfigDrawer && (
        <div className="side-drawer-overlay" onClick={() => setShowConfigDrawer(false)}>
          <div className="side-drawer-panel" onClick={(e) => e.stopPropagation()}>
            
            {/* TOPO DO MENU LATERAL */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', margin: 0 }}>
                <Settings size={20} /> Configurações do Leilão
              </h3>
              <button 
                onClick={() => setShowConfigDrawer(false)}
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.6rem', borderRadius: '50%', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* SELEÇÃO DA LEILOEIRA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                🐂 Leiloeira / Transmissão:
              </label>
              <select 
                value={selectedTemplateName} 
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="glass-input"
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.9rem', fontWeight: 700 }}
              >
                {templates.map(t => (
                  <option key={t.id || t.name} value={t.name} style={{ background: '#0f172a' }}>
                    🐂 {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* CONTROLES DE IA E FREQUÊNCIA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>Status da IA:</span>
                {scanning ? (
                  <div className="pulsing-ia-badge" style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem' }}>
                    <span className="pulsing-dot"></span>
                    <span>IA ATIVA</span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>⚪ Pausada</span>
                )}
              </div>

              <button 
                onClick={() => setScanning(!scanning)}
                className={scanning ? "btn-gradient btn-monitor-stop" : "btn-gradient btn-monitor-active"}
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem', fontWeight: 700, borderRadius: '10px', width: '100%' }}
              >
                {scanning ? <Square size={16} /> : <Play size={16} />}
                {scanning ? '⏹️ Parar Monitoramento' : '▶️ Iniciar Monitoramento IA'}
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.35rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sliders size={14} color="#818cf8" /> Frequência de Leitura:
                </label>
                <select 
                  value={scanIntervalSec} 
                  onChange={(e) => setScanIntervalSec(Number(e.target.value))}
                  className="glass-input"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                >
                  <option value={2} style={{ background: '#0f172a' }}>⚡ A cada 2 segundos (Ultra-rápido)</option>
                  <option value={4} style={{ background: '#0f172a' }}>⏱️ A cada 4 segundos (Padrão)</option>
                  <option value={8} style={{ background: '#0f172a' }}>🐢 A cada 8 segundos (Econômico)</option>
                </select>
              </div>
            </div>

            {/* CAMPO DE URL DO YOUTUBE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                🔗 URL da Transmissão YouTube:
              </label>
              <input 
                type="text" className="glass-input" 
                value={videoUrl} onChange={(e) => {
                  setVideoUrl(e.target.value);
                  videoUrlRef.current = e.target.value;
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
              />
              <button 
                onClick={async () => {
                  if (!selectedTemplateName || !videoUrl) return;
                  const found = templates.find(t => t.name === selectedTemplateName);
                  if (!found) return;
                  try {
                    const res = await fetch(`${API_BASE}/api/templates`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: found.name,
                        video_url: videoUrl,
                        fields: found.fields
                      })
                    });
                    if (res.ok) {
                      showToast(`URL salva para ${found.name}!`);
                    }
                  } catch (e) {}
                }}
                className="btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: '#38bdf8', marginTop: '0.2rem' }}
              >
                💾 Salvar Link do Canal
              </button>
            </div>

            {/* PAINEL DE ALERTAS POR CATEGORIA (MOVIDO PARA O MENU LATERAL) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Filter size={15} color="#34d399" /> Alertas por Categoria:
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {activeCategories.length} ativa(s)
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {PRESET_CATEGORIES.map(cat => {
                  const isSelected = activeCategories.includes(cat);
                  return (
                    <button 
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      style={{
                        background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: isSelected ? '1px solid #34d399' : '1px solid var(--border-subtle)',
                        color: isSelected ? '#6ee7b7' : 'var(--text-muted)',
                        padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem',
                        fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {isSelected ? <Check size={11} /> : <Tag size={11} />}
                      {cat}
                      {isSelected && <Bell size={11} color="#34d399" />}
                    </button>
                  );
                })}
              </div>

              {/* ADICIONAR CATEGORIA CUSTOMIZADA */}
              <form onSubmit={handleAddCustomCategory} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                <input 
                  type="text" className="glass-input" 
                  placeholder="+ Nova Categoria..."
                  value={customCatInput} onChange={(e) => setCustomCatInput(e.target.value)}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', flex: 1 }}
                />
                <button type="submit" className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#34d399' }}>
                  <Plus size={14} />
                </button>
              </form>
            </div>

            {/* TOGGLE DE SOM DE ALERTA */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Alerta Sonoro:</span>
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', color: soundEnabled ? '#34d399' : '#94a3b8' }}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {soundEnabled ? 'Ativado' : 'Mutado'}
              </button>
            </div>

            {/* TOGGLE DE EXIBIÇÃO DO HISTÓRICO NO MENU LATERAL */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.82rem', color: '#f8fafc', fontWeight: 700 }}>Tabela de Histórico:</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Exibir ou ocultar painel</span>
              </div>
              <button 
                onClick={toggleShowHistory}
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', color: showHistory ? '#38bdf8' : '#94a3b8' }}
              >
                {showHistory ? <Eye size={16} /> : <EyeOff size={16} />}
                {showHistory ? 'Exibido' : 'Oculto'}
              </button>
            </div>

            {/* BOTÃO CONCLUÍDO */}
            <button 
              onClick={() => setShowConfigDrawer(false)} 
              className="btn-gradient"
              style={{ marginTop: 'auto', padding: '0.75rem', fontSize: '0.9rem', width: '100%' }}
            >
              Concluído
            </button>

          </div>
        </div>
      )}

      {/* BARRA SUPERIOR COMPACTA PRINCIPAL (SEMPRE VISÍVEL COM MÍNIMO ESPAÇO NATIVO) */}
      <div className="glass-panel" style={{ padding: '0.6rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          
          {/* NOME DA LEILOEIRA & SELETOR DE LEILÕES */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              🐂 {selectedTemplateName || 'Leilão Ao Vivo'}
            </span>

            {/* SELETOR DE LEILÕES CADASTRADOS */}
            {auctions && auctions.length > 0 && (
              <select
                onChange={(e) => {
                  const aucId = e.target.value;
                  if (!aucId) return;
                  const foundAuc = auctions.find(a => String(a.id) === String(aucId));
                  if (foundAuc) {
                    setSelectedTemplateName(foundAuc.title);
                    if (foundAuc.website_url) {
                      setVideoUrl(foundAuc.website_url);
                      videoUrlRef.current = foundAuc.website_url;
                    }
                    // Se tiver template vinculado
                    if (foundAuc.template_id) {
                      const foundT = templates.find(t => t.id === foundAuc.template_id);
                      if (foundT?.video_url && !foundAuc.website_url) {
                        setVideoUrl(foundT.video_url);
                        videoUrlRef.current = foundT.video_url;
                      }
                    }
                    showToast(`🐂 Leilão '${foundAuc.title}' carregado na sala!`);
                  }
                }}
                className="glass-input"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: '180px' }}
              >
                <option value="" style={{ background: '#0f172a' }}>📋 Trocar Leilão...</option>
                {auctions.map(a => (
                  <option key={a.id} value={String(a.id)} style={{ background: '#0f172a' }}>
                    {a.status === 'Ao Vivo' ? '🔴' : '🐂'} {a.title}
                  </option>
                ))}
              </select>
            )}

            {/* SELETOR DE GABARITOS */}
            {templates && templates.length > 0 && (
              <select
                value={selectedTemplateName}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="glass-input"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: '160px' }}
              >
                <option value="" style={{ background: '#0f172a' }}>📂 Gabarito...</option>
                {templates.map(t => (
                  <option key={t.id || t.name} value={t.name} style={{ background: '#0f172a' }}>
                    📐 {t.name}
                  </option>
                ))}
              </select>
            )}

            {activeCategories.length > 0 && (
              <span 
                onClick={() => setShowConfigDrawer(true)}
                style={{
                  fontSize: '0.72rem', color: '#a7f3d0', background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)', padding: '0.2rem 0.55rem',
                  borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem',
                  cursor: 'pointer'
                }}
                title="Clique para configurar categorias de alerta no menu"
              >
                <Bell size={12} color="#34d399" />
                Alertas: {activeCategories.slice(0, 2).join(', ')}{activeCategories.length > 2 ? ` (+${activeCategories.length - 2})` : ''}
              </span>
            )}
          </div>

          {/* CONTROLES RÁPIDOS E ÍCONE DO MENU LATERAL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            
            {/* BOTÃO MONITORAR COMPACTO */}
            <button 
              onClick={handleToggleScanning}
              className={scanning ? "btn-gradient btn-monitor-stop" : "btn-gradient btn-monitor-active"}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px' }}
            >
              {scanning ? <Square size={13} /> : <Play size={13} />}
              {scanning ? '⏹️ Parar' : '▶️ IA'}
            </button>

            {/* STATUS BADGE LATÊNCIA */}
            {scanning && lastScanMs !== null && (
              <span style={{ 
                fontSize: '0.7rem', color: '#34d399', 
                background: 'rgba(52, 211, 153, 0.12)', 
                padding: '0.25rem 0.5rem', borderRadius: '6px', 
                border: '1px solid rgba(52, 211, 153, 0.25)', fontWeight: 700 
              }}>
                ⚡ {lastScanMs}ms
              </span>
            )}

            {/* BOTÃO VISIBILIDADE DO HISTÓRICO */}
            <button 
              onClick={toggleShowHistory}
              className="btn-secondary"
              style={{
                padding: '0.35rem 0.65rem', fontSize: '0.78rem', fontWeight: 700,
                color: showHistory ? '#38bdf8' : '#94a3b8',
                borderColor: showHistory ? 'rgba(56, 189, 248, 0.4)' : 'var(--border-subtle)',
                background: showHistory ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '0.3rem'
              }}
              title={showHistory ? "Ocultar Histórico" : "Exibir Histórico"}
            >
              {showHistory ? <Eye size={15} /> : <EyeOff size={15} />}
              <span>{showHistory ? "Histórico Visível" : "Histórico Oculto"}</span>
            </button>

            {/* BOTÃO DO MENU LATERAL SLIDE-OVER */}
            <button 
              onClick={() => setShowConfigDrawer(true)}
              className="btn-secondary"
              style={{
                padding: '0.35rem 0.65rem', fontSize: '0.78rem', fontWeight: 700,
                color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.4)',
                background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', gap: '0.3rem'
              }}
              title="Abrir Menu Lateral de Configurações"
            >
              <Sliders size={15} />
              <span>⚙️ Menu</span>
            </button>
          </div>

        </div>
      </div>

      {/* ÁREA PRINCIPAL: PLAYER DE VÍDEO (ESQUERDA) + DADOS EM DESTAQUE (DIREITA) */}
      <div className="bidding-room-grid">
        
        {/* PLAYER DE VÍDEO + BOTÃO ATALHO ROI E TEATRO */}
        <div className={`glass-panel ${isTheaterMode ? 'mobile-theater-mode' : 'mobile-player-card'}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: '16px' }}>
          
          {/* HEADER DO PLAYER E BOTÕES DE CONTROLE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setViewMode('player')}
                style={{
                  background: viewMode === 'player' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  border: viewMode === 'player' ? '1px solid #818cf8' : '1px solid transparent',
                  color: viewMode === 'player' ? '#fff' : 'var(--text-muted)',
                  padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                }}
              >
                <Tv size={14} /> Player YouTube
              </button>
              <button 
                onClick={() => setViewMode('frame')}
                style={{
                  background: viewMode === 'frame' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  border: viewMode === 'frame' ? '1px solid #818cf8' : '1px solid transparent',
                  color: viewMode === 'frame' ? '#fff' : 'var(--text-muted)',
                  padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                }}
              >
                <Camera size={14} /> Captura IA
              </button>
              <button 
                onClick={handleStartScreenCapture}
                style={{
                  background: hasScreenCapture ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
                  border: hasScreenCapture ? '1px solid #34d399' : '1px solid #475569',
                  color: hasScreenCapture ? '#34d399' : '#e2e8f0',
                  padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                }}
                title="Vincular a tela do leilão para extração local sem peso no servidor"
              >
                {hasScreenCapture ? <Check size={14} /> : <Crop size={14} />} {hasScreenCapture ? 'Tela Vinculada' : 'Vincular Tela'}
              </button>

              {/* BOTÃO MAXIMIZAR VÍDEO (EXCELENTE PARA TELAS CELULAR) */}
              <button
                onClick={() => setIsTheaterMode(!isTheaterMode)}
                className="btn-secondary"
                style={{
                  padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700,
                  color: isTheaterMode ? '#f43f5e' : '#a855f7',
                  borderColor: isTheaterMode ? 'rgba(244, 63, 94, 0.4)' : 'rgba(168, 85, 247, 0.4)'
                }}
              >
                {isTheaterMode ? '✕ Fechar Teatro' : '📺 Maximizar Vídeo'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {/* BOTÃO TIRAR PRINT & COMENTAR NO HEADER */}
              <button 
                onClick={handleOpenPrintModal}
                disabled={isCapturingPrint}
                className="btn-secondary"
                style={{
                  padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 700,
                  color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)',
                  background: 'rgba(56, 189, 248, 0.15)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                }}
                title="Tirar print da tela da transmissão e adicionar comentários ao lote"
              >
                <Camera size={14} color="#38bdf8" />
                <MessageSquarePlus size={14} color="#38bdf8" />
                <span>Print & Comentar</span>
              </button>

              {/* SELETOR DE MOTOR: GEMINI 2.0 VISION VS OCR */}
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', padding: '0.2rem', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.3)', gap: '0.15rem' }}>
                <button
                  onClick={() => setEngineMode('gemini')}
                  style={{
                    padding: '0.25rem 0.55rem', fontSize: '0.72rem', fontWeight: 800, border: 'none', borderRadius: '7px', cursor: 'pointer',
                    background: engineMode === 'gemini' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'transparent',
                    color: engineMode === 'gemini' ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem'
                  }}
                  title="Leitura Inteligente por Visão Computacional (Zero Calibração)"
                >
                  <Sparkles size={12} /> ✨ Gemini Vision
                </button>
                <button
                  onClick={() => setEngineMode('ocr')}
                  style={{
                    padding: '0.25rem 0.55rem', fontSize: '0.72rem', fontWeight: 700, border: 'none', borderRadius: '7px', cursor: 'pointer',
                    background: engineMode === 'ocr' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                    color: engineMode === 'ocr' ? '#38bdf8' : '#94a3b8'
                  }}
                  title="Leitura por Caixas/Coordenadas (OCR Clássico)"
                >
                  OCR Caixas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const saved = localStorage.getItem('gemini_api_key') || '';
                    setGeminiApiKey(saved);
                    setTestingKeyStatus(null);
                    setTestingKeyMsg('');
                    setShowApiKeyModal(true);
                  }}
                  className="btn-secondary"
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    background: 'rgba(56, 189, 248, 0.15)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    borderRadius: '6px'
                  }}
                  title="Conferir ou alterar chave da API Gemini"
                >
                  <Settings size={13} color="#38bdf8" />
                  <span>⚙️ Chave</span>
                </button>
              </div>

              {/* BOTÃO CALIBRAÇÃO DIRETA NA SALA AO VIVO (SE MODO OCR ATIVO) */}
              {engineMode === 'ocr' && (
                <button 
                  onClick={handleStartInRoomCalib}
                  className="btn-gradient"
                  style={{
                    padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                  }}
                  title="Congelar a tela atual e desenhar as caixas de leitura diretamente aqui na sala"
                >
                  <Target size={14} />
                  <span>🎯 Calibrar na Tela</span>
                </button>
              )}

              <label className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                📁 Print
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* SELETOR DE CANAIS AO VIVO EM ALTA DEFINIÇÃO */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', background: 'rgba(15, 23, 42, 0.6)', padding: '0.4rem 0.6rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              📡 Canais Ao Vivo:
            </span>
            {LIVE_AUCTION_CHANNELS.map(ch => (
              <button
                key={ch.id}
                onClick={() => {
                  setVideoUrl(ch.url);
                  setSelectedTemplateName(ch.name.replace(/^[^\w]+/, '').trim());
                  showToast(`📡 Conectando a ${ch.name}...`);
                }}
                className="btn-secondary"
                style={{
                  padding: '0.25rem 0.55rem', fontSize: '0.72rem', fontWeight: 700,
                  background: videoUrl === ch.url ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: videoUrl === ch.url ? '#38bdf8' : '#cbd5e1',
                  borderColor: videoUrl === ch.url ? '#38bdf8' : 'rgba(255,255,255,0.1)'
                }}
              >
                {ch.name}
              </button>
            ))}
          </div>

          {/* CONTAINER DO PLAYER DE VÍDEO DE COM BORDAS ARREDONDADAS */}
          <div className="responsive-video-container" style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: '14px', overflow: 'hidden', background: '#000', border: '1px solid var(--border-subtle)' }}>
            
            {/* 1. Player Nativo HLS (.m3u8) para Canal do Boi, Canal Rural, Terra Viva, etc. */}
            {streamType === 'hls' && (
              <video
                ref={nativeVideoRef}
                controls
                autoPlay
                playsInline
                crossOrigin="anonymous"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: viewMode === 'player' ? 'block' : 'none' }}
              />
            )}

            {/* 2. YouTube IFrame Player (Conexão Direta e Confiável) */}
            {streamType === 'youtube' && (
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                display: (viewMode === 'player') ? 'block' : 'none'
              }}>
                {currentVideoId ? (
                  <iframe
                    key={currentVideoId}
                    src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&mute=1&enablejsapi=1&rel=0`}
                    title="Transmissão do Leilão"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', gap: '0.5rem', background: '#0f172a' }}>
                    <Tv size={40} style={{ opacity: 0.4 }} />
                    <span>Cole o link do YouTube ou escolha um leilão acima</span>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'player' && streamType === 'youtube' && !currentVideoId && !videoUrl && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', gap: '0.5rem' }}>
                <Tv size={40} style={{ opacity: 0.4 }} />
                <span>Escolha um Canal Ao Vivo acima ou cole um link do leilão</span>
              </div>
            )}

            {viewMode === 'frame' && capturedFrameImage && (
              <img 
                src={capturedFrameImage} 
                alt="Frame Capturado ao Vivo"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}

            {viewMode === 'frame' && !capturedFrameImage && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', gap: '0.5rem' }}>
                <Camera size={40} style={{ opacity: 0.4 }} />
                <span>Inicie o monitoramento ou cole um print com Ctrl+V</span>
              </div>
            )}

            {/* PIP / MINIATURA DO FRAME SENDO LIDO PELA IA */}
            {capturedFrameImage && viewMode === 'player' && (
              <div style={{
                position: 'absolute', bottom: '12px', right: '12px', zIndex: 30,
                width: '120px', height: '68px', borderRadius: '8px', overflow: 'hidden',
                border: '2px solid #38bdf8', boxShadow: '0 4px 14px rgba(0,0,0,0.8)',
                background: '#000'
              }}>
                <img src={capturedFrameImage} alt="Visão da IA" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '0.55rem', fontWeight: 800, color: '#34d399', background: 'rgba(0,0,0,0.7)', padding: '1px 3px', borderRadius: '3px' }}>
                  ● IA Lendo
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DA DIREITA: DADOS EM DESTAQUE E NOVO WIDGET MÉTRICAS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* CARD "LOTE ATUAL NA TELA" (TOTALMENTE REDESENHADO) */}
          <div className="glass-panel" style={{
            padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem',
            borderColor: scanning ? 'rgba(56, 189, 248, 0.4)' : 'var(--border-subtle)',
            borderRadius: '16px'
          }}>
            
            {/* TOPO DO CARD: NÚMERO DO LOTE GIGANTE NEON */}
            <div style={{ textAlign: 'center', padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '14px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  LOTE ATUAL NA TELA
                </span>
                <span className={currentLog?.status === 'Arrematado' ? 'badge-status-finished' : 'badge-status-running'} style={{ fontSize: '0.7rem' }}>
                  {currentLog ? (currentLog.status === 'Em Andamento' ? 'EM ANDAMENTO' : 'LANCE ATUAL') : 'EM ANDAMENTO'}
                </span>
              </div>

              {/* NÚMERO NEON GIGANTE */}
              <h2 className="neon-text-blue" style={{ fontSize: '3.2rem', fontWeight: 900, fontFamily: 'var(--font-mono)', margin: '0.1rem 0', lineHeight: 1 }}>
                # {ocrData?.["Número do Lote"] || currentLog?.lot_number || (scanning ? 'Lendo...' : '---')}
              </h2>

              <span style={{ fontSize: '0.85rem', color: '#a7f3d0', fontWeight: 700 }}>
                {ocrData?.["Categoria"] || currentLog?.category || (scanning ? 'Identificando...' : 'Aguardando Lote')}
              </span>
            </div>

            {/* CONTEÚDO DO LOTE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.65rem 0.85rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Descrição:</span>
                <strong style={{ fontSize: '0.88rem', color: '#f8fafc' }}>
                  {ocrData?.["Descrição do Lote"] || currentLog?.description || (scanning ? 'Processando transmissão...' : 'Nenhum lote detectado')}
                </strong>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.65rem 0.85rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Quantidade / Peso:</span>
                <strong style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>
                  {(ocrData?.["Quantidade"] ? `${ocrData["Quantidade"]} cab. ` : '') + (ocrData?.["Peso"] ? `| ${ocrData["Peso"]}` : '') || currentLog?.age || '---'}
                </strong>
              </div>

              {ocrData?.["Vendedor"] && (
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.65rem 0.85rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Origem / Vendedor:</span>
                  <strong style={{ fontSize: '0.88rem', color: '#38bdf8' }}>
                    {ocrData["Vendedor"]} {ocrData["Localização"] ? `(${ocrData["Localização"]})` : ''}
                  </strong>
                </div>
              )}

              {/* BASE DO CARD: VALOR DESTAQUE GIGANTE */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.85rem 1rem', borderRadius: '12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem'
              }}>
                <span style={{ fontSize: '0.82rem', color: '#a7f3d0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <DollarSign size={18} color="#34d399" /> Valor Atual:
                </span>
                <strong style={{ fontSize: '1.6rem', fontWeight: 900, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                  {ocrData?.["Preço Atual"] || currentLog?.price || (scanning ? 'Calculando...' : 'R$ ---')}
                </strong>
              </div>

              {/* BOTÃO PRINCIPAL DE TIRAR PRINT E ADICIONAR COMENTÁRIOS AO HISTÓRICO */}
              <button 
                onClick={handleOpenPrintModal}
                disabled={isCapturingPrint}
                className="btn-gradient"
                style={{
                  width: '100%', padding: '0.8rem 1rem', fontSize: '0.92rem', fontWeight: 800,
                  borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', background: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 100%)',
                  boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)', border: 'none', color: '#fff', cursor: 'pointer',
                  marginTop: '0.35rem', transition: 'all 0.2s ease'
                }}
              >
                <Camera size={18} />
                <MessageSquarePlus size={18} />
                <span>{isCapturingPrint ? "Capturando..." : "📸 Tirar Print & Comentar Lote"}</span>
              </button>

              {/* BOTÃO ENVIAR LANCE VIA WHATSAPP */}
              <button 
                onClick={handleSendWhatsAppBid}
                className="btn-gradient"
                style={{
                  width: '100%', padding: '0.8rem 1rem', fontSize: '0.92rem', fontWeight: 800,
                  borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)', border: 'none', color: '#fff', cursor: 'pointer',
                  marginTop: '0.5rem', transition: 'all 0.2s ease'
                }}
              >
                <MessageSquare size={18} />
                <span>📱 Enviar Lance via WhatsApp</span>
              </button>
            </div>

            {/* LEITURA DIRETA DO OCR */}
            {ocrData && Object.keys(ocrData).length > 0 && (
              <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a5b4fc', display: 'block', marginBottom: '0.35rem' }}>
                  ⚡ Leitura Direta OCR:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', fontSize: '0.72rem' }}>
                  {Object.entries(ocrData).map(([k, v]) => (
                    <div key={k} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.25rem 0.45rem', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{k}: </span>
                      <strong style={{ color: '#fff' }}>{v || '...'}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* WIDGET "MÉTRICAS DO LEILÃO" (NOVO) */}
          <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8' }}>
                <BarChart3 size={16} /> Métricas do Leilão
              </h4>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Estatísticas em Tempo Real</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {/* VENDA MÉDIA */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <TrendingUp size={12} color="#34d399" /> Venda Média (Kg):
                </span>
                <strong style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', display: 'block', marginTop: '0.2rem' }}>
                  R$ 14,80 <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/kg</span>
                </strong>
              </div>

              {/* LOTES VENDIDOS */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle2 size={12} color="#818cf8" /> Lotes Vendidos:
                </span>
                <strong style={{ fontSize: '1.15rem', fontWeight: 800, color: '#818cf8', display: 'block', marginTop: '0.2rem' }}>
                  {historyLogs.length > 0 ? historyLogs.length : 45} / 60
                </strong>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* SEÇÃO INFERIOR: TABELA DO HISTÓRICO DE LOTES VENDIDOS COM ALTO CONTRASTE */}
      {!showHistory ? (
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'rgba(15, 23, 42, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <EyeOff size={22} color="#64748b" />
            <div>
              <strong style={{ fontSize: '0.95rem', color: '#cbd5e1', display: 'block' }}>
                Histórico de Lotes & Arremates está Oculto
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Clique no botão ao lado para visualizar todos os registros do leilão.
              </span>
            </div>
          </div>
          <button 
            onClick={toggleShowHistory}
            className="btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)', background: 'rgba(56, 189, 248, 0.1)' }}
          >
            <Eye size={16} /> Exibir Histórico ({historyLogs.length})
          </button>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          {/* CABEÇALHO DO HISTÓRICO */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📋 Histórico de Lotes & Arremates
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Registro detalhado relacionando a data, horário e leiloeira das capturas processadas pela IA
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                onClick={toggleShowHistory}
                className="btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', color: '#94a3b8' }}
                title="Ocultar painel de histórico"
              >
                <EyeOff size={15} /> Ocultar
              </button>

              <button 
                onClick={handleExportCSV} 
                className="btn-secondary" 
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, color: '#4ade80', borderColor: 'rgba(74, 222, 128, 0.3)' }}
              >
                <FolderDown size={15} color="#4ade80" /> CSV
              </button>

              <button 
                onClick={() => setShowClearHistoryConfirm(true)}
                className="btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)', background: 'rgba(248, 113, 113, 0.08)' }}
                title="Limpar Histórico"
              >
                <Trash2 size={15} color="#f87171" /> Limpar Histórico
              </button>
            </div>
          </div>

          {/* BARRA DE FILTROS E PESQUISA DO HISTÓRICO */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(15, 23, 42, 0.4)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            {/* SELETOR DE LEILÃO / CANAL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '1 1 200px' }}>
              <Filter size={15} color="#818cf8" />
              <select 
                value={historyFilterChannel}
                onChange={(e) => setHistoryFilterChannel(e.target.value)}
                className="glass-input"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', fontWeight: 600 }}
              >
                <option value="all" style={{ background: '#0f172a' }}>🌐 Todos os Leilões ({historyLogs.length})</option>
                {templates.map(t => (
                  <option key={t.id || t.name} value={t.name} style={{ background: '#0f172a' }}>
                    🐂 Apenas: {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* FILTRO POR DATA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '0 1 180px' }}>
              <Calendar size={15} color="#38bdf8" />
              <input 
                type="date"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="glass-input"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
              />
              {historyDateFilter && (
                <button 
                  onClick={() => setHistoryDateFilter('')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem' }}
                  title="Limpar filtro de data"
                >
                  ✕
                </button>
              )}
            </div>

            {/* CAMPO DE BUSCA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '2 1 240px', position: 'relative' }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem' }} />
              <input 
                type="text"
                placeholder="Buscar por lote, raça, valor ou leilão..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="glass-input"
                style={{ paddingLeft: '2.2rem', paddingRight: '0.75rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.82rem' }}
              />
              {historySearchQuery && (
                <button 
                  onClick={() => setHistorySearchQuery('')}
                  style={{ position: 'absolute', right: '0.75rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* TABELA DE DADOS */}
          {filteredHistoryLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-dim)', fontSize: '0.88rem' }}>
              {historyLogs.length === 0 
                ? 'Nenhum lote registrado até o momento.' 
                : 'Nenhum registro encontrado para os filtros aplicados.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Lote #</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Nome do Leilão / Canal</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Categoria</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Descrição / Raça</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Idade/Peso</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Valor de Venda</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Comentários</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Print</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Data & Horário</th>
                    <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistoryLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                        {log.lot_number || '---'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <span style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                          🐂 {log.channel_name || 'Leilão'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <span style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {log.category || 'Geral'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', color: '#f8fafc', fontWeight: 500 }}>
                        {log.description || '---'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)' }}>
                        {log.age || '---'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#4ade80' }}>
                        {log.price || '---'}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', maxWidth: '180px' }}>
                        {log.notes ? (
                          <span style={{ fontSize: '0.78rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.35rem' }} title={log.notes}>
                            <MessageSquare size={13} color="#38bdf8" style={{ flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.notes}</span>
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>---</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        {log.frame_image ? (
                          <button 
                            onClick={() => setViewingPrintImage(log.frame_image)}
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.1)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                            title="Visualizar print da transmissão"
                          >
                            <Camera size={12} /> Ver Print
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>---</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <span className={log.status === 'Em Andamento' ? 'badge-status-running' : 'badge-status-finished'}>
                          {log.status === 'Em Andamento' ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                          {log.status || 'Arrematado'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 500 }}>
                        📅 {formatDateTime(log.created_at)}
                      </td>
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeleteLog(log.id)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.2rem' }}
                          title="Excluir Registro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA APAGAR HISTÓRICO */}
      {showClearHistoryConfirm && (
        <div className="side-drawer-overlay" onClick={() => setShowClearHistoryConfirm(false)} style={{ zIndex: 1100 }}>
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{
            maxWidth: '500px', width: '90%', margin: 'auto', padding: '1.75rem',
            borderRadius: '20px', border: '1px solid rgba(248, 113, 113, 0.4)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#f87171' }}>
              <AlertTriangle size={28} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                Limpar Histórico de Leilões
              </h3>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Esta ação removerá os registros selecionados do banco de dados permanentemente. Como deseja prosseguir?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {selectedTemplateName && (
                <button 
                  onClick={() => handleClearHistory(true)}
                  className="btn-secondary"
                  style={{
                    padding: '0.75rem 1rem', fontSize: '0.88rem', fontWeight: 700,
                    color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.4)',
                    background: 'rgba(248, 113, 113, 0.1)', justifyContent: 'flex-start'
                  }}
                >
                  🗑️ Apagar apenas o histórico do leilão "{selectedTemplateName}"
                </button>
              )}

              <button 
                onClick={() => handleClearHistory(false)}
                className="btn-gradient"
                style={{
                  padding: '0.75rem 1rem', fontSize: '0.88rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  justifyContent: 'flex-start'
                }}
              >
                ⚠️ Apagar TODO o histórico (Todos os leilões)
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowClearHistoryConfirm(false)}
                className="btn-secondary"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TIRAR PRINT E ADICIONAR COMENTÁRIOS AO HISTÓRICO */}
      {isPrintModalOpen && (
        <div className="side-drawer-overlay" onClick={() => setIsPrintModalOpen(false)} style={{ zIndex: 1200 }}>
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{
            maxWidth: '680px', width: '92%', margin: 'auto', padding: '1.5rem',
            borderRadius: '20px', border: '1px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)', display: 'flex', flexDirection: 'column', gap: '1.1rem',
            maxHeight: '92vh', overflowY: 'auto'
          }}>
            {/* HEADER DO MODAL */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '0.5rem', borderRadius: '10px', color: '#38bdf8' }}>
                  <Camera size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                    📸 Print & Comentários do Lote #{printLotDetails.lot_number}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Captura instantânea da transmissão e inclusão de observações no histórico
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsPrintModalOpen(false)}
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.6rem', borderRadius: '50%', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* PREVIEW DO PRINT CAPTURADO */}
            <div style={{ position: 'relative', width: '100%', height: '230px', background: '#000', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {capturedPrintB64 ? (
                <img 
                  src={capturedPrintB64} 
                  alt="Print da Transmissão"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '1rem' }}>
                  <Tv size={36} style={{ opacity: 0.5, marginBottom: '0.4rem' }} />
                  <p style={{ margin: 0, fontSize: '0.82rem' }}>Sem captura de imagem no momento. O registro será salvo com os dados numéricos e texto.</p>
                </div>
              )}
              <span style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem', background: 'rgba(15, 23, 42, 0.85)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                📷 Captura da Transmissão
              </span>
            </div>

            {/* FORMULÁRIO DE INFOS DO LOTE (EDITÁVEIS) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Lote #:
                </label>
                <input 
                  type="text" className="glass-input" 
                  value={printLotDetails.lot_number}
                  onChange={(e) => setPrintLotDetails({ ...printLotDetails, lot_number: e.target.value })}
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Categoria:
                </label>
                <input 
                  type="text" className="glass-input" 
                  value={printLotDetails.category}
                  onChange={(e) => setPrintLotDetails({ ...printLotDetails, category: e.target.value })}
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Descrição / Raça:
                </label>
                <input 
                  type="text" className="glass-input" 
                  value={printLotDetails.description}
                  onChange={(e) => setPrintLotDetails({ ...printLotDetails, description: e.target.value })}
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Valor de Venda / Lance:
                </label>
                <input 
                  type="text" className="glass-input" 
                  value={printLotDetails.price}
                  onChange={(e) => setPrintLotDetails({ ...printLotDetails, price: e.target.value })}
                  style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}
                />
              </div>
            </div>

            {/* CAMPO DE COMENTÁRIOS E OBSERVAÇÕES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MessageSquare size={16} color="#38bdf8" /> Comentários & Observações do Lote:
              </label>
              <textarea 
                className="glass-input"
                rows={3}
                placeholder="Digite aqui observações sobre o lote, lances, qualidade dos animais, vendedores..."
                value={printCommentText}
                onChange={(e) => setPrintCommentText(e.target.value)}
                style={{ padding: '0.75rem', fontSize: '0.85rem', lineHeight: 1.4, width: '100%', borderRadius: '10px' }}
              />
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.3rem' }}>
              <button 
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="btn-secondary"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSavePrintWithComment}
                className="btn-gradient"
                style={{ padding: '0.6rem 1.5rem', fontSize: '0.88rem', fontWeight: 800, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                💾 Salvar no Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX PARA VISUALIZAR PRINT SALVO NO HISTÓRICO */}
      {viewingPrintImage && (
        <div className="side-drawer-overlay" onClick={() => setViewingPrintImage(null)} style={{ zIndex: 1300 }}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', margin: 'auto', background: '#090d16', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(56, 189, 248, 0.4)', boxShadow: '0 25px 60px rgba(0,0,0,0.9)' }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setViewingPrintImage(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', padding: '0.4rem', borderRadius: '50%', cursor: 'pointer', zIndex: 10 }}
            >
              <X size={20} />
            </button>
            <img 
              src={viewingPrintImage} 
              alt="Print do Histórico" 
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '10px', display: 'block', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

      {/* MODAL DE CALIBRAÇÃO DIRETA NA SALA AO VIVO */}
      {isCalibratingInRoom && inRoomCalibImage && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(5, 8, 15, 0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#090d16', padding: '1.5rem', borderRadius: '18px', maxWidth: '1100px', width: '100%',
            maxHeight: '94vh', overflow: 'auto', border: '1px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 25px 70px rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            {/* CABEÇALHO DA CALIBRAÇÃO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '0.5rem', borderRadius: '10px', color: '#fff' }}>
                  <Target size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                    🎯 Calibração Direta na Tela do Leilão
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Desenhe os retângulos exatamente em cima dos dados do lote. 100% de precisão sem troca de telas.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={inRoomTemplateName} 
                  onChange={(e) => setInRoomTemplateName(e.target.value)} 
                  placeholder="Nome do Gabarito..."
                  style={{ width: '180px', padding: '0.4rem 0.65rem', fontSize: '0.85rem', fontWeight: 700 }}
                />
                <button 
                  onClick={() => setIsCalibratingInRoom(false)} 
                  className="btn-secondary" 
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '50%' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* BOTÕES DE ATALHO RÁPIDO E AÇÕES */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>+ Atalhos Rápidos:</span>
                <button onClick={() => handleInRoomAddPreset('lote')} className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#38bdf8', borderColor: '#38bdf8' }}>+ Lote</button>
                <button onClick={() => handleInRoomAddPreset('preco')} className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#34d399', borderColor: '#34d399' }}>+ Preço</button>
                <button onClick={() => handleInRoomAddPreset('desc')} className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#fbbf24', borderColor: '#fbbf24' }}>+ Descrição</button>
                <button onClick={() => handleInRoomAddPreset('idade')} className="btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', color: '#f472b6', borderColor: '#f472b6' }}>+ Idade/Peso</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  onClick={handleInRoomTestOcr} 
                  disabled={inRoomTestingOcr || inRoomFields.length === 0} 
                  className="btn-secondary" 
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)', background: 'rgba(56, 189, 248, 0.1)' }}
                >
                  <Sparkles size={15} />
                  {inRoomTestingOcr ? 'Testando...' : '🧪 Testar OCR na Imagem'}
                </button>
                <button 
                  onClick={handleInRoomSaveTemplate} 
                  disabled={inRoomSaving || inRoomFields.length === 0} 
                  className="btn-gradient" 
                  style={{ padding: '0.35rem 1rem', fontSize: '0.8rem', fontWeight: 800 }}
                >
                  <Check size={16} />
                  {inRoomSaving ? 'Salvando...' : '💾 Salvar e Ativar na Sala'}
                </button>
              </div>
            </div>

            {/* ÁREA DE DESENHO INTERATIVA (CANVAS SOBRE A IMAGEM) */}
            <div 
              style={{
                width: '100%', maxHeight: '52vh', display: 'flex', justifyContent: 'center',
                alignItems: 'center', background: '#000', borderRadius: '12px', overflow: 'hidden',
                border: '2px solid rgba(99, 102, 241, 0.3)', userSelect: 'none'
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  lineHeight: 0,
                  cursor: 'crosshair'
                }}
                onMouseDown={handleInRoomMouseDown}
                onMouseMove={handleInRoomMouseMove}
                onMouseUp={handleInRoomMouseUp}
                onTouchStart={handleInRoomMouseDown}
                onTouchMove={handleInRoomMouseMove}
                onTouchEnd={handleInRoomMouseUp}
              >
                <img 
                  ref={inRoomImgRef}
                  src={inRoomCalibImage} 
                  alt="Frame Congelado para Calibração" 
                  style={{ maxWidth: '100%', maxHeight: '52vh', objectFit: 'contain', display: 'block', pointerEvents: 'none' }} 
                />

                {/* RENDERIZAÇÃO DAS CAIXAS DESENHADAS */}
                {inRoomImgRef.current && inRoomFields.map((field, idx) => {
                  const img = inRoomImgRef.current;
                  const rect = img.getBoundingClientRect();
                  const natW = img.naturalWidth || inRoomCalibWidth || 640;
                  const natH = img.naturalHeight || inRoomCalibHeight || 360;

                  const refW = field.ref_w || natW;
                  const refH = field.ref_h || natH;
                  const scaleX = rect.width / refW;
                  const scaleY = rect.height / refH;

                  const left = field.x1 * scaleX;
                  const top = field.y1 * scaleY;
                  const width = (field.x2 - field.x1) * scaleX;
                  const height = (field.y2 - field.y1) * scaleY;

                  const colors = ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa'];
                  const boxColor = colors[idx % colors.length];

                  return (
                    <div
                      key={idx}
                      style={{
                        position: 'absolute',
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${width}px`,
                        height: `${height}px`,
                        border: `2px solid ${boxColor}`,
                        background: `${boxColor}22`,
                        pointerEvents: 'auto',
                        zIndex: 10
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{
                        position: 'absolute', top: '-22px', left: '-2px', background: boxColor, color: '#000',
                        fontSize: '0.68rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '4px 4px 0 0',
                        display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', lineHeight: 'normal'
                      }}>
                        <span>{field.nome}</span>
                        <button 
                          onClick={() => handleInRoomDeleteField(idx)}
                          style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* CAIXA ATUAL SENDO ARRASTADA */}
                {inRoomIsDrawing && inRoomStartPoint && inRoomDragPoint && (
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(inRoomStartPoint.displayX, inRoomDragPoint.displayX)}px`,
                    top: `${Math.min(inRoomStartPoint.displayY, inRoomDragPoint.displayY)}px`,
                    width: `${Math.abs(inRoomDragPoint.displayX - inRoomStartPoint.displayX)}px`,
                    height: `${Math.abs(inRoomDragPoint.displayY - inRoomStartPoint.displayY)}px`,
                    border: '2px dashed #f43f5e',
                    background: 'rgba(244, 63, 94, 0.25)',
                    pointerEvents: 'none',
                    zIndex: 20
                  }} />
                )}
              </div>
            </div>

            {/* RESULTADOS DO TESTE DE OCR EM TEMPO REAL COM PREVIEW DO RECORTE */}
            {inRoomOcrResults && (
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Sparkles size={14} /> Leitura OCR Instantânea & Imagens Recortadas:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {Object.entries(inRoomOcrResults).map(([k, v]) => (
                    <div key={k} style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.45rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '130px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{k}:</span>
                        <strong style={{ color: v ? '#34d399' : '#f43f5e' }}>{v || '---'}</strong>
                      </div>
                      {inRoomOcrCrops && inRoomOcrCrops[k] && (
                        <div style={{ border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px', overflow: 'hidden', background: '#000', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={inRoomOcrCrops[k]} alt={`Recorte de ${k}`} style={{ maxHeight: '35px', maxWidth: '100%', objectFit: 'contain' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LISTA DE CAMPOS CALIBRADOS */}
            {inRoomFields.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Campos ativos ({inRoomFields.length}):</span>
                {inRoomFields.map((f, i) => (
                  <span key={i} style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    {f.nome}
                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleInRoomDeleteField(i)} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR GEMINI API KEY */}
      {showApiKeyModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(5, 8, 15, 0.9)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: '#0f172a', padding: '1.75rem', borderRadius: '18px', maxWidth: '520px', width: '100%',
            border: '1px solid rgba(99, 102, 241, 0.4)', boxShadow: '0 25px 70px rgba(0,0,0,0.9)',
            display: 'flex', flexDirection: 'column', gap: '1.2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Sparkles size={22} color="#a855f7" />
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
                  Configuração da Chave Gemini Vision
                </h3>
              </div>
              <button onClick={() => setShowApiKeyModal(false)} className="btn-secondary" style={{ padding: '0.35rem 0.55rem', borderRadius: '50%' }}>
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
              O <strong>Gemini 2.0 Flash Vision</strong> lê automaticamente o lote, lance, raça e peso da transmissão sem necessidade de desenhar caixas.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                <span>Chave da API Gemini (Google AI Studio):</span>
                <span style={{ fontSize: '0.72rem', color: geminiApiKey ? '#34d399' : '#f43f5e' }}>
                  {geminiApiKey ? '● Chave configurada' : '○ Nenhuma chave salva'}
                </span>
              </label>
              
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showKeyPassword ? "text" : "password"}
                  className="glass-input"
                  value={geminiApiKey}
                  onChange={(e) => {
                    setGeminiApiKey(e.target.value);
                    setTestingKeyStatus(null);
                    setTestingKeyMsg('');
                  }}
                  placeholder="AIzaSy..."
                  style={{ width: '100%', padding: '0.65rem 2.5rem 0.65rem 0.85rem', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowKeyPassword(!showKeyPassword)}
                  style={{
                    position: 'absolute', right: '0.65rem', background: 'none', border: 'none',
                    color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center'
                  }}
                  title={showKeyPassword ? "Ocultar chave" : "Mostrar chave"}
                >
                  {showKeyPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Obtenha sua chave gratuita em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>Google AI Studio</a>
                </span>
                <button
                  type="button"
                  onClick={handleTestApiKey}
                  disabled={testingKeyStatus === 'testing'}
                  className="btn-secondary"
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                >
                  {testingKeyStatus === 'testing' ? 'Testando...' : '🧪 Testar Chave'}
                </button>
              </div>

              {testingKeyMsg && (
                <div style={{
                  padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                  background: testingKeyStatus === 'valid' ? 'rgba(16, 185, 129, 0.15)' : (testingKeyStatus === 'testing' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(244, 63, 94, 0.15)'),
                  color: testingKeyStatus === 'valid' ? '#34d399' : (testingKeyStatus === 'testing' ? '#38bdf8' : '#f87171'),
                  border: `1px solid ${testingKeyStatus === 'valid' ? 'rgba(16, 185, 129, 0.3)' : (testingKeyStatus === 'testing' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(244, 63, 94, 0.3)')}`
                }}>
                  {testingKeyMsg}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => setShowApiKeyModal(false)} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                Fechar
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.setItem('gemini_api_key', geminiApiKey.trim());
                    showToast('✨ Chave do Gemini salva com sucesso!');
                    setShowApiKeyModal(false);
                  } catch (e) {}
                }}
                className="btn-gradient"
                style={{ padding: '0.5rem 1.25rem', fontWeight: 800 }}
              >
                Salvar Chave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CROP DA TELA */}
      {showCropModal && capturedRawImage && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '16px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ color: '#f8fafc', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Crop size={24} color="#38bdf8" />
              Recorte a Área do Vídeo
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Arraste o mouse para criar um retângulo de seleção. <strong>Ajuste as bordas para que fiquem EXATAMENTE em cima do vídeo do leilão</strong>.
            </p>
            
            <div style={{ position: 'relative', border: '2px dashed #475569', borderRadius: '8px', overflow: 'hidden' }}>
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                keepSelection={true}
              >
                <img 
                  ref={rawImgRef}
                  src={capturedRawImage} 
                  alt="Tela Completa" 
                  style={{ maxHeight: '60vh', display: 'block' }} 
                />
              </ReactCrop>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button 
                className="btn-secondary"
                onClick={() => { setShowCropModal(false); setHasScreenCapture(false); }}
              >
                Cancelar
              </button>
              <button 
                className="btn-gradient"
                onClick={handleConfirmCrop}
              >
                Confirmar Recorte Perfeito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ELEMENTOS OCULTOS PARA PROCESSAMENTO DE VÍDEO E CAPTURA DE FRAMES */}
      <video ref={screenVideoRef} style={{ display: 'none' }} autoPlay playsInline muted />
      <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />

    </div>
  );
}
