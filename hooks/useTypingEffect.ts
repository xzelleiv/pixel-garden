import { useState, useEffect } from 'react';

export const useTypingEffect = (text: string, speed: number = 30): string => {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        if (!text) {
            setDisplayedText('');
            return;
        }

        if (speed <= 0) {
            setDisplayedText(text);
            return;
        }

        setDisplayedText('');
        let i = 0;
        const timer = setInterval(() => {
            setDisplayedText(text.substring(0, i + 1));
            i++;
            if (i >= text.length) {
                clearInterval(timer);
            }
        }, speed);

        return () => clearInterval(timer);
    }, [text, speed]);

    return displayedText;
};
