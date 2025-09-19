'use client';

import React, { useMemo, useCallback } from 'react';
import { 
  Calendar, 
  momentLocalizer, 
  Event, 
  View, 
  SlotInfo,
  EventPropGetter,
} from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/it';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { LessonEvent } from '@/lib/hooks/useAdvancedLessons';

// Configure moment with Italian locale
moment.locale('it');
const localizer = momentLocalizer(moment);

// Create drag and drop calendar
const DnDCalendar = withDragAndDrop(Calendar);

interface AdvancedCalendarComponentProps {
  lessons: LessonEvent[];
  onSelectEvent: (event: any) => void;
  onSelectSlot: (slotInfo: SlotInfo) => void;
  onEventDrop?: (args: { event: any; start: Date; end: Date }) => Promise<void>;
  view: View;
  onViewChange: (view: View, date: Date) => void;
  readonly?: boolean;
  height?: number;
}

export interface CalendarEvent extends Event {
  resource: LessonEvent;
}

// Custom styles
const calendarStyles = {
  style: {
    height: '100%',
    fontSize: '14px',
  },
};

// Event style getter
const eventStyleGetter: EventPropGetter<any> = (event: any) => {
  const lesson = event.resource as LessonEvent;
  if (!lesson) return {};
  
  let backgroundColor = '#3174ad';
  let color = 'white';

  // Color based on status
  switch (lesson.status) {
    case 'SCHEDULED':
      backgroundColor = '#3b82f6'; // blue
      break;
    case 'IN_PROGRESS':
      backgroundColor = '#f59e0b'; // yellow/orange
      break;
    case 'COMPLETED':
      backgroundColor = '#10b981'; // green
      break;
    case 'CANCELLED':
      backgroundColor = '#ef4444'; // red
      break;
    default:
      backgroundColor = '#6b7280'; // gray
  }

  // Add special styling for recurring lessons
  if (lesson.isRecurring) {
    backgroundColor = backgroundColor + 'dd'; // Add transparency
  }

  return {
    style: {
      backgroundColor,
      color,
      border: 'none',
      borderRadius: '4px',
      fontSize: '12px',
      padding: '2px 4px',
    },
  };
};

// Custom components
const CustomEvent = ({ event }: { event: any }) => {
  const lesson = event.resource as LessonEvent;
  if (!lesson) return <div>{event.title}</div>;
  
  return (
    <div style={{ fontSize: '11px', lineHeight: '1.2' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '1px' }}>
        {lesson.title}
      </div>
      <div style={{ opacity: 0.9 }}>
        {lesson.class.name}
      </div>
      {lesson.room && (
        <div style={{ opacity: 0.8, fontSize: '10px' }}>
          📍 {lesson.room}
        </div>
      )}
      {lesson.isRecurring && (
        <div style={{ opacity: 0.8, fontSize: '10px' }}>
          🔄
        </div>
      )}
    </div>
  );
};

