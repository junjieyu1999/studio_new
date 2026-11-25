// Small coloured label for where a subscriber stands on payment. Shared by the subscriber
// screen, the Payments tab and the Overview.
import type { PayStatus } from '@/lib/mail-payments';
import styles from './AdminMail.module.css';

const CLASS: Record<PayStatus['state'], string> = {
  paid: styles.payPaid,
  free: styles.payFree,
  renew: styles.payRenew,
  lapsed: styles.payLapsed,
  unpaid: styles.payLapsed,
};

export default function PayBadge({ status }: { status: Pick<PayStatus, 'state' | 'label'> }) {
  return <span className={`${styles.payBadge} ${CLASS[status.state]}`}>{status.label}</span>;
}
