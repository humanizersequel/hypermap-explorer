import { useState } from 'react';
import { FaCheck, FaCopy } from 'react-icons/fa6';

export default function Copier({ text }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);

        setTimeout(() => {
            setCopied(false);
        }, 2000);
    };

    return (
        <button
            className="bg-black/10 dark:bg-white/10 p-2 rounded-md thin text-[12px]"
            onClick={handleCopy}
            disabled={copied}
        >
            {copied ? <FaCheck /> : <FaCopy />}
            {copied ? 'Copied!' : 'Copy'}
        </button>
    );
}