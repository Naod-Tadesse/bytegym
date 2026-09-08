import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ui/toast';
import ApiClient from '@/services/api-client';
import {
  toPaginationInfo,
  type PaginatedResponse,
} from '@/services/pagination';
import type {
  BroadcastAudience,
  SmsMessage,
  SmsSettings,
  SmsTableState,
} from '../data/types';

// The hooks file IS the api layer — no separate api/ folder.
const apiClient = new ApiClient('/api/sms');

export interface SendSmsPayload {
  /** Local form. A pasted `+251…` is normalised by the API before validating. */
  phone: string;
  message: string;
}

export interface BroadcastPayload {
  audience: BroadcastAudience;
  planId?: string;
  message: string;
}

/**
 * What one send came back as. Note there is no error path for a failed
 * message: the API answers 201 whether or not it went out, because "the
 * provider refused it" is an outcome to show, not an exception to throw at
 * somebody standing at the front desk.
 */
export interface SendSmsResult {
  delivered: boolean;
  held?: boolean;
  error?: string;
}

// ===== Queries =====

/** The log. Held and failed messages are listed, never filtered out. */
export function useSmsMessages(tableState: SmsTableState) {
  const query = useQuery({
    queryKey: ['sms', 'list', tableState],
    queryFn: () =>
      apiClient.get<PaginatedResponse<SmsMessage>>('', {
        params: {
          page: tableState.page,
          limit: tableState.limit,
          ...(tableState.search ? { search: tableState.search } : {}),
          ...(tableState.kind ? { kind: tableState.kind } : {}),
          ...(tableState.status ? { status: tableState.status } : {}),
          ...(tableState.from ? { from: tableState.from } : {}),
          ...(tableState.to ? { to: tableState.to } : {}),
        },
      }),
  });

  return {
    messages: query.data?.data ?? [],
    isLoading: query.isLoading,
    paginationInfo: toPaginationInfo(query.data?.meta, tableState),
  };
}

export function useSmsSettings() {
  const query = useQuery({
    queryKey: ['sms', 'settings'],
    queryFn: () => apiClient.get<SmsSettings>('/settings'),
  });

  return { settings: query.data, isLoading: query.isLoading };
}

// ===== Mutations =====

export function useSendSms(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: SendSmsPayload) =>
      apiClient.post<SendSmsResult>('/send', payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sms'] });

      // Three outcomes, three different things to say. A green "Message sent"
      // over a message the provider refused is the one thing this must not do.
      if (result.delivered) {
        toast.add({ title: 'Message sent', type: 'success' });
      } else if (result.held) {
        toast.add({
          title: 'Held back',
          description: 'Only the test number is being texted at the moment.',
          type: 'info',
        });
      } else {
        toast.add({
          title: 'Not delivered',
          description: result.error ?? 'The provider refused it.',
          type: 'error',
        });
      }

      onSuccess?.();
    },
  });

  return { sendSmsAsync: mutation.mutateAsync, isPending: mutation.isPending };
}

/** How many a broadcast would reach. Sends nothing — for the confirmation step. */
export function usePreviewBroadcast() {
  const mutation = useMutation({
    mutationFn: (payload: BroadcastPayload) =>
      apiClient.post<{ recipients: number }>('/broadcast/preview', payload),
  });

  return {
    previewAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useBroadcast(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: BroadcastPayload) =>
      apiClient.post<{ recipients: number }>('/broadcast', payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sms'] });
      // "Sending" rather than "sent": the API returns once the recipients are
      // counted, and the messages are still going out behind it.
      toast.add({
        title: `Sending to ${result.recipients} members`,
        description: 'Watch the history below for the outcome.',
        type: 'success',
      });
      onSuccess?.();
    },
  });

  return {
    broadcastAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useUpdateSmsSettings() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: Partial<SmsSettings>) =>
      apiClient.patch<SmsSettings>('/settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms', 'settings'] });
      toast.add({ title: 'Reminder settings saved', type: 'success' });
    },
  });

  return {
    updateSettingsAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

/** Runs the daily job now. Safe to repeat — anyone already done today is skipped. */
export function useRunReminders() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ sent: number; skipped: number; reason: string | null }>(
        '/reminders/run',
        {},
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sms'] });
      toast.add({
        title:
          result.reason === 'disabled'
            ? 'Reminders are switched off'
            : `${result.sent} sent, ${result.skipped} already done today`,
        type: result.reason === 'disabled' ? 'info' : 'success',
      });
    },
  });

  return {
    runRemindersAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
