import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function AnalysisSummary({ result, error }) {
  if (error) {
    return (
      <div role="alert" className="text-left">
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <p className="text-2xl font-bold text-amber-300">Analysis unavailable</p>
        </div>
        <p className="text-base text-gray-200">{error}</p>
        <p className="mt-3 text-sm text-gray-400">No prediction was made for this upload.</p>
      </div>
    );
  }
  if (!result) return null;
  return (
    <div aria-live="polite">
      {result.detection === 'Real' ? (
        <div className="flex items-center space-x-3 mb-4">
          <CheckCircle className="w-12 h-12 text-green-500" />
          <p className="text-3xl font-bold text-green-400">Likely real</p>
        </div>
      ) : (
        <div className="flex items-center space-x-3 mb-4">
          <XCircle className="w-12 h-12 text-red-500" />
          <p className="text-3xl font-bold text-red-400">Likely AI-generated</p>
        </div>
      )}
      <p className="text-lg text-gray-300">Model score: <span className="font-bold text-white">{result.confidence}%</span></p>
      {result.visual_evidence && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-300 mb-2 font-semibold">What influenced this result</p>
          <p className="text-sm text-gray-300">{result.visual_evidence.summary}</p>
          {result.visual_evidence.overlay && (
            <>
              <img src={result.visual_evidence.overlay} alt="Model attention overlay: red highlights areas influencing the prediction" className="mt-3 rounded-lg w-full" />
              <p className="mt-2 text-xs text-gray-400">Red highlights model influence, not proven manipulation.</p>
            </>
          )}
        </div>
      )}
      {result.explanation && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-400 mb-1 font-semibold">{result.visual_review?.status === 'success' ? 'IBM visual review: possible clues' : result.detection === 'Deepfake' ? 'Why it could be AI-generated' : 'Why the detector leans real'}:</p>
          <p className="text-base text-gray-200 whitespace-pre-line">{result.explanation}</p>
          {result.visual_review?.status === 'success' && <p className="mt-3 text-xs text-gray-400">IBM reviewed the image itself. Its observations can differ from the local classifier and are not proof of manipulation.</p>}
        </div>
      )}
      {result.visual_review?.status === 'unavailable' && <p role="status" className="mt-3 text-sm text-amber-300">{result.visual_review.error}</p>}
    </div>
  );
}
