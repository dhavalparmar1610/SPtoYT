import React, { useEffect, useRef } from 'react';

export default function SilentAudioHack({ isPlaying }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current?.play().catch(e => console.warn('Silent audio play failed', e));
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying]);

  return (
    <audio 
      ref={audioRef} 
      loop 
      src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== " 
      style={{ display: 'none' }} 
    />
  );
}
