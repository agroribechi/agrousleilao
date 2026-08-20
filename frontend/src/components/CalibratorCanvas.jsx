import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Save, Trash2, Undo, Play, Sparkles, AlertCircle, 
  CheckCircle, Tag, FolderOpen, Scissors, Monitor, Plus, Edit2, Tv
} from 'lucide-react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Extrai o ID de qualquer formato de link do YouTube
export const extractYouTubeId = (urlStr) => {
  if (!urlStr) return null;
  const str = urlStr.trim();
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/))([^#&?\n]+)/;
  const match = str.match(regExp);
  if (match && match[1]) return match[1];
  if (str.length === 11 && !str.includes('/') && !str.includes('.')) return str;
  return null;
};

export default function CalibratorCanvas({ 
  API_BASE, 
  user, 
  templates = [], 
  auctions = [], 
  initialTemplate = null, 
  onTemplateSaved 
}) {
  const [selectedAuctionId, setSelectedAuctionId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [channelName, setChannelName] = useState('');
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=fHg377zdhms');
  const [logoUrl, setLogoUrl] = useState('');
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(10);
  
  const [loadingFrame, setLoadingFrame] = useState(false);
  const [frameData, setFrameData] = useState(null); // { image, width, height }
  
  const [fields, setFields] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [currentDragPoint, setCurrentDragPoint] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [ocrResults, setOcrResults] = useState(null);
  const [ocrCrops, setOcrCrops] = useState({});
  const [testingOcr, setTestingOcr] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // States para o Crop & Screen Capture
  const [showPlayer, setShowPlayer] = useState(false);
  const [capturedRawImage, setCapturedRawImage] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const rawImgRef = useRef(null);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Carrega template inicial se passado via props
  useEffect(() => {
    if (initialTemplate) {
      setChannelName(initialTemplate.name || '');
      setLogoUrl(initialTemplate.logo_url || '');
      setFields(initialTemplate.fields || []);
      if (initialTemplate.video_url) setUrl(initialTemplate.video_url);
      if (initialTemplate.id) setSelectedTemplateId(String(initialTemplate.id));
    }
  }, [initialTemplate]);

  // Seletor de Leilão Cadastrado
  const handleSelectAuction = (auctionId) => {
    setSelectedAuctionId(auctionId);
    if (!auctionId) return;
    const auc = auctions.find(a => String(a.id) === String(auctionId));
    if (auc) {
      setChannelName(auc.title || '');
      if (auc.logo_url) setLogoUrl(auc.logo_url);
      if (auc.website_url && auc.website_url.includes('youtu')) {
        setUrl(auc.website_url);
      }
      // Se tiver template_id vinculado
      if (auc.template_id) {
        const foundT = templates.find(t => t.id === auc.template_id);
        if (foundT) {
          setFields(foundT.fields || []);
          if (foundT.video_url) setUrl(foundT.video_url);
        }
      }
      showToast(`Leilão '${auc.title}' selecionado para calibração.`);
    }
  };

  // Seletor de Gabarito/Template
  const handleSelectTemplateChange = (e) => {
    const val = e.target.value;
    setSelectedTemplateId(val);
    if (!val) {
      setChannelName('');
      setLogoUrl('');
      setFields([]);
      return;
    }
    const found = templates.find(t => String(t.id || t.name) === val);
    if (found) {
      setChannelName(found.name);
      setLogoUrl(found.logo_url || '');
      setFields(found.fields || []);
      if (found.video_url) setUrl(found.video_url);
      showToast(`Gabarito '${found.name}' carregado (${found.fields?.length || 0} campos).`);
    }
  };

  const handleLogoFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoUrl(event.target.result);
        showToast('Logotipo carregado com sucesso!');
      };
      reader.readAsDataURL(file);
    }
  };

  // Busca o Frame puro do YouTube diretamente pelo Backend
  const handleFetchBackendFrame = async () => {
    if (!url || !url.trim()) {
      alert('Por favor, informe a URL ou ID do vídeo do YouTube.');
      return;
    }
    setLoadingFrame(true);
    try {
      const res = await fetch(`${API_BASE}/api/stream/frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          minutes: Number(minutes) || 0,
          seconds: Number(seconds) || 0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao capturar frame do servidor.');
      
      setFrameData({
        image: data.image,
        width: data.width,
        height: data.height
      });
      showToast(`Frame capturado com sucesso no tempo ${minutes}m ${seconds}s!`);
    } catch (err) {
      if (err.message.includes('bot') || err.message.includes('confirm you') || err.message.includes('extração') || err.message.includes('400')) {
        showToast('⚠️ YouTube solicitou confirmação de navegador. Abrindo Player para captura direta...');
        setShowPlayer(true);
      } else {
        alert(`Erro ao buscar frame: ${err.message}`);
      }
    } finally {
      setLoadingFrame(false);
    }
  };

  // Captura a Tela
  const handleStartCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "browser" }, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const base64 = canvas.toDataURL('image/jpeg', 0.9);
          setCapturedRawImage(base64);
          
          stream.getTracks().forEach(t => t.stop());
          setShowPlayer(false);
          showToast('Tela capturada! Agora recorte APENAS a área do vídeo.');
        }, 500);
      };
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        alert(`Erro ao capturar tela: ${err.message}`);
      }
    }
  };

  // Confirma o Crop e salva como frameData
  const handleConfirmCrop = () => {
    if (!completedCrop || !completedCrop.width || !completedCrop.height || !rawImgRef.current) {
      alert("Por favor, arraste para selecionar a área de recorte antes de confirmar.");
      return;
    }
    const canvas = document.createElement('canvas');
    const scaleX = rawImgRef.current.naturalWidth / rawImgRef.current.width;
    const scaleY = rawImgRef.current.naturalHeight / rawImgRef.current.height;
    
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;
    
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      rawImgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
    setFrameData({ image: croppedBase64, width: Math.round(cropWidth), height: Math.round(cropHeight) });
    setCapturedRawImage(null);
    setCrop(undefined);
    showToast('Recorte salvo com sucesso! Agora ajuste ou desenhe os campos.');
  };

  const handleFileUploadCalibrator = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const b64 = event.target.result;
        const img = new Image();
        img.onload = () => {
          setFrameData({ image: b64, width: img.width, height: img.height });
          showToast('Print carregado com sucesso!');
        };
        img.src = b64;
      };
      reader.readAsDataURL(file);
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Coordenadas de desenho
  const getClickCoords = (e) => {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    }

    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;

    const scaleX = (frameData?.width || 640) / rect.width;
    const scaleY = (frameData?.height || 360) / rect.height;

    return {
      x: Math.round(displayX * scaleX),
      y: Math.round(displayY * scaleY),
      displayX,
      displayY,
      rectWidth: rect.width,
      rectHeight: rect.height
    };
  };

  const handleMouseDown = (e) => {
    if (!frameData) return;
    const coords = getClickCoords(e);
    if (!coords) return;
    setStartPoint(coords);
    setCurrentDragPoint(coords);
    setIsDrawing(true);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const coords = getClickCoords(e);
    if (coords) setCurrentDragPoint(coords);
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || !startPoint) return;
    const endPoint = getClickCoords(e) || currentDragPoint;
    setIsDrawing(false);
    if (!endPoint) return;

    const x1 = Math.min(startPoint.x, endPoint.x);
    const y1 = Math.min(startPoint.y, endPoint.y);
    const x2 = Math.max(startPoint.x, endPoint.x);
    const y2 = Math.max(startPoint.y, endPoint.y);

    if (Math.abs(x2 - x1) < 10 || Math.abs(y2 - y1) < 10) {
      setStartPoint(null);
      setCurrentDragPoint(null);
      return;
    }

    const defaultNames = ["Número do Lote", "Preço Atual", "Descrição do Lote", "Idade / Peso"];
    const fieldName = defaultNames[fields.length] || `Campo ${fields.length + 1}`;

    const newField = {
      nome: fieldName,
      x1, y1, x2, y2,
      ref_w: frameData.width,
      ref_h: frameData.height
    };

    setFields([...fields, newField]);
    setStartPoint(null);
    setCurrentDragPoint(null);
  };

  // Atalhos Rápidos de Caixas
  const handleAddPresetBox = (fieldType) => {
    const w = frameData?.width || 1280;
    const h = frameData?.height || 720;

    let preset = { nome: "Campo", x1: Math.round(w * 0.05), y1: Math.round(h * 0.1), x2: Math.round(w * 0.35), y2: Math.round(h * 0.25), ref_w: w, ref_h: h };
    if (fieldType === 'lote') {
      preset = { nome: "Número do Lote", x1: Math.round(w * 0.04), y1: Math.round(h * 0.05), x2: Math.round(w * 0.38), y2: Math.round(h * 0.22), ref_w: w, ref_h: h };
    } else if (fieldType === 'preco') {
      preset = { nome: "Preço Atual", x1: Math.round(w * 0.55), y1: Math.round(h * 0.72), x2: Math.round(w * 0.96), y2: Math.round(h * 0.92), ref_w: w, ref_h: h };
    } else if (fieldType === 'desc') {
      preset = { nome: "Descrição do Lote", x1: Math.round(w * 0.04), y1: Math.round(h * 0.65), x2: Math.round(w * 0.96), y2: Math.round(h * 0.85), ref_w: w, ref_h: h };
    } else if (fieldType === 'idade') {
      preset = { nome: "Idade / Peso", x1: Math.round(w * 0.04), y1: Math.round(h * 0.28), x2: Math.round(w * 0.45), y2: Math.round(h * 0.42), ref_w: w, ref_h: h };
    }

    setFields([...fields, preset]);
    showToast(`Caixa '${preset.nome}' adicionada ao gabarito!`);
  };

  const handleDeleteField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleUndo = () => {
    if (fields.length > 0) setFields(fields.slice(0, -1));
  };

  const handleClear = () => {
    setFields([]);
    setOcrResults(null);
  };

  // Testar OCR em todas as ROIs
  const handleTestOCR = async () => {
    if (fields.length === 0) {
      alert("Adicione ao menos 1 campo antes de testar o OCR.");
      return;
    }
    if (!frameData) {
      alert("Carregue uma imagem ou extraia um frame do YouTube primeiro.");
      return;
    }
    setTestingOcr(true);
    setOcrResults(null);
    setOcrCrops({});

    try {
      const res = await fetch(`${API_BASE}/api/ocr/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: frameData.image,
          fields
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao processar OCR.');

      setOcrResults(data.results || {});
      setOcrCrops(data.debug_crops || {});
      showToast('✅ OCR processado com sucesso em todas as caixas!');
    } catch (err) {
      alert(`Erro no OCR: ${err.message}`);
    } finally {
      setTestingOcr(false);
    }
  };

  // Salvar Template no Backend
  const handleSaveTemplate = async () => {
    if (!channelName.trim()) {
      alert('Por favor, informe um nome para o Gabarito / Leiloeira.');
      return;
    }
    if (fields.length === 0) {
      alert('Adicione ao menos 1 campo ROI antes de salvar.');
      return;
    }

    try {
      const token = localStorage.getItem('leilao_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          name: channelName.trim(), 
          video_url: url,
          logo_url: logoUrl,
          fields 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao salvar template.');

      showToast(`🎯 Gabarito '${channelName}' salvo com sucesso!`);
      if (onTemplateSaved) onTemplateSaved();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  const videoId = extractYouTubeId(url);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100,
          background: 'rgba(16, 185, 129, 0.95)', color: '#fff', padding: '0.85rem 1.5rem',
          borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)', fontWeight: 700
        }}>
          <CheckCircle size={20} />
          {toastMsg}
        </div>
      )}

      {/* BARRA UNIFICADA DE SELEÇÃO DE LEILÃO E GABARITO */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Camera size={20} color="#34d399" />
            Calibrador de Caixas ROI do Leilão
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* SELETOR DE LEILÕES */}
            {auctions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Leilão:</span>
                <select 
                  value={selectedAuctionId} 
                  onChange={(e) => handleSelectAuction(e.target.value)}
                  className="glass-input"
                  style={{ width: '200px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                >
                  <option value="" style={{ background: '#0f172a' }}>Escolha um Leilão...</option>
                  {auctions.map(a => (
                    <option key={a.id} value={String(a.id)} style={{ background: '#0f172a' }}>
                      🐂 {a.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* SELETOR DE GABARITOS EXISTENTES */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Gabarito:</span>
              <select 
                value={selectedTemplateId} 
                onChange={handleSelectTemplateChange}
                className="glass-input"
                style={{ width: '220px', padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
              >
                <option value="" style={{ background: '#0f172a' }}>➕ Criar Novo Gabarito...</option>
                {templates.map(t => (
                  <option key={t.id || t.name} value={String(t.id || t.name)} style={{ background: '#0f172a' }}>
                    📂 {t.name} ({t.fields ? t.fields.length : 0} campos)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* INPUTS DE LINK DO YOUTUBE E TEMPO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Link do Vídeo no YouTube</label>
            <input 
              type="text" className="glass-input" 
              value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Minutos</label>
            <input 
              type="number" className="glass-input" 
              value={minutes} onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Segundos</label>
            <input 
              type="number" className="glass-input" 
              value={seconds} onChange={(e) => setSeconds(e.target.value)}
            />
          </div>
        </div>

        {/* BOTÕES DE EXTRAÇÃO DE FRAME */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleFetchBackendFrame} 
            disabled={loadingFrame} 
            className="btn-gradient" 
            style={{ flex: 1, minWidth: '220px' }}
          >
            {loadingFrame ? 'Extraindo Frame do YouTube...' : <><Camera size={18} /> Extrair Frame do YouTube</>}
          </button>

          <button 
            onClick={() => setShowPlayer(true)} 
            className="btn-secondary" 
            style={{ flex: 1, minWidth: '180px' }}
          >
            <Play size={18} /> Abrir Player YouTube
          </button>
          
          <button onClick={handleStartCapture} className="btn-secondary" style={{ flex: 1, minWidth: '160px', backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>
            <Monitor size={18} /> Capturar Tela
          </button>

          <label className="btn-secondary" style={{ flex: 1, minWidth: '150px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
            <FolderOpen size={18} style={{ marginRight: '0.4rem' }} />
            📁 Enviar Print
            <input type="file" accept="image/*" onChange={handleFileUploadCalibrator} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* MODAL DO PLAYER YOUTUBE */}
      {showPlayer && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem'
        }}>
          <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '12px', width: '100%', maxWidth: '900px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Play size={20} color="#f43f5e" /> Pausar no momento exato e capturar tela
              </h3>
              <button onClick={() => setShowPlayer(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', background: '#000', borderRadius: '8px' }}>
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&start=${(Number(minutes) * 60) + Number(seconds)}`}
                  frameBorder="0"
                  allow="autoplay; fullscreen"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                ></iframe>
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  Link de vídeo inválido
                </div>
              )}
            </div>
            
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
              <button onClick={handleStartCapture} className="btn-gradient" style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>
                <Monitor size={20} /> Capturar Tela Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TELA DE RECORTE (CROP) */}
      {capturedRawImage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050,
          background: 'rgba(15, 23, 42, 0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', overflowY: 'auto'
        }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '12px', width: '100%', maxWidth: '1000px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Scissors size={20} color="#38bdf8" /> Passo Final: Recorte a Imagem
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              ⚠️ Recorte **EXATAMENTE** a área do vídeo (sem barras de navegador ou chat).
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', background: '#000', padding: '1rem', borderRadius: '8px' }}>
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c)}
                aspect={16 / 9}
              >
                <img 
                  ref={rawImgRef}
                  src={capturedRawImage} 
                  alt="Tela Capturada" 
                  style={{ maxHeight: '60vh', width: 'auto' }}
                />
              </ReactCrop>
            </div>
            
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setCapturedRawImage(null)} className="btn-secondary" style={{ color: '#f87171' }}>Cancelar</button>
              <button onClick={handleConfirmCrop} className="btn-gradient">
                <CheckCircle size={18} /> Confirmar Recorte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA DE CALIBRAÇÃO E CANVAS DE MARCAÇÃO */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }}>
        
        {/* PAINEL DA IMAGEM COM CAIXAS ROI OVERLAY */}
        <div className="glass-panel" style={{ padding: '1.25rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Tag size={16} /> Arraste na imagem para desenhar o retângulo ROI do campo
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleUndo} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                <Undo size={14} /> Desfazer
              </button>
              <button onClick={handleClear} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#f87171' }}>
                <Trash2 size={14} /> Limpar
              </button>
            </div>
          </div>

          {/* ATALHOS RÁPIDOS DE CAIXAS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.85rem', background: 'rgba(15, 23, 42, 0.4)', padding: '0.5rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>⚡ Atalhos:</span>
            <button onClick={() => handleAddPresetBox('lote')} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8' }}>
              + Caixa Lote
            </button>
            <button onClick={() => handleAddPresetBox('preco')} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>
              + Caixa Preço
            </button>
            <button onClick={() => handleAddPresetBox('desc')} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#facc15' }}>
              + Caixa Descrição
            </button>
            <button onClick={() => handleAddPresetBox('idade')} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#c084fc' }}>
              + Caixa Idade/Peso
            </button>
          </div>

          {frameData ? (
            <div 
              ref={containerRef}
              style={{ position: 'relative', userSelect: 'none', cursor: 'crosshair', borderRadius: '8px', overflow: 'hidden', touchAction: 'none' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            >
              <img 
                ref={imgRef}
                src={frameData.image} 
                alt="Frame do Leilão" 
                style={{ width: '100%', height: 'auto', display: 'block', pointerEvents: 'none' }}
              />

              {/* RENDERIZAÇÃO DAS CAIXAS DE CAMPOS DEFINIDOS */}
              {imgRef.current && fields.map((field, idx) => {
                const rect = imgRef.current.getBoundingClientRect();
                const scaleX = rect.width / (frameData.width || 640);
                const scaleY = rect.height / (frameData.height || 360);

                const left = field.x1 * scaleX;
                const top = field.y1 * scaleY;
                const width = Math.max(10, (field.x2 - field.x1) * scaleX);
                const height = Math.max(10, (field.y2 - field.y1) * scaleY);

                return (
                  <div key={idx} style={{
                    position: 'absolute',
                    left: `${left}px`, top: `${top}px`,
                    width: `${width}px`, height: `${height}px`,
                    border: '2px solid #6366f1',
                    background: 'rgba(99, 102, 241, 0.25)',
                    boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)',
                    pointerEvents: 'none',
                    display: 'flex', alignItems: 'flex-start', padding: '2px 6px'
                  }}>
                    <span style={{
                      background: '#4f46e5', color: '#fff', fontSize: '0.7rem',
                      fontWeight: 700, borderRadius: '4px', padding: '1px 5px'
                    }}>
                      {field.nome}
                    </span>
                  </div>
                );
              })}

              {/* CAIXA DE ARRASTE EM TEMPO REAL */}
              {isDrawing && startPoint && currentDragPoint && (
                <div style={{
                  position: 'absolute',
                  left: `${Math.min(startPoint.displayX, currentDragPoint.displayX)}px`,
                  top: `${Math.min(startPoint.displayY, currentDragPoint.displayY)}px`,
                  width: `${Math.abs(currentDragPoint.displayX - startPoint.displayX)}px`,
                  height: `${Math.abs(currentDragPoint.displayY - startPoint.displayY)}px`,
                  border: '2px dashed #ec4899',
                  background: 'rgba(236, 72, 153, 0.2)',
                  pointerEvents: 'none'
                }} />
              )}
            </div>
          ) : (
            <div style={{
              height: '380px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '8px', border: '2px dashed var(--border-subtle)', color: 'var(--text-muted)',
              gap: '1rem', padding: '2rem', textAlign: 'center'
            }}>
              <Camera size={48} style={{ opacity: 0.3 }} />
              <div>
                <p style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>Nenhum frame carregado</p>
                <p style={{ fontSize: '0.85rem' }}>Clique em <strong>"Extrair Frame do YouTube"</strong> ou <strong>"Enviar Print"</strong> para visualizar a tela e desenhar as caixas.</p>
              </div>
            </div>
          )}
        </div>

        {/* PAINEL LATERAL DE GERENCIAMENTO DOS CAMPOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem' }}>
              📋 Campos Mapeados ({fields.length})
            </h4>

            {fields.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                <AlertCircle size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <p>Nenhum campo selecionado.</p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Use os botões de atalho acima ou arraste na imagem.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto' }}>
                {fields.map((field, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)',
                    padding: '0.65rem 0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}>
                    <input 
                      type="text" className="glass-input" 
                      value={field.nome}
                      onChange={(e) => {
                        const updated = [...fields];
                        updated[idx].nome = e.target.value;
                        setFields(updated);
                      }}
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                    />
                    <button 
                      onClick={() => handleDeleteField(idx)}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.2rem' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* AÇÕES DE TESTE E SALVAMENTO */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={handleTestOCR} 
                disabled={testingOcr || fields.length === 0} 
                className="btn-gradient" 
                style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              >
                <Sparkles size={18} />
                {testingOcr ? 'Lendo com OCR...' : 'Testar OCR nos Campos'}
              </button>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    Nome do Gabarito / Canal:
                  </label>
                  <input 
                    type="text" className="glass-input" 
                    placeholder="Ex: Leiloboi Nelore"
                    value={channelName} onChange={(e) => setChannelName(e.target.value)}
                  />
                </div>

                <button onClick={handleSaveTemplate} className="btn-gradient" style={{ marginTop: '0.4rem', width: '100%' }}>
                  <Save size={16} /> Salvar Gabarito do Leilão
                </button>
              </div>
            </div>
          </div>

          {/* CARD COM RESULTADOS DO OCR */}
          {ocrResults && (
            <div className="glass-panel" style={{ padding: '1.25rem', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={16} /> Resultado da Leitura OCR
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(ocrResults).map(([key, val]) => (
                  <div key={key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem 0.75rem', borderRadius: '6px'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{key}:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#a7f3d0' }}>
                      {val || '---'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
