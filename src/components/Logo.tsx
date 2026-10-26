/** Знак «ЮР» (Юнит-Ресурс) по макету шапки: тёмная «Ю/U» и зелёная «R». */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={Math.round(size * 1.125)} height={size} viewBox="0 0 27 24" role="img" aria-label="Юнит-Ресурс">
      <path d="M0 0h4v20h3V9h4v15H0z" fill="#102F40" />
      <path d="M8 0h4v6H8z" fill="#102F40" />
      <path
        d="M14 0h7.2C24.6 0 27 2.3 27 5.6c0 2.5-1.4 4.4-3.6 5.2L27 24h-4.3l-3.2-12.6H18V24h-4zm4 3.6v4.4h3c1.5 0 2.4-.9 2.4-2.2s-.9-2.2-2.4-2.2z"
        fill="#68BC25"
      />
    </svg>
  );
}
