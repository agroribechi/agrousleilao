import React, { useState, useRef, useEffect } from 'react';
import { Camera, Save, Trash2, Undo, Play, Sparkles, AlertCircle, CheckCircle, Tag, FolderOpen, Scissors, Monitor } from 'lucide-react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

export default function CalibratorCanvas({ API_BASE, user, templates = [], initialTemplate = null, onTemplateSaved }) {
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=fHg377zdhms');
  const [minutes, setMinutes] = useState(19);
  const [seconds, setSeconds] = useState(39);
  const [loadingFrame, setLoadingFrame] = useState(false);
  const [frameData, setFrameData] = useState(null); // { image, width, height }
  
  const [fields, setFields] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [currentDragPoint, setCurrentDragPoint] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [channelName, setChannelName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [ocrResults, setOcrResults] = useState(null);
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
      showToast(`Gabarito '${found.name}' carregado para edição.`);
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
        showToast('⚠️ YouTube bloqueou o IP do servidor (Bot Check). Abrindo Player para captura direta do seu navegador...');
        setShowPlayer(true);
      } else {
        alert(`Erro ao buscar frame: ${err.message}`);
      }
    } finally {
      setLoadingFrame(false);
    }
  };

  // Abre o Player do YouTube
  const handleOpenPlayer = () => {
    if (!url || !url.trim()) {
      alert('Por favor, informe a URL ou ID do vídeo do YouTube.');
      return;
    }
    setShowPlayer(true);
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
          showToast('Tela capturada! Agora recorte APENAS a área de vídeo limpa.');
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
    
    // Calcula o tamanho real do crop na imagem original
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
    showToast('Recorte salvo com sucesso! Agora desenhe os campos.');
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
          const aspectRatio = img.width / img.height;
          if (Math.abs(aspectRatio - 1.777) > 0.05) {
             showToast('⚠️ Aviso: O print parece cortado (não é 16:9). Recomendamos usar "Carregar do YouTube" para evitar erros no ao vivo.');
          } else {
             showToast('Print carregado com sucesso!');
          }
        };
        img.src = b64;
      };
      reader.readAsDataURL(file);
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Interação de desenho sobre a imagem (Mouse e Touch)
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

    const scaleX = frameData.width / rect.width;
    const scaleY = frameData.height / rect.height;

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

    // Ignora seleções acidentais mínimas
    if (Math.abs(x2 - x1) < 15 || Math.abs(y2 - y1) < 15) {
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

  // Atalhos Rápidos de Caixas (Otimizado para Telas Touch Mobile)
  const handleAddPresetBox = (fieldType) => {
    if (!frameData) {
      alert("Por favor, carregue uma imagem primeiro para adicionar caixas.");
      return;
    }
    const w = frameData.width;
    const h = frameData.height;

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
    if (fields.length > 0) {
      setFields(fields.slice(0, -1));
    }
  };

  const handleClear = () => {
    setFields([]);
    setOcrResults(null);
  };

  // Testar OCR em todas as ROIs
  const handleTestOCR = async () => {
    if (fields.length === 0 || !frameData) return;
    setTestingOcr(true);
    setOcrResults(null);

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

      setOcrResults(data.results);
      showToast('Leitura OCR concluída!');
    } catch (err) {
      alert(`Erro no OCR: ${err.message}`);
    } finally {
      setTestingOcr(false);
    }
  };

  // Salvar Template no Backend
  const handleSaveTemplate = async () => {
    if (!channelName.trim()) {
      alert('Por favor, informe um nome para a leiloeira/canal.');
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

      showToast(`Template '${channelName}' salvo com sucesso!`);
      if (onTemplateSaved) onTemplateSaved();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100,
          background: 'rgba(16, 185, 129, 0.9)', color: '#fff', padding: '0.85rem 1.5rem',
          borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)', fontWeight: 600
        }}>
          <CheckCircle size={20} />
          {toastMsg}
        </div>
      )}

      {/* BARRA DE CAPTURA DO YOUTUBE E SELEÇÃO DE GABARITO */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={20} color="var(--accent-primary)" />
            Capturar Imagem & Editar Gabarito do Leilão
          </h3>

          {/* SELETOR DE GABARITOS SALVOS E LOGO DA LEILOEIRA */}
          {templates.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {logoUrl && (
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#0f172a', border: '1px solid #818cf8', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              )}
              <FolderOpen size={18} color="#818cf8" />
              <select 
                value={selectedTemplateId} 
                onChange={handleSelectTemplateChange}
                className="glass-input"
                style={{ width: '240px', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
              >
                <option value="" style={{ background: '#0f172a' }}>➕ Criar Novo Gabarito...</option>
                {templates.map(t => (
                  <option key={t.id || t.name} value={String(t.id || t.name)} style={{ background: '#0f172a' }}>
                    📂 {t.name} ({t.fields ? t.fields.length : 0} campos)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px auto', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Link do Vídeo no YouTube</label>
            <input 
              type="text" className="glass-input" 
              value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
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
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleFetchBackendFrame} 
            disabled={loadingFrame} 
            className="btn-gradient" 
            style={{ flex: 1, minWidth: '220px' }}
          >
            {loadingFrame ? 'Carregando Frame...' : <><Camera size={18} /> Extrair Frame do YouTube</>}
          </button>

          <button 
            onClick={handleOpenPlayer} 
            disabled={loadingFrame} 
            className="btn-secondary" 
            style={{ flex: 1, minWidth: '200px' }}
          >
            <Play size={18} /> Tocar no Player
          </button>
          
          <button onClick={handleStartCapture} className="btn-secondary" style={{ flex: 1, minWidth: '180px', backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>
            <Monitor size={18} /> Capturar Tela
          </button>

          <label className="btn-secondary" style={{ flex: 1, minWidth: '160px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
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
              <h3 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Play size={20} color="#f43f5e" /> Pausar no momento exato e capturar</h3>
              <button onClick={() => setShowPlayer(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', background: '#000', borderRadius: '8px' }}>
              <iframe
                src={`https://www.youtube.com/embed/${url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\n]+)/)?.[1]}?autoplay=1&start=${(Number(minutes) * 60) + Number(seconds)}`}
                frameBorder="0"
                allow="autoplay; fullscreen"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              ></iframe>
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
              ⚠️ ATENÇÃO: Recorte **EXATAMENTE** a área do vídeo (remover barra de endereços do navegador, logo do YouTube, chat, etc). Isso garante que o Ao Vivo vai mapear perfeitamente.
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
      {frameData && !capturedRawImage && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
          
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

            {/* ATALHOS RÁPIDOS DE CAIXAS (EXCELENTE PARA TELAS MOBILE) */}
            <div className="horizontal-chips-scroll" style={{ marginBottom: '0.85rem', background: 'rgba(15, 23, 42, 0.4)', padding: '0.5rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, alignSelf: 'center', whiteSpace: 'nowrap', marginRight: '0.25rem' }}>⚡ Atalhos Touch:</span>
              <button onClick={() => handleAddPresetBox('lote')} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                + Caixa Lote
              </button>
              <button onClick={() => handleAddPresetBox('preco')} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#34d399', whiteSpace: 'nowrap' }}>
                + Caixa Preço
              </button>
              <button onClick={() => handleAddPresetBox('desc')} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#facc15', whiteSpace: 'nowrap' }}>
                + Caixa Descrição
              </button>
              <button onClick={() => handleAddPresetBox('idade')} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: '#c084fc', whiteSpace: 'nowrap' }}>
                + Caixa Idade/Peso
              </button>
            </div>

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
                const scaleX = rect.width / frameData.width;
                const scaleY = rect.height / frameData.height;

                const left = field.x1 * scaleX;
                const top = field.y1 * scaleY;
                const width = (field.x2 - field.x1) * scaleX;
                const height = (field.y2 - field.y1) * scaleY;

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
          </div>

          {/* PAINEL LATERAL DE GERENCIAMENTO DOS CAMPOS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
                📋 Campos Mapeados ({fields.length})
              </h4>

              {fields.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
                  <AlertCircle size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <p>Nenhum campo selecionado.</p>
                  <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Arraste um retângulo sobre a imagem para criar uma área ROI.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {fields.map((field, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-subtle)',
                      padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                      <input 
                        type="text" className="glass-input" 
                        value={field.nome}
                        onChange={(e) => {
                          const updated = [...fields];
                          updated[idx].nome = e.target.value;
                          setFields(updated);
                        }}
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
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
                  {testingOcr ? 'Lendo com IA...' : 'Testar OCR nos Campos'}
                </button>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      Nome da Leiloeira / Canal:
                    </label>
                    <input 
                      type="text" className="glass-input" 
                      placeholder="Ex: Leiloboi Unai"
                      value={channelName} onChange={(e) => setChannelName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      Logotipo do Leilão / Leiloeira:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {logoUrl ? (
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#0f172a', border: '1px solid #818cf8', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={logoUrl} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--border-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '0.7rem' }}>
                          Sem Logo
                        </div>
                      )}
                      
                      <label className="btn-secondary" style={{ cursor: 'pointer', padding: '0.4rem 0.6rem', fontSize: '0.75rem', flexShrink: 0 }}>
                        📤 Upload Logo
                        <input type="file" accept="image/*" onChange={handleLogoFileUpload} style={{ display: 'none' }} />
                      </label>

                      <input 
                        type="text" className="glass-input" 
                        placeholder="Ou URL da Logo..."
                        value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem' }}
                      />
                    </div>
                  </div>

                  <button onClick={handleSaveTemplate} className="btn-gradient" style={{ marginTop: '0.4rem', width: '100%' }}>
                    <Save size={16} /> Salvar Gabarito do Leilão
                  </button>
                </div>
              </div>
            </div>

            {/* CARD COM RESULTADOS DO OCR */}
            {ocrResults && (
              <div className="glass-panel" style={{ padding: '1.25rem', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={16} /> Resultado da Leitura OCR
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {Object.entries(ocrResults).map(([key, val]) => (
                    <div key={key} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem 0.75rem', borderRadius: '6px'
                    }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{key}:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a7f3d0' }}>
                        {val || '---'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
