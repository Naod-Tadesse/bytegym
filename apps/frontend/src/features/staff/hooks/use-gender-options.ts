import { useTranslation } from 'react-i18next';

/** Matches the GENDERS tuple the backend DTO validates against. */
export function useGenderOptions() {
  const { t } = useTranslation();

  return [
    { value: 'male', label: t('staff.gender.male') },
    { value: 'female', label: t('staff.gender.female') },
  ];
}
