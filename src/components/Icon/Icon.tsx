const PATHS = {
  search: 'M11 4a7 7 0 1 0 4.4 12.4l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
  send: 'M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5h0l1 3h-2l1-3Zm0 20-1-3h2l-1 3ZM2 12l3-1v2l-3-1Zm20 0-3 1v-2l3 1ZM4.9 4.9l2.8 1.4-1.4 1.4-1.4-2.8Zm14.2 14.2-2.8-1.4 1.4-1.4 1.4 2.8Zm0-14.2-1.4 2.8-1.4-1.4 2.8-1.4ZM4.9 19.1l1.4-2.8 1.4 1.4-2.8 1.4Z',
  calendar: 'M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2Zm12 8H5v9h14v-9ZM5 6v2h14V6H5Z',
  clock: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v4.6l3.2 3.2-1.4 1.4L11 12.4V7h2Z',
  pound: 'M14.5 3c2 0 3.4.8 4.3 2.1l-1.6 1.2C16.6 5.4 15.7 5 14.5 5 12.6 5 11.5 6.2 11.5 8v3H15v2h-3.5v2.2c0 1.3-.4 2.4-1.1 3.3H19v2H5v-2c1.7 0 2.5-1 2.5-3.2V13H5v-2h2.5V8c0-3 2.4-5 7-5Z',
  beach: 'M3 20h18v2H3v-2Zm9.6-15.6c3.7-1 7.4.8 8.4 4.1l-7.7 2.1 2.4 8.4h-2.1l-2.2-7.9-7.7 2.1c-1-3.4 1.4-7.4 5.1-8.4l-.1-.4 1.9-.5.1.5h-.1Z',
  star: 'm12 2.5 2.9 6.2 6.6.6-5 4.5 1.5 6.6L12 17l-6 3.4 1.5-6.6-5-4.5 6.6-.6L12 2.5Z',
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z',
  x: 'm6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z',
  chevronDown: 'm6.4 8.6 5.6 5.6 5.6-5.6L19 10l-7 7-7-7z',
  chevronRight: 'm9.4 5 7 7-7 7L8 17.6l5.6-5.6L8 6.4z',
  arrowLeft: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z',
  sparkle: 'M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2Zm7 12 .9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14ZM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8-1.8-.7 1.8-.7L5 15Z',
  plane: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z',
  filter: 'M3 5h18v2l-7 7v5l-4 2v-7L3 7V5Z',
  music: 'M9 18a3 3 0 1 1-2-2.8V4l12-2v12a3 3 0 1 1-2-2.8V6.4L9 7.8V18Z',
  family: 'M7 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm10 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM4 11h6v6H8v5H6v-5H4v-6Zm10 0h6v6h-2v5h-2v-5h-2v-6Z',
  hotel: 'M3 4h2v9h7V6h6a3 3 0 0 1 3 3v11h-2v-3H5v3H3V4Zm5 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
  info: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 8v7h2v-7h-2Zm0-3v2h2V7h-2Z',
  refresh: 'M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.2L13 11h7V4l-2.3 2.3Z',
  alert: 'M12 2 1 21h22L12 2Zm-1 7h2v6h-2V9Zm0 8h2v2h-2v-2Z',
} as const;

export type IconName = keyof typeof PATHS;

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  /** If given, the icon is announced; otherwise it is decorative. */
  title?: string;
}

export function Icon({ name, size = 20, className, title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
