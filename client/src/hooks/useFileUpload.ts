import { useState, useCallback } from "react";

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const serveUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.url);
            } catch {
              reject(new Error("Invalid response from upload"));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.send(formData);
      });

      setProgress(100);
      return serveUrl;
    } finally {
      setUploading(false);
    }
  }, []);

  return { uploadFile, uploading, progress };
}
