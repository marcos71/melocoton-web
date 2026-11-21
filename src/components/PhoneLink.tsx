import { telHref } from '../lib/phone'
import styles from './PhoneLink.module.css'

type PhoneLinkProps = {
  name: string
  phone: string
}

/** A phone as a `tel:` link with the number also in text (DI-51); plain text when it has no digits. */
export function PhoneLink({ name, phone }: PhoneLinkProps) {
  const href = telHref(phone)
  if (!href) return <span>{phone}</span>
  return (
    <a className={styles.link} href={href} aria-label={`Llamar a ${name}, ${phone}`}>
      {phone}
    </a>
  )
}
