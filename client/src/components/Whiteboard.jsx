import { useEffect, useRef, useState } from 'react';

// Helper function to draw on the canvas context
const drawOnCanvas = (ctx, x, y, type, drawColor, size, drawTool) => {
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (drawTool === 'eraser') {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = size * 4;
  } else {
    ctx.strokeStyle = drawColor;
  }

  if (type === 'start') {
    ctx.beginPath();
    ctx.moveTo(x, y);
  } else if (type === 'draw') {
    ctx.lineTo(x, y);
    ctx.stroke();
  }
};

// Helper function to calculate coordinate positions relative to the canvas bounding box
const getPos = (e, canvas) => {
  const rect = canvas.getBoundingClientRect();
  // Support both mouse and touch events
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
};

function Whiteboard({ socket, roomId, onClose }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState('pen'); // pen or eraser

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Canvas background black
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw from another user's events
    const handleRemoteDraw = ({ x, y, type, color, brushSize, tool }) => {
      drawOnCanvas(ctx, x, y, type, color, brushSize, tool);
    };

    // Clear canvas for everyone
    const handleClear = () => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    socket.on('draw-event', handleRemoteDraw);
    socket.on('clear-board', handleClear);

    return () => {
      socket.off('draw-event', handleRemoteDraw);
      socket.off('clear-board', handleClear);
    };
  }, [socket]);

  const handleMouseDown = (e) => {
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e, canvas);

    drawOnCanvas(ctx, x, y, 'start', color, brushSize, tool);
    socket.emit('draw-event', { roomId, x, y, type: 'start', color, brushSize, tool });
  };

  const handleMouseMove = (e) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e, canvas);

    drawOnCanvas(ctx, x, y, 'draw', color, brushSize, tool);
    socket.emit('draw-event', { roomId, x, y, type: 'draw', color, brushSize, tool });
  };

  const handleMouseUp = () => {
    drawing.current = false;
  };

  const clearBoard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear-board', { roomId });
  };

  // Download whiteboard as image
  const downloadBoard = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  const colors = ['#ffffff', '#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6'];

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{ background: '#0f172a', borderRadius: '14px', padding: '20px', width: '860px' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>Whiteboard</h3>

          {/* Color Palette */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {colors.map(c => (
              <div
                key={c}
                onClick={() => { setColor(c); setTool('pen'); }}
                style={{
                  width: '22px', height: '22px',
                  borderRadius: '50%',
                  background: c,
                  cursor: 'pointer',
                  border: color === c && tool === 'pen' ? '2px solid white' : '2px solid transparent'
                }}
              />
            ))}
          </div>

          {/* Brush size */}
          <input
            type="range"
            min="1"
            max="12"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ width: '80px' }}
          />

          {/* Eraser */}
          <button
            onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}
            style={{ padding: '6px 12px', background: tool === 'eraser' ? '#f59e0b' : '#1e293b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            {tool === 'eraser' ? 'Pen' : 'Eraser'}
          </button>

          {/* Clear */}
          <button
            onClick={clearBoard}
            style={{ padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            Clear
          </button>

          {/* Download */}
          <button
            onClick={downloadBoard}
            style={{ padding: '6px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            Save
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            style={{ padding: '6px 12px', background: '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginLeft: 'auto' }}
          >
            ✕ Close
          </button>
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={820}
          height={460}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          style={{ borderRadius: '8px', cursor: tool === 'eraser' ? 'cell' : 'crosshair', display: 'block' }}
        />
      </div>
    </div>
  );
}

export default Whiteboard;