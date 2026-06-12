import { useState, useEffect } from 'react';
import axios from 'axios';

import { API_BASE_URL } from '../config';

function FileShare({ socket, roomId, userName }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Listen for files shared by others
  useEffect(() => {
    socket.on('file-shared', (fileInfo) => {
      setFiles(prev => [fileInfo, ...prev]);
    });

    return () => socket.off('file-shared');
  }, [socket]);

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('roomId', roomId);
      formData.append('userName', userName);

      await axios.post(`${API_BASE_URL}/api/rooms/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // File will appear via socket event for everyone including uploader

    } catch (err) {
      alert('File upload failed. Max size is 20MB.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
  };

  // Drag and drop support
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type) => {
    if (!type) return '[FILE]';
    if (type.startsWith('image/')) return '[IMG]';
    if (type.startsWith('video/')) return '[VID]';
    if (type.startsWith('audio/')) return '[AUD]';
    if (type.includes('pdf')) return '[PDF]';
    if (type.includes('zip') || type.includes('rar')) return '[ZIP]';
    if (type.includes('word') || type.includes('document')) return '[DOC]';
    if (type.includes('sheet') || type.includes('excel')) return '[XLS]';
    return '[FILE]';
  };

  return (
    <div style={{
      width: '280px',
      background: '#1e293b',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      height: '500px'
    }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #334155' }}>
        <h4 style={{ margin: 0, color: 'white', fontSize: '15px' }}>Files</h4>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          margin: '12px',
          padding: '16px',
          border: `2px dashed ${dragOver ? '#2563eb' : '#334155'}`,
          borderRadius: '8px',
          textAlign: 'center',
          background: dragOver ? 'rgba(37,99,235,0.1)' : 'transparent',
          transition: 'all 0.2s'
        }}
      >
        {uploading ? (
          <p style={{ color: '#60a5fa', fontSize: '13px', margin: 0 }}>⏳ Uploading...</p>
        ) : (
          <>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 8px' }}>
              Drag & drop a file here
            </p>
            <label style={{ cursor: 'pointer' }}>
              <span style={{
                padding: '6px 16px',
                background: '#2563eb',
                color: 'white',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer'
              }}>
                Browse File
              </span>
              <input
                type="file"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
            </label>
            <p style={{ color: '#475569', fontSize: '11px', margin: '8px 0 0' }}>Max 20MB</p>
          </>
        )}
      </div>

      {/* Files List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {files.length === 0 ? (
          <p style={{ color: '#475569', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
            No files shared yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {files.map((file, index) => (
              <div
                key={index}
                style={{
                  background: '#0f172a',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                {/* File icon */}
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8' }}>{getFileIcon(file.type)}</span>

                {/* File info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '500',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {file.name}
                  </p>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '11px' }}>
                    {formatSize(file.size)} • by {file.uploadedBy}
                  </p>
                </div>

                {/* Download button */}
                <a
                  href={file.url}
                  download={file.name}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '5px 10px',
                    background: '#059669',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '12px',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FileShare;