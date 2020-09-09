import React from 'react';
import logo from './logo.svg';
import './App.css';

import TOML from "@iarna/toml";

function App() {

  const schedule = useSchedule();
  const todaysSchedule = getCurrentOrNextSchedule(new Date(), schedule.event);
  const [time, setTime] = React.useState('8:05');
  const [now, setNowTime] = React.useState(new Date());
  const setNow = () => {setNowTime(new Date())};

  useInterval(() => {
    setNow()
  }, 500);

  const nextEvent = getCurrentOrUpcomingEvent(now, todaysSchedule);
  return (
    <div className="App">
      <div className="todayschedule">
        {todaysSchedule.map((se) => {
          if (schedule.urls[se.url]) {
            return (
              <a key={se.time_start} target="_blank" href={schedule.urls[se.url]}>
                <ScheduleBlock scheduleEvent={se} when={now} />
              </a>
            );
          }
          return <ScheduleBlock scheduleEvent={se} when={now} />;
        })}
      </div>
      <div className="spotlight">
        <div>
          <p>
            It's {new Intl.DateTimeFormat("en-us", {
              weekday: "long",
              hour: "numeric",
              minute: "numeric",
            }).format(now)}
          </p>

          {nextEvent && (
            <a className="eventlink" target="_blank" href={schedule.urls[nextEvent.url]}>
              <ScheduleBlock scheduleEvent={nextEvent} when={now} relative={true} />
            </a>
          )}

        </div>
      </div>
    </div>
  );
}

const getUrl = (urls: {[key: string]: string}, key: any): string => {
  if (key === undefined) {
    return '#';
  }
  if (urls[key] !== undefined) {
    return urls[key]
  }
  return "#"
}

const ScheduleBlock = ({scheduleEvent: se, when, relative = false}: {when: Date, scheduleEvent: ScheduleEvent, relative?: boolean}) => {
  const { start, stop } = eventDurationRange(se);
  const currentBlock = eventContainsDate(se, when);
  return (
    <div

      key={se.time_start}
      className={['scheduleblock', currentBlock ? "active" : "inactive", se.color].join(" ")}
    >
      <h2>{se.name}</h2>
      <h3>{se.description}</h3>
      <p>
        {new Intl.DateTimeFormat("en-us", {
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        }).format(start)}
        -{" "}
        {new Intl.DateTimeFormat("en-us", {
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        }).format(stop)}
        {/* {relative && !eventContainsDate(se, when) && `in ${}`} */}
      </p>
    </div>
  );
}

const getCurrentOrUpcomingEvent = (when: Date, events: ScheduleEvent[]) => {
  if (events.find(evt => eventContainsDate(evt, when))) {
    return events.find((evt) => eventContainsDate(evt, when));
  } else {
    const upcomingEvents = events.filter(evt => {
      return eventDurationRange(evt).start.getTime() >= when.getTime()
    });
    if (upcomingEvents.length > 0) {
      return upcomingEvents[0]
    } else {
      return events[0]
    }
  }
}

const dateFromString = (str: string): Date => {
  const d = new Date();
  const bits = str.split(':').map(Number);
  if (bits.length > 0) {
    d.setHours(bits[0]);
  }
  if (bits.length > 1) {
    d.setMinutes(bits[1])
  }
  if (bits.length > 2) {
    d.setSeconds(bits[2])
  }
  return d
}

type ScheduleEvent = {
  name: string;
  description: string;
  days: string[];
  time_start: string;
  duration: number;
  color: string;
  url: string;
  urls: { name: string; url: string }[];
};
type Schedule = {
  urls: {[key: string]: string},
  event: ScheduleEvent[]
}

const useSchedule = () => {
  const [schedule, setSchedule] = React.useState<Schedule>({urls: {}, event: []})
  const [shouldCheck, setShouldCheck] = React.useState(true);

  useInterval(() => {
    setShouldCheck(true)
  }, (5 * 60 * 1000))

  React.useEffect(() => {
    const doer = async () => {
      const scheduleResponse = await fetch('./schedule.toml');
      const scheduleText = await scheduleResponse.text();
      // console.log(scheduleText)
      setSchedule(TOML.parse(scheduleText) as Schedule);
      setShouldCheck(false);
    }
    if (shouldCheck){
      doer();
    }
  }, [shouldCheck]);
  return schedule;
}

const dayAsStr = (date: Date): string => {
  return ['s', 'm', 't', 'w', 'r', 'f', 's'][date.getDay()];
}

const getDayEvents = (date: Date, events: ScheduleEvent[]): ScheduleEvent[] => {
  const dayStr = dayAsStr(date);

  return events.filter(evt => evt.days.includes(dayStr)).sort((left, right) => {
    return eventDurationRange(left).start.getTime() - eventDurationRange(right).start.getTime()
  });
}

const getCurrentOrNextSchedule = (date: Date, events: ScheduleEvent[]): ScheduleEvent[] => {
  const todaysEvents = getDayEvents(date, events);
  if (todaysEvents.length === 0) {
    return [];
  }
  if (date.getTime() > eventDurationRange(todaysEvents[todaysEvents.length - 1]).stop.getTime()) {
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    return getDayEvents(nextDate, events);
  }
  return todaysEvents;
}

const eventDurationRange = (evt: ScheduleEvent): {start: Date, stop: Date} => {
  const [hh, mm, ss] = evt.time_start.split(':').map(Number);
  // console.log(hh, mm, ss)
    const evtStart = new Date();
    evtStart.setHours(hh)
    evtStart.setMinutes(mm)
    evtStart.setSeconds(ss)
    evtStart.setMilliseconds(0)
    // console.log(evtStart, evtStart.getTime(), evt.duration * 1000 * 60);
    const evtEnd = new Date(evtStart.getTime() + (evt.duration * 1000 * 60))
    // console.log(evt.duration)
    return {start: evtStart, stop: evtEnd}
}

const eventContainsDate = (evt: ScheduleEvent, date: Date, fuzzMs: number = 30_000): boolean => {
  const {start, stop} = eventDurationRange(evt);
  const now = date.getTime();
  return (now - start.getTime()) >= (-1 * fuzzMs) && (stop.getTime() - now) >= (-1 * fuzzMs);
}

const getCurrentEvent = (date: Date, events: ScheduleEvent[]): ScheduleEvent | undefined => {
  return events.find(evt => {
    const now = new Date();
    return eventContainsDate(evt, now);
  });
}


export default App;

function useInterval(callback: Function, delay: number) {
  const savedCallback = React.useRef<Function>(callback);

  // Remember the latest callback.
  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  React.useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
