import type { SingingStatus } from './api';

export const statusLabels: Record<SingingStatus, string> = {
  CAN_SING: 'Can Sing',
  REGULARLY_SING: 'Regularly Sing',
  PRACTICING: 'Practicing',
  WANT_TO_LEARN: 'Want to Learn'
};

export const singingStatuses = Object.keys(statusLabels) as SingingStatus[];
