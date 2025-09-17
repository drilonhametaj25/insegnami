'use client';

import React, { useEffect, useState } from 'react';
import { Text } from '@mantine/core';

// Error Boundary Component
class CalendarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Calendar error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '600px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#fff5f5',
          borderRadius: '8px',
          border: '1px solid #fed7d7'
        }}>
          <Text size="lg" c="red">
            Errore nel caricamento del calendario. Ricarica la pagina.
          </Text>
        </div>
      );
    }

    return this.props.children;
  }
}

interface Lesson {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  class: {
    name: string;
    course: {
      name: string;
    };
  };
  teacher: {
    firstName: string;
    lastName: string;
  };
  room?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

interface CalendarComponentProps {
  lessons: Lesson[];
  onSelectEvent?: (event: any) => void;
  onSelectSlot?: (slot: { start: Date }) => void;
  view?: 'month' | 'week' | 'day';
}

export function CalendarComponent({
  lessons,
  onSelectEvent,
  onSelectSlot,
  view = 'week',
}: CalendarComponentProps) {
  const [Calendar, setCalendar] = useState<any>(null);
  const [localizer, setLocalizer] = useState<any>(null);

  // Validate and filter lessons with valid dates
  const validLessons = lessons.filter(lesson => {
    const hasValidDates = lesson.startTime && lesson.endTime;
    if (!hasValidDates) {
      console.warn('Lesson missing dates:', lesson);
      return false;
    }
    return true;
  });

  useEffect(() => {
    const loadCalendar = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { Calendar: RBCCalendar, momentLocalizer } = await import('react-big-calendar');
        const momentModule = await import('moment');
        
        // Get the default export from moment
        const moment = momentModule.default || momentModule;
        
        // Ensure moment is properly configured
        if (typeof moment !== 'function' || !moment.locale) {
          console.error('Moment is not properly loaded');
          return;
        }
        
        // Configure moment with Italian locale
        moment.locale('it');
        
        const loc = momentLocalizer(moment);
        
        // Validate localizer
        if (!loc || typeof loc !== 'object') {
          console.error('Localizer creation failed');
          return;
        }
        
        setCalendar(() => RBCCalendar);
        setLocalizer(loc);
      } catch (error) {
        console.error('Error loading calendar:', error);
      }
    };

    loadCalendar();
  }, []);

  if (!Calendar || !localizer) {
    return (
      <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text>Caricamento calendario...</Text>
      </div>
    );
  }

  // Transform lessons to calendar events with proper date conversion
  const events = validLessons.map((lesson) => {
    // Ensure dates are proper Date objects
    const startDate = lesson.startTime instanceof Date 
      ? lesson.startTime 
      : new Date(lesson.startTime);
    const endDate = lesson.endTime instanceof Date 
      ? lesson.endTime 
      : new Date(lesson.endTime);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn('Invalid date in lesson:', lesson);
      return null;
    }

    return {
      id: lesson.id,
      title: lesson.title,
      start: startDate,
      end: endDate,
      resource: lesson,
    };
  }).filter(Boolean); // Remove null entries

  const eventStyleGetter = (event: any) => {
    const status = event.resource.status;
    let backgroundColor = '#3174ad';
    
    switch (status) {
      case 'SCHEDULED':
        backgroundColor = '#339af0';
        break;
      case 'IN_PROGRESS':
        backgroundColor = '#ffd43b';
        break;
      case 'COMPLETED':
        backgroundColor = '#51cf66';
        break;
      case 'CANCELLED':
        backgroundColor = '#ff6b6b';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: status === 'CANCELLED' ? 0.6 : 1,
        color: 'white',
        border: '0',
        display: 'block',
      },
    };
  };

  return (
    <CalendarErrorBoundary>
      <div style={{ height: '600px' }}>
        {events.length === 0 ? (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <Text size="lg" c="dimmed">Nessuna lezione programmate</Text>
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={onSelectEvent}
            onSelectSlot={onSelectSlot}
            selectable
            defaultView={view}
            views={['month', 'week', 'day']}
            eventPropGetter={eventStyleGetter}
            messages={{
              next: 'Avanti',
              previous: 'Indietro',
              today: 'Oggi',
              month: 'Mese',
              week: 'Settimana',
              day: 'Giorno',
              agenda: 'Agenda',
              date: 'Data',
              time: 'Ora',
              event: 'Lezione',
              noEventsInRange: 'Nessuna lezione in questo periodo',
            }}
          />
        )}
      </div>
    </CalendarErrorBoundary>
  );
}
