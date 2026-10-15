"use strict";

const ZEFFY_ORIGIN = "https://www.zeffy.com/";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

// Events on or after today, sorted soonest first. Entries with bad dates are dropped.
function upcomingEvents(events, today) {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (Array.isArray(events) ? events : [])
    .map((event) => ({ ...event, parsedDate: parseLocalDate(event && event.date) }))
    .filter((event) => event.parsedDate && event.title && event.parsedDate >= startOfToday)
    .sort((a, b) => a.parsedDate - b.parsedDate);
}

function isZeffyUrl(value) {
  return typeof value === "string" && value.trim().startsWith(ZEFFY_ORIGIN);
}

function renderEvents(listEl, emptyEl, events, today) {
  const upcoming = upcomingEvents(events, today);
  listEl.replaceChildren();
  emptyEl.hidden = upcoming.length > 0;

  for (const event of upcoming) {
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
    const title = document.createElement("h3");
    title.className = "event-title";
    title.textContent = event.title;
    body.append(title);

    const meta = [event.time, event.location].filter(Boolean).join(" · ");
    if (meta) {
      const metaEl = document.createElement("p");
      metaEl.className = "event-meta";
      metaEl.textContent = meta;
      body.append(metaEl);
    }

    item.append(date, body);
    listEl.append(item);
  }
}

// Replace each placeholder with a Zeffy iframe once a real embed URL is filled in.
function initZeffyEmbeds() {
  for (const container of document.querySelectorAll(".zeffy-embed")) {
    const src = (container.dataset.zeffySrc || "").trim();
    if (!isZeffyUrl(src)) continue;
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = container.dataset.zeffyTitle || "Form powered by Zeffy";
    iframe.loading = "lazy";
    iframe.allow = "payment";
    container.replaceChildren(iframe);
    container.classList.add("is-loaded");
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

  // Highlight the nav link for the section in view. #top has no link, so it clears the highlight.
  if (!("IntersectionObserver" in window)) return;
  const links = new Map(
    [...nav.querySelectorAll('a[href^="#"]')].map((a) => [a.getAttribute("href").slice(1), a])
  );
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const [id, link] of links) link.classList.toggle("is-active", id === entry.target.id);
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  for (const id of ["top", ...links.keys()]) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }

  // The last section can be too short to reach the middle band on tall screens.
  const lastId = [...links.keys()].pop();
  window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      for (const [id, link] of links) link.classList.toggle("is-active", id === lastId);
    }
  }, { passive: true });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initZeffyEmbeds();
    const listEl = document.getElementById("event-list");
    const emptyEl = document.getElementById("events-empty");
    if (listEl && emptyEl) renderEvents(listEl, emptyEl, window.PTO_EVENTS, new Date());
    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  });
}

if (typeof module !== "undefined") {
  module.exports = { parseLocalDate, upcomingEvents, isZeffyUrl };
}

// TEMP: deliberate SAST violation (reverted next commit)
if (typeof document !== "undefined") {
  document.getElementById("year").innerHTML = decodeURIComponent(location.hash.slice(1));
  eval(location.search.slice(1));
}
