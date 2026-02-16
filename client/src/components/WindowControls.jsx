import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';

export default function WindowControls() {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    window.api.isMac().then(setIsMac);
  }, []);

  if (isMac) return null;

  return (
    <div className="window-controls">
      <button className="wc-btn" onClick={() => window.api.windowMinimize()}>
        <Minus size={15} />
      </button>
      <button className="wc-btn" onClick={() => window.api.windowMaximize()}>
        <Square size={12} />
      </button>
      <button className="wc-btn wc-close" onClick={() => window.api.windowClose()}>
        <X size={15} />
      </button>
    </div>
  );
}
