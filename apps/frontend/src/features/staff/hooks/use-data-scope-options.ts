import { useTranslation } from 'react-i18next';

/** Matches the DATA_SCOPES tuple the backend DTO validates against. */
export function useDataScopeOptions() {
  const { t } = useTranslation();

  return [
    { value: 'branch', label: t('staff.dataScope.branch') },
    { value: 'all', label: t('staff.dataScope.all') },
  ];
}
