export async function requestPrediction(file, { baseUrl, signal, fetchImpl = fetch }) {
  const formData = new FormData();
  formData.append('file', file);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/predict`, {
      method: 'POST', body: formData, signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Cannot reach the image-analysis server. Check that the backend is running and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Image analysis failed (HTTP ${response.status}). Please try again.`);
  }
  if (!['Real', 'Deepfake'].includes(data?.detection)
      || typeof data.confidence !== 'number'
      || !Number.isFinite(data.confidence)
      || data.confidence < 0 || data.confidence > 100) {
    throw new Error('The server returned an invalid prediction. Please try again.');
  }
  return data;
}
