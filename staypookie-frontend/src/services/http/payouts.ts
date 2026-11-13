import { http } from './client';
import type { IPayoutService, PayoutAccountInput } from '../interfaces';
import type { ID, PayoutAccount } from '@/types/domain';

export const httpPayoutService: IPayoutService = {
  list: () => http.get<PayoutAccount[]>('/payout-accounts'),
  create: (input: PayoutAccountInput) => http.post<PayoutAccount>('/payout-accounts', input),
  resubmit: (id: ID, input: PayoutAccountInput) => http.post<PayoutAccount>(`/payout-accounts/${id}/resubmit`, input),
  rename: (id: ID, label: string) => http.patch<PayoutAccount>(`/payout-accounts/${id}`, { label }),
  async remove(id: ID) { await http.del(`/payout-accounts/${id}`); },
  async assign(propertyId: ID, payoutAccountId: ID | null) { await http.put(`/payout-accounts/properties/${propertyId}`, { payoutAccountId }); },
};
