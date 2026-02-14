import { useState } from 'react';
import { downloadFile } from '../api/files';

interface Props {
  attachmentId: string;
  filename: string;
  fileSize: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileAttachmentView({ attachmentId, filename, fileSize }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadFile(attachmentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. File may have been deleted.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="file-attachment" onClick={handleDownload}>
      <span>&#128206;</span>
      <div>
        <div className="file-name">{filename}</div>
        <div className="file-size">
          {downloading ? 'Downloading...' : formatFileSize(fileSize)}
        </div>
      </div>
    </div>
  );
}
