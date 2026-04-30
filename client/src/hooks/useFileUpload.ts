import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const presignMutation = trpc.upload.presignPut.useMutation();

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    setUploading(true);
    setProgress(0);
    try {
      // Get presigned URL from server
      const { s3Url, serveUrl } = await presignMutation.mutateAsync({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      });

      // Upload directly to S3
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", s3Url);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.send(file);
      });

      setProgress(100);
      return serveUrl;
    } finally {
      setUploading(false);
    }
  }, [presignMutation]);

  return { uploadFile, uploading, progress };
}
