import { rtlContentProps } from '../utils/textDirection';

/**
 * Paragraph (or other tag) with correct direction for Arabic vs Latin text.
 */
export default function RtlText({ as: Tag = 'p', children, className = '', ...rest }) {
  const text = typeof children === 'string' ? children : '';
  const props = rtlContentProps(text, className);
  return (
    <Tag {...rest} dir={props.dir} lang={props.lang} className={props.className}>
      {children}
    </Tag>
  );
}
