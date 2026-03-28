import { useRef, useCallback } from 'react';
import { Monitor } from 'lucide-react';

/**
 * BrowserViewer - Displays streamed screenshots and captures user interactions.
 * Clicks on the image are translated to viewport coordinates and sent to the backend.
 */
export default function BrowserViewer({ screenshot, currentUrl, isRecording, onClickAt, onTypeText, onKeypress }) {
    const imgRef = useRef(null);

    const handleClick = useCallback((e) => {
        if (!isRecording || !imgRef.current) return;

        const rect = imgRef.current.getBoundingClientRect();
        const imgNaturalWidth = 1280;
        const imgNaturalHeight = 800;

        // Scale click position from displayed size to actual viewport size
        const scaleX = imgNaturalWidth / rect.width;
        const scaleY = imgNaturalHeight / rect.height;

        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);

        onClickAt?.({ x, y });
    }, [isRecording, onClickAt]);

    const handleKeyDown = useCallback((e) => {
        if (!isRecording) return;

        // Handle special keys
        if (['Enter', 'Tab', 'Escape', 'Backspace', 'Delete'].includes(e.key)) {
            e.preventDefault();
            onKeypress?.({ key: e.key });
            return;
        }

        // Handle single printable characters
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onTypeText?.({ text: e.key });
        }
    }, [isRecording, onKeypress, onTypeText]);

    if (!screenshot) {
        return (
            <div className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700 aspect-video flex items-center justify-center">
                <div className="text-center space-y-3">
                    <Monitor className="h-16 w-16 text-slate-600 mx-auto" />
                    <div>
                        <p className="text-slate-400 font-medium">No browser session active</p>
                        <p className="text-slate-500 text-sm mt-1">Start recording to begin</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
            {/* Browser chrome bar */}
            <div className="bg-slate-800 px-4 py-2 flex items-center gap-3 border-b border-slate-700">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 bg-slate-900/50 rounded-md px-3 py-1 text-xs text-slate-400 font-mono truncate">
                    {currentUrl || 'about:blank'}
                </div>
                {isRecording && (
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-medium text-red-400">REC</span>
                    </div>
                )}
            </div>

            {/* Screenshot display */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div
                className="relative cursor-crosshair focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="application"
                aria-label="Browser viewport - click to interact"
            >
                <img
                    ref={imgRef}
                    src={`data:image/jpeg;base64,${screenshot}`}
                    alt="Browser screenshot"
                    className="w-full block"
                    draggable={false}
                />
            </div>
        </div>
    );
}
