import React, {useCallback, useContext, useEffect, useRef, useState} from 'react';
// import {Text} from 'react-native';
import throttle from 'lodash/throttle';
import XDate from 'xdate';

import Context from '../expandableCalendar/Context';
import {UpdateSources} from '../expandableCalendar/commons';
import {isToday} from '../dateutils';
import Timeline, {TimelineProps} from '../timeline/Timeline';
import InfiniteList from '../infinite-list';
import useTimelinePages, {INITIAL_PAGE, NEAR_EDGE_THRESHOLD} from './useTimelinePages';

export interface TimelineListRenderItemInfo {
  item: string;
  index: number;
  isCurrent: boolean;
  isInitialPage: boolean;
  isToday: boolean;
}

export interface TimelineListProps {
  /**
   * Map of all timeline events ({[date]: events})
   */
  events: {[date: string]: TimelineProps['events']};
  /**
   * General timeline props to pass to each timeline item
   */
  timelineProps?: Omit<TimelineProps, 'events' | 'scrollToFirst' | 'showNowIndicator' | 'scrollToNow' | 'initialTime'>;
  /**
   * Pass to render a custom Timeline item
   */
  renderItem?: (timelineProps: TimelineProps, info: TimelineListRenderItemInfo) => JSX.Element;
  /**
   * Should scroll to first event of the day
   */
  scrollToFirst?: boolean;
  /**
   * Should show now indicator (shown only on "today" timeline)
   */
  showNowIndicator?: boolean;
  /**
   * Should initially scroll to current time (relevant only for "today" timeline)
   */
  scrollToNow?: boolean;
  /**
   * Should initially scroll to a specific time (relevant only for NOT "today" timelines)
   */
  initialTime?: TimelineProps['initialTime'];
}

const TimelineList = (props: TimelineListProps) => {
  const {timelineProps, events, renderItem, showNowIndicator, scrollToFirst, scrollToNow, initialTime} = props;
  const {date, updateSource, setDate} = useContext(Context);
  const listRef = useRef<any>();
  const prevDate = useRef(date);
  const [timelineOffset, setTimelineOffset] = useState();

  const {pages, pagesRef, resetPages, resetPagesDebounce, scrollToPageDebounce, shouldResetPages, isOutOfRange} =
    useTimelinePages({date, listRef});

  useEffect(() => {
    if (date !== prevDate.current) {
      const datePageIndex = pagesRef.current.indexOf(date);

      if (updateSource !== UpdateSources.LIST_DRAG) {
        if (isOutOfRange(datePageIndex)) {
          updateSource === UpdateSources.DAY_PRESS ? resetPages(date) : resetPagesDebounce(date);
        } else {
          scrollToPageDebounce(datePageIndex);
        }
      }

      prevDate.current = date;
    }
  }, [date, updateSource]);

  const onScroll = useCallback(() => {
    if (shouldResetPages.current) {
      resetPagesDebounce.cancel();
    }
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    if (shouldResetPages.current) {
      resetPagesDebounce(prevDate.current);
    }
  }, []);

  const onPageChange = useCallback(
    throttle((pageIndex: number) => {
      const newDate = pagesRef.current[pageIndex];
      if (newDate !== prevDate.current) {
        setDate(newDate, UpdateSources.LIST_DRAG);
      }
    }, 0),
    []
  );

  const onReachNearEdge = useCallback(() => {
    shouldResetPages.current = true;
  }, []);

  const onTimelineOffsetChange = useCallback(offset => {
    setTimelineOffset(offset);
  }, []);

  const renderPage = useCallback(
    (_type, item, index) => {
      const timelineEvent = events[item];
      const isCurrent = prevDate.current === item;
      const isInitialPage = index === INITIAL_PAGE;
      const _isToday = isToday(new XDate(item));

      const _timelineProps = {
        ...timelineProps,
        key: item,
        date: item,
        events: timelineEvent,
        scrollToNow: _isToday && isInitialPage && scrollToNow,
        initialTime: !_isToday && isInitialPage ? initialTime : undefined,
        scrollToFirst: !_isToday && isInitialPage && scrollToFirst,
        scrollOffset: timelineOffset,
        onChangeOffset: onTimelineOffsetChange,
        showNowIndicator: _isToday && showNowIndicator
      };

      if (renderItem) {
        return renderItem(_timelineProps, {item, index, isCurrent, isInitialPage, isToday: _isToday});
      }

      return (
        <>
          <Timeline {..._timelineProps} />
          {/* NOTE: Keeping this for easy debugging */}
          {/* <Text style={{position: 'absolute'}}>{item}</Text> */}
        </>
      );
    },
    [events, timelineOffset, showNowIndicator]
  );

  return (
    <InfiniteList
      isHorizontal
      ref={listRef}
      data={pages}
      renderItem={renderPage}
      onPageChange={onPageChange}
      onReachNearEdge={onReachNearEdge}
      onReachNearEdgeThreshold={NEAR_EDGE_THRESHOLD}
      onScroll={onScroll}
      extendedState={{todayEvents: events[date], pages}}
      initialPageIndex={INITIAL_PAGE}
      scrollViewProps={{
        onMomentumScrollEnd
      }}
    />
  );
};

export default TimelineList;
