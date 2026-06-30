// Trigger a browser download of a Blob.
//
// IMPORTANT: we do NOT revoke the object URL immediately after click(). For
// large files the browser is still streaming the blob to disk when the click
// returns, and revoking early interrupts the download — leaving a stuck
// ".crdownload" (Chrome) / ".part" (Firefox) file. We revoke after a delay so
// the download always completes, then free the memory.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 60s is far longer than any local write needs, and the blob is freed after.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
