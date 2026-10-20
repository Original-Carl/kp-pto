"use strict";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Parse "YYYY-MM-DD" as a local date (new Date("YYYY-MM-DD") would be UTC midnight,
// which shows the previous day in US time zones). Returns null for bad input.
function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

// Events that haven't finished yet (multi-day events stay until their `end`
// date), sorted by start date. Entries with a bad date or title are dropped; a
// bad or earlier-than-start `end` is ignored (treated as a one-day event).
function upcomingEvents(events, today) {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (Array.isArray(events) ? events : [])
    .map((event) => {
      const parsedDate = parseLocalDate(event && event.date);
      const end = parseLocalDate(event && event.end);
      return { ...event, parsedDate, parsedEnd: end && parsedDate && end > parsedDate ? end : null };
    })
    .filter((event) => event.parsedDate && event.title && (event.parsedEnd || event.parsedDate) >= startOfToday)
    .sort((a, b) => a.parsedDate - b.parsedDate);
}

// "Nov 18–20" or "Mar 31 – Apr 3" for a multi-day event; "" for one day.
function dateRangeLabel(start, end) {
  if (!end) return "";
  const startLabel = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    ? `${startLabel}–${end.getDate()}`
    : `${startLabel} – ${MONTHS[end.getMonth()]} ${end.getDate()}`;
}

// Event links must be https; anything else (javascript:, http:, typos) is not rendered.
function isSafeLink(value) {
  try {
    return new URL(String(value)).protocol === "https:";
  } catch {
    return false;
  }
}

function renderEvents(listEl, emptyEl, events, today) {
  const upcoming = upcomingEvents(events, today);
  listEl.replaceChildren();
  emptyEl.hidden = upcoming.length > 0;

  let currentMonth = "";
  for (const event of upcoming) {
    // A heading before the first event of each month keeps a long list scannable.
    const monthLabel = `${MONTH_NAMES[event.parsedDate.getMonth()]} ${event.parsedDate.getFullYear()}`;
    if (monthLabel !== currentMonth) {
      currentMonth = monthLabel;
      const heading = document.createElement("li");
      heading.className = "event-month-heading";
      const h3 = document.createElement("h3");
      h3.textContent = monthLabel;
      heading.append(h3);
      listEl.append(heading);
    }

    const item = document.createElement("li");
    item.className = "event";

    const date = document.createElement("time");
    date.className = "event-date";
    date.dateTime = String(event.date).trim();
    const month = document.createElement("span");
    month.className = "event-month";
    month.textContent = MONTHS[event.parsedDate.getMonth()];
    const day = document.createElement("span");
    day.className = "event-day";
    day.textContent = String(event.parsedDate.getDate());
    date.append(month, day);

    const body = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "event-title";
    title.textContent = event.title;
    body.append(title);

    const meta = [dateRangeLabel(event.parsedDate, event.parsedEnd), event.time, event.location].filter(Boolean).join(" · ");
    if (meta) {
      const metaEl = document.createElement("p");
      metaEl.className = "event-meta";
      metaEl.textContent = meta;
      body.append(metaEl);
    }

    if (event.link && isSafeLink(event.link)) {
      const link = document.createElement("a");
      link.className = "event-link";
      link.href = event.link;
      link.textContent = event.linkText || "Details";
      body.append(link);
    }

    item.append(date, body);
    listEl.append(item);
  }
}

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !nav.classList.contains("is-open")) return;
    const hadFocus = nav.contains(document.activeElement);
    setOpen(false);
    if (hadFocus) toggle.focus();
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    const listEl = document.getElementById("event-list");
    const emptyEl = document.getElementById("events-empty");
    if (listEl && emptyEl) renderEvents(listEl, emptyEl, window.PTO_EVENTS, new Date());
    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  });
}

if (typeof module !== "undefined") {
  module.exports = { parseLocalDate, upcomingEvents, dateRangeLabel, isSafeLink };
}
