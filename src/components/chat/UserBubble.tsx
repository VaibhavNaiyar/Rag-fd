"use client";

export function UserBubble({ text }: { text: string }) {
  if (!text.trim()) return null;

  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] animate-message-in whitespace-pre-wrap rounded-lg rounded-br-sm bg-primary px-4 py-2.5 text-body text-[var(--on-primary)]">
        {text}
      </p>
    </div>
  );
}