const CustomToolbar = ({ 
  label, 
  onNavigate, 
  onView, 
  view 
}: {
  label: string;
  onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void;
  onView: (view: View) => void;
  view: View;
}) => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: '10px',
    padding: '10px 0',
    borderBottom: '1px solid #e5e7eb'
  }}>
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={() => onNavigate('TODAY')}
        style={{
          padding: '6px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          background: 'white',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        Oggi
      </button>
      <button
        onClick={() => onNavigate('PREV')}
        style={{
          padding: '6px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          background: 'white',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        ‹
      </button>
      <button
        onClick={() => onNavigate('NEXT')}
        style={{
          padding: '6px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          background: 'white',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        ›
      </button>
    </div>

    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
      {label}
    </h3>

    <div style={{ display: 'flex', gap: '4px' }}>
      {(['month', 'week', 'day'] as View[]).map((viewName) => (
        <button
          key={viewName}
          onClick={() => onView(viewName)}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            background: view === viewName ? '#3b82f6' : 'white',
            color: view === viewName ? 'white' : 'black',
            cursor: 'pointer',
            fontSize: '14px',
            textTransform: 'capitalize',
          }}
        >
          {viewName === 'month' ? 'Mese' : viewName === 'week' ? 'Settimana' : 'Giorno'}
        </button>
      ))}
    </div>
  </div>
);

const AdvancedCalendarComponent: React.FC<AdvancedCalendarComponentProps> = ({
  lessons,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  view,
  onViewChange,
  readonly = false,
  height = 600,
}) => {
  // Convert lessons to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    if (!lessons || !Array.isArray(lessons)) {
      return [];
    }
    return lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      start: new Date(lesson.startTime),
      end: new Date(lesson.endTime),
      resource: lesson,
    }));
  }, [lessons]);

  // Handle event selection
  const handleSelectEvent = useCallback((event: any) => {
    onSelectEvent(event as CalendarEvent);
  }, [onSelectEvent]);

  // Handle slot selection
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    if (readonly) return;
    onSelectSlot(slotInfo);
  }, [readonly, onSelectSlot]);

  // Handle drag and drop
  const handleEventDrop = useCallback(async (args: any) => {
    if (readonly || !onEventDrop) return;
    const { event, start, end } = args;
    await onEventDrop({ event: event as CalendarEvent, start, end });
  }, [readonly, onEventDrop]);

  const handleEventResize = useCallback(async (args: any) => {
    if (readonly || !onEventDrop) return;
    const { event, start, end } = args;
    await onEventDrop({ event: event as CalendarEvent, start, end });
  }, [readonly, onEventDrop]);

  // Handle view/date changes
  const handleNavigate = useCallback((newDate: Date) => {
    onViewChange(view, newDate);
  }, [view, onViewChange]);

  const handleViewChange = useCallback((newView: View) => {
    onViewChange(newView, new Date());
  }, [onViewChange]);

  // Messages for Italian locale
  const messages = {
    date: 'Data',
    time: 'Ora',
    event: 'Evento',
    allDay: 'Tutto il giorno',
    week: 'Settimana',
    work_week: 'Settimana lavorativa',
    day: 'Giorno',
    month: 'Mese',
    previous: 'Precedente',
    next: 'Successivo',
    yesterday: 'Ieri',
    tomorrow: 'Domani',
    today: 'Oggi',
    agenda: 'Agenda',
    noEventsInRange: 'Nessun evento in questo periodo.',
    showMore: (total: number) => `+ Altri ${total}`,
  };

  // Formats for Italian locale
  const formats = {
    dateFormat: 'DD',
    dayFormat: 'ddd DD/MM',
    weekdayFormat: 'dddd',
    selectRangeFormat: ({ start, end }: { start: Date; end: Date }) => {
      return `${moment(start).format('DD/MM/YYYY HH:mm')} - ${moment(end).format('HH:mm')}`;
    },
    eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) => {
      return `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`;
    },
    timeGutterFormat: 'HH:mm',
    monthHeaderFormat: 'MMMM YYYY',
    dayHeaderFormat: 'dddd DD MMMM YYYY',
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) => {
      return `${moment(start).format('DD MMMM')} - ${moment(end).format('DD MMMM YYYY')}`;
    },
  };

  return (
    <div style={{ height: `${height}px` }}>
      <DnDCalendar
        localizer={localizer}
        events={events}
        startAccessor={(event: any) => event.start}
        endAccessor={(event: any) => event.end}
        style={calendarStyles.style}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        onNavigate={handleNavigate}
        onView={handleViewChange}
        view={view}
        selectable={!readonly}
        resizable={!readonly}
        draggableAccessor={() => !readonly}
        eventPropGetter={eventStyleGetter}
        components={{
          event: CustomEvent,
          toolbar: CustomToolbar,
        }}
        messages={messages}
        formats={formats}
        min={new Date(2023, 0, 1, 8, 0)} // 8:00 AM
        max={new Date(2023, 0, 1, 20, 0)} // 8:00 PM
        step={15} // 15 minute intervals
        timeslots={4} // 4 timeslots per hour (15 min each)
        popup={true}
        popupOffset={30}
        dayLayoutAlgorithm="no-overlap"
      />
    </div>
  );
};

export default AdvancedCalendarComponent;
export { AdvancedCalendarComponent };
