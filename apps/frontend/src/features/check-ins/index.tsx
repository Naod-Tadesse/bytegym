import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  DoorOpenIcon,
  Search01Icon,
  UserSearch01Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';

import { ListPage } from '@/components/list-page';
import { DataTablePagination } from '@/components/table/pagination';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useMemberSearch } from '@/features/members/hooks/use-members';
import { useDebounce } from '@/hooks/use-debounce';
import { gymToday } from '@/lib/gym-day';
import { CheckInCard } from './components/check-in-card';
import { MemberCheckInCard } from './components/member-check-in-card';
import type { CheckInOutcome, CheckInTableState } from './data/types';
import { useCheckIns, useRecordCheckIn } from './hooks/use-check-ins';

/**
 * The front desk.
 *
 * Not a CRUD table — this is the screen the gym uses most, and all it has to do
 * is find a member, show a verdict, and admit them. Hence a search box and a
 * big answer, with the day's attendance underneath for the manager who closes
 * the shift.
 */
export function CheckIns() {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  const [search, setSearch] = useState('');
  // The debounced term is what the server sees; the input stays instant.
  const debouncedSearch = useDebounce(search);

  /**
   * What happened to each member scanned in this session, keyed by person id.
   *
   * Per member rather than a single "last result": the desk can have several
   * matches on screen, and a lone banner could not say which of them it meant.
   */
  const [outcomes, setOutcomes] = useState<Record<string, CheckInOutcome>>({});

  // Searching members is `member.list` on the API. Someone who can admit but
  // not list would otherwise fire a request that only ever 403s — once per
  // keystroke, each one toasting.
  const canSearchMembers = hasPermission('member.list');
  const { members, total, isLoading, hasSearched } = useMemberSearch(
    debouncedSearch,
    canSearchMembers,
  );

  const { recordCheckIn, pendingMemberId } = useRecordCheckIn({
    onRecorded: (memberId, result) =>
      setOutcomes((previous) => ({
        ...previous,
        [memberId]: {
          kind: 'admitted',
          wasNew: result.wasNew,
          checkedInAt: result.checkIn.checkedInAt,
        },
      })),
    // The interceptor has already toasted the server's prose; what is kept here
    // is the reason, which decides what the card tells the desk to do next.
    onRefused: (memberId, reason) =>
      setOutcomes((previous) => ({
        ...previous,
        [memberId]: { kind: 'refused', reason },
      })),
  });

  return (
    <div className="m-2 flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t('checkIns.desk.title')}</CardTitle>
          <CardDescription>{t('checkIns.desk.subtitle')}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              // The only control on the screen that matters, on a screen whose
              // whole job is one lookup after another.
              autoFocus
              value={search}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(event.target.value)
              }
              placeholder={t('checkIns.desk.searchPlaceholder')}
              aria-label={t('checkIns.desk.searchPlaceholder')}
              disabled={!canSearchMembers}
              className="h-12 pr-11 pl-11 text-base md:text-base"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-2 -translate-y-1/2"
                aria-label={t('checkIns.desk.clearSearch')}
                onClick={() => setSearch('')}
              >
                <HugeiconsIcon icon={Cancel01Icon} />
              </Button>
            )}
          </div>

          {!canSearchMembers ? (
            <DeskEmpty
              title={t('checkIns.desk.noSearchPermission')}
              description={t('checkIns.desk.noSearchPermissionHint')}
            />
          ) : !hasSearched ? (
            <DeskEmpty
              title={t('checkIns.desk.prompt')}
              description={t('checkIns.desk.promptHint')}
            />
          ) : isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <DeskEmpty
              title={t('checkIns.desk.noMatches', { search: debouncedSearch })}
              description={t('checkIns.desk.noMatchesHint')}
            />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {members.map((member) => (
                  <MemberCheckInCard
                    key={member.personId}
                    member={member}
                    outcome={outcomes[member.personId]}
                    isPending={pendingMemberId === member.personId}
                    // `override` is omitted entirely on a normal admit rather
                    // than sent as `false`: the ordinary path posts exactly
                    // `{ memberId }`, so there is no flag on it to flip by
                    // accident.
                    onCheckIn={(override) =>
                      recordCheckIn({
                        memberId: member.personId,
                        ...(override ? { override: true } : {}),
                      })
                    }
                  />
                ))}
              </div>
              {/* Said out loud rather than silently truncated: the member being
                  looked for may be one of the ones not shown, and the desk has
                  no other way to know that. */}
              {total > members.length && (
                <p className="text-center text-xs text-muted-foreground">
                  {t('checkIns.desk.moreMatches', {
                    shown: members.length,
                    total,
                  })}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <TodaysCheckIns />
    </div>
  );
}

/**
 * How many placeholders stand in while the day's list loads.
 *
 * Three, the same as the search results above — the point of this half of the
 * screen is that it is the same shape as that one, and the wait should not be
 * the moment it stops being.
 */
const LOADING_CARDS = 3;

/** The day's attendance, newest first — what a manager scans at close. */
function TodaysCheckIns() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  // At `branch` scope every row is the caller's own branch, so naming it on
  // every card would repeat one value down the page.
  const showBranch = currentUser?.dataScope === 'all';

  const [tableState, setTableState] = useState<CheckInTableState>(() => {
    // The gym's calendar day, not the browser's and not UTC: 01:00 in Addis is
    // still yesterday in UTC, which would ask for the wrong day's list.
    //
    // The same day at both ends — the range is inclusive, so this is exactly
    // today. Sent rather than left to the server's identical default so the day
    // is part of the query key and the screen rolls over at midnight.
    const today = gymToday();
    return { page: 1, limit: 10, from: today, to: today };
  });
  const { checkIns, isLoading, paginationInfo } = useCheckIns(tableState);

  return (
    // `m-0`: the page container above already carries the margin, and a second
    // one here would double the gap between the two cards.
    <ListPage
      className="m-0"
      title={t('checkIns.today.title')}
      subtitle={t('checkIns.today.subtitle')}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: LOADING_CARDS }).map((_, index) => (
            <Skeleton key={index} className="h-21 w-full rounded-xl" />
          ))}
        </div>
      ) : checkIns.length === 0 ? (
        <DeskEmpty
          icon={DoorOpenIcon}
          title={t('checkIns.today.empty')}
          description={t('checkIns.today.emptyHint')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {checkIns.map((checkIn) => (
            <CheckInCard
              key={checkIn.id}
              checkIn={checkIn}
              showBranch={showBranch}
            />
          ))}
        </div>
      )}

      {/* The list is paginated server-side and a busy day runs to hundreds of
          rows — dropping the footer with the table would have quietly shown
          only the first ten.

          Hidden only when there is genuinely nothing to page through, and even
          then not past page one: a day that empties under someone standing on
          page three must keep the control that gets them back. */}
      {(isLoading || paginationInfo.total > 0 || paginationInfo.page > 1) && (
        <DataTablePagination
          paginationInfo={paginationInfo}
          setTableState={setTableState}
        />
      )}
    </ListPage>
  );
}

function DeskEmpty({
  title,
  description,
  icon = UserSearch01Icon,
}: {
  title: string;
  description: string;
  icon?: IconSvgElement;
}) {
  return (
    <Empty className="border py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={icon} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
