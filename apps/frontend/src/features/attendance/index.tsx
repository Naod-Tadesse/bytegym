import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListPage } from '@/components/list-page';
import { DataTable } from '@/components/table/data-table';
import { gymToday } from '@/lib/gym-day';
import { AttendanceFilters } from './components/attendance-filters';
import { useAttendanceColumns } from './components/attendance-columns';
import type { AttendanceTableState } from './data/types';
import { useAttendance } from './hooks/use-attendance';

/**
 * The attendance register.
 *
 * Check-ins is the desk — find a member, read the verdict, admit them. This is
 * the record that desk produces: who came in, over which days, filterable. Same
 * relationship as Staff to Users; one screen acts, the other answers questions.
 *
 * It opens on today rather than on everything, because the answer to "was it
 * busy" is almost always about now, and a first paint of every visit the gym has
 * ever recorded is a slow page that nobody asked for. Widening it is one click.
 */
export function Attendance() {
  const { t } = useTranslation();

  const [tableState, setTableState] = useState<AttendanceTableState>(() => {
    // The gym's calendar day, not the browser's and not UTC: 01:00 in Addis is
    // still yesterday in UTC. The same date at both ends — the range is
    // inclusive, so this is exactly today.
    const today = gymToday();
    return { page: 1, limit: 10, from: today, to: today };
  });

  const columns = useAttendanceColumns(tableState);
  const { records, total, isLoading, paginationInfo } =
    useAttendance(tableState);

  return (
    <ListPage
      title={t('attendance.title')}
      subtitle={t('attendance.subtitle')}
      headerActions={
        // The number this screen is opened for. It is `meta.total` from the
        // API — the count over the whole filtered range — never `records.length`,
        // which is one page of ten and would report "10 visits" for a month
        // that had four hundred.
        //
        // Not rendered until the count is real: a hard "0 visits" during the
        // first load is a wrong answer, and it is the answer someone would act
        // on.
        isLoading ? null : (
          <span className="text-sm text-muted-foreground">
            {t('attendance.visitCount', { count: total })}
          </span>
        )
      }
    >
      <DataTable
        columns={columns}
        data={records}
        tableState={tableState}
        setTableState={setTableState}
        isLoading={isLoading}
        paginationInfo={paginationInfo}
        // The endpoint inherits `search` from its pagination DTO and ignores it
        // — a check-in carries no text of its own. A visible box that filtered
        // nothing would be worse than none at all; the member filter is how you
        // narrow to a person.
        hideSearch
      >
        <AttendanceFilters
          tableState={tableState}
          setTableState={setTableState}
        />
      </DataTable>
    </ListPage>
  );
}
