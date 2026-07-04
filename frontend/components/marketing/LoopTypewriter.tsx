"use client";

import { useEffect, useState } from "react";

type Props = {
  words: string[];
  className?: string;
};

const TYPE_SPEED_MS = 78;
const DELETE_SPEED_MS = 46;
const PAUSE_AFTER_WORD_MS = 1150;

export default function LoopTypewriter({ words, className }: Props) {
  const safeWords = words.length > 0 ? words : ["Data Analyst"];
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const currentWord = safeWords[wordIndex % safeWords.length];

    if (!deleting && charIndex === currentWord.length) {
      const pauseTimer = window.setTimeout(() => setDeleting(true), PAUSE_AFTER_WORD_MS);
      return () => window.clearTimeout(pauseTimer);
    }

    if (deleting && charIndex === 0) {
      setDeleting(false);
      setWordIndex((prev) => (prev + 1) % safeWords.length);
      return;
    }

    const timer = window.setTimeout(
      () => setCharIndex((prev) => prev + (deleting ? -1 : 1)),
      deleting ? DELETE_SPEED_MS : TYPE_SPEED_MS,
    );

    return () => window.clearTimeout(timer);
  }, [charIndex, deleting, safeWords, wordIndex]);

  const currentWord = safeWords[wordIndex % safeWords.length];
  const visible = currentWord.slice(0, charIndex);

  return (
    <span className={className}>
      {visible || " "}
      <span className="kx-typing-cursor" aria-hidden />
    </span>
  );
}

