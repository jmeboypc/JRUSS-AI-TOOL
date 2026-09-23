import React, { useState, useEffect } from 'react';

export default function DecryptedText({ text, speed = 30, delay = 100, className = "" }) {
  const [displayText, setDisplayText] = useState("");
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=-";

  useEffect(() => {
    let timeoutId;
    let intervalId;
    let iteration = 0;

    timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        setDisplayText(
          text
            .split("")
            .map((char, index) => {
              if (char === " ") return " ";
              if (index < Math.floor(iteration)) {
                return text[index];
              }
              return glyphs[Math.floor(Math.random() * glyphs.length)];
            })
            .join("")
        );

        if (iteration >= text.length) {
          clearInterval(intervalId);
          setDisplayText(text);
        }
        iteration += 0.5; // Controls transition speed
      }, speed);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [text, speed, delay]);

  return <span className={className}>{displayText || text}</span>;
}
