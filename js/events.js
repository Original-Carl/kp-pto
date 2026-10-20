// Edit this list to post events. Past events hide automatically; order doesn't matter.
// date: "YYYY-MM-DD" (required). end: last day of a multi-day event (optional).
// time and location are optional.
//
// Source: "KP Calendar of Events 2026-2027" (school calendar PDF), family-facing
// items only. Left out: staff-only deadlines (grades/progress reports due,
// rotation changes, staff training and team meetings), end-of-quarter markers
// (the PDF lists Quarter 2 ending on both Dec 11 and Jan 19), and Pops N Jazz
// (date TBD). Where the PDF's weekday didn't match its date (Nov 3; Feb 18,
// 19, 22; May 24; Jun 3), the date was kept.
//
// Example:
//   { date: "2026-11-18", end: "2026-11-20", title: "Fall Conferences" },
//   { date: "2026-11-12", title: "PTO General Meeting", time: "7:00 PM", location: "School library" },
window.PTO_EVENTS = [
  // August 2026
  { date: "2026-08-25", title: "PTO-Sponsored Staff Lunch" },
  { date: "2026-08-26", title: "First Day of School" },

  // September 2026
  { date: "2026-09-02", title: "Picture Day" },
  { date: "2026-09-07", title: "Labor Day: No School, Offices Closed" },
  { date: "2026-09-09", title: "Welcome Back Picnic", time: "5–7 PM" },
  { date: "2026-09-09", title: "Movie Night", time: "6:30–8 PM" },
  { date: "2026-09-10", title: "PTO General Meeting", location: "Zoom & Library" },
  { date: "2026-09-14", title: "6th Grade Curriculum Night" },
  { date: "2026-09-21", title: "Yom Kippur: No School" },
  { date: "2026-09-28", title: "7th & 8th Grade Curriculum Night" },
  { date: "2026-09-30", title: "Progress Reports" },

  // October 2026
  { date: "2026-10-02", title: "Custodial Staff Appreciation Day" },
  { date: "2026-10-08", title: "PTO Board Meeting", location: "Zoom & Library" },
  { date: "2026-10-12", title: "Indigenous Peoples’ Day: No School, Offices Closed" },
  { date: "2026-10-27", title: "Picture Retake Day" },
  { date: "2026-10-27", title: "Grade 6 Halloween Mixer", time: "3–4 PM" },
  { date: "2026-10-28", title: "Choir MidFest" },
  { date: "2026-10-30", title: "7th & 8th Grade Halloween Mixer", time: "6–8 PM" },

  // November 2026
  { date: "2026-11-01", end: "2026-11-07", title: "School Psychology Week" },
  { date: "2026-11-02", title: "Band MidFest" },
  { date: "2026-11-03", title: "Election Day: Teacher In-Service Day" },
  { date: "2026-11-11", title: "Veterans Day Assembly and Day of Giving/Service" },
  { date: "2026-11-12", title: "PTO General Meeting", location: "Zoom & Library" },
  { date: "2026-11-18", title: "Choral Fest" },
  { date: "2026-11-18", end: "2026-11-20", title: "Fall Conferences" },
  { date: "2026-11-19", title: "Unified Theater Showcase" },
  { date: "2026-11-20", title: "Inspiration Inc: Grade 8" },
  { date: "2026-11-26", end: "2026-11-27", title: "Thanksgiving Recess: No School, Offices Closed" },

  // December 2026
  { date: "2026-12-05", title: "Northern Regional Middle School Festivals Auditions" },
  { date: "2026-12-10", title: "7th & 8th Grade Winter Concerts" },
  { date: "2026-12-14", end: "2026-12-23", title: "10 Days ’Til Winter Break Celebrations" },
  { date: "2026-12-24", end: "2026-12-31", title: "Winter Recess" },

  // January 2027
  { date: "2027-01-01", title: "New Year’s Day: No School, Offices Closed" },
  { date: "2027-01-13", title: "Select Ensembles Concert" },
  { date: "2027-01-14", title: "PTO Board Meeting", location: "Zoom only" },
  { date: "2027-01-18", title: "MLK Day: No School, Offices Closed" },
  { date: "2027-01-20", title: "Algebra Mid-Terms" },
  { date: "2027-01-25", title: "Orchestra MidFest Field Trip & Concert", time: "7 PM" },

  // February 2027
  { date: "2027-02-01", end: "2027-02-05", title: "National School Counseling Week" },
  { date: "2027-02-09", title: "LUV Concert", location: "King Philip Middle School" },
  { date: "2027-02-11", title: "PTO General Meeting", location: "Zoom only" },
  { date: "2027-02-15", end: "2027-02-16", title: "Winter Recess: No School (Offices open Feb 16 only)" },
  { date: "2027-02-18", title: "Meet the Middle School Principals", location: "Virtual" },
  { date: "2027-02-19", title: "STEAM Night (snow date Feb 26)" },
  { date: "2027-02-22", title: "Meet the Middle School Principals", location: "Duffy Elementary" },

  // March 2027
  { date: "2027-03-01", end: "2027-03-05", title: "School Social Worker Week" },
  { date: "2027-03-05", end: "2027-03-06", title: "NRSM Music Festival", location: "CCSU" },
  { date: "2027-03-08", title: "5th to 6th Grade Transition Night (Presentation)" },
  { date: "2027-03-10", end: "2027-03-12", title: "Spring Conferences" },
  { date: "2027-03-11", title: "PTO Board Meeting", location: "Zoom & Library" },
  { date: "2027-03-15", title: "5th to 6th Grade Transition Night (Tours)" },
  { date: "2027-03-26", title: "Good Friday: No School, Offices Closed" },
  { date: "2027-03-31", title: "KP Musical (Community Performance)" },

  // April 2027
  { date: "2027-04-01", end: "2027-04-03", title: "KP Spring Musical" },
  { date: "2027-04-05", end: "2027-04-09", title: "National Assistant Principals Week" },
  { date: "2027-04-07", title: "National Paraprofessional Appreciation Day" },
  { date: "2027-04-08", title: "PTO General Meeting", location: "Zoom & Library" },
  { date: "2027-04-12", end: "2027-04-16", title: "Spring Recess: No School" },
  { date: "2027-04-21", title: "National Secretary and Admin Assistant Day" },
  { date: "2027-04-27", title: "SBA Testing: ELA CAT" },
  { date: "2027-04-29", title: "SBA Testing: ELA CAT" },
  { date: "2027-04-30", title: "SBA Testing: ELA CAT" },
  { date: "2027-04-30", title: "KP Recognizes Principal’s Appreciation Day" },

  // May 2027
  { date: "2027-05-01", title: "National Principal’s Appreciation Day" },
  { date: "2027-05-03", end: "2027-05-07", title: "Teacher Appreciation Week" },
  { date: "2027-05-06", title: "KP Band Concert" },
  { date: "2027-05-10", title: "KP Choir Concert" },
  { date: "2027-05-11", title: "SBA Testing: Math PT" },
  { date: "2027-05-12", title: "National School Nurse Appreciation Day" },
  { date: "2027-05-13", title: "PTO Board Meeting", location: "Zoom & Library" },
  { date: "2027-05-14", title: "Grade 6 & 7 Spring Dance", time: "5–7 PM" },
  { date: "2027-05-20", title: "KP Orchestra Concert" },
  { date: "2027-05-24", title: "KP Select Ensembles Concert" },
  { date: "2027-05-31", title: "Memorial Day: No School, Offices Closed" },

  // June 2027
  { date: "2027-06-01", title: "KP’s A Day in the Life" },
  { date: "2027-06-03", title: "PTO General/Board Meeting", location: "Zoom & Library" },
  { date: "2027-06-04", title: "8th Grade Formal/Farewell Dance" },
  { date: "2027-06-08", title: "Last Day of School" },
  { date: "2027-06-18", title: "Juneteenth: Offices Closed" },
];
