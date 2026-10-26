/**
 * Статический экспорт (STATIC_EXPORT=1) не допускает пустой generateStaticParams() у динамического маршрута,
 * а при реальных данных он бывает пустым (нет подрубрик, все статьи помещаются на одну страницу). В этом случае
 * пререндерится один адрес-заглушка, для которого шаблон вызывает notFound(), и экспорт не создаёт для него
 * страницу. В боевом режиме (Node.js) пустой список допустим и возвращается как есть.
 */
export function staticParams<T extends Record<string, string>>(list: T[], placeholder: T): T[] {
  return list.length === 0 && process.env.STATIC_EXPORT === "1" ? [placeholder] : list;
}
